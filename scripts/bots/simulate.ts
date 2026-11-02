/**
 * Bot simulation harness for the Tables mode. Plays bot-only tables with fixed
 * seeds and reports, per game:
 *   - tiers: Sharks against Rookies at the same table (Sharks should win clearly),
 *   - styles: all-Regular tables, results and habits per style (they should differ),
 *   - table length, think time, compute time per decision,
 *   - illegal actions and hidden-information leaks (both must be 0).
 *
 *   pnpm sim:bots                       every game, default table counts
 *   pnpm sim:bots holdem 200            one game, 200 tables per experiment
 *   pnpm sim:bots all 100 --seed 7      another seed
 *   pnpm sim:bots all 20 --cash         cash tables: bot-only sessions with bots coming and going
 *   pnpm sim:bots holdem 20 --cash --stake high
 */
import { holdemCashDef, holdemDef, liarsCashDef, liarsDef, showdownCashDef, showdownDef, type CashTableDef, type TableDef } from '@/lib/tables/defs'
import { playBotTable, playCashTable, type SimResult } from '@/lib/tables/simulate'
import { cashStakeFor, limitsLabel } from '@/lib/tables/stakes'
import { stakeUnit } from '@/lib/tables/cash'
import type { CashStakeId } from '@/lib/tables/types'
import { BOT_ROSTER } from '@/lib/bots/roster'
import type { Bot, BotSkill, BotStyle } from '@/lib/bots/types'
import { placeIn } from '@/lib/tables/standings'
import { payoutsFor } from '@/lib/tables/stakes'
import { TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import type { TableGameName } from '@/lib/tables/types'
import { createRng } from '@/utils/rng'
import { shuffled } from '@/games/holdem/evaluator'
import type { HoldemState } from '@/games/holdem/types'
import type { LiarsState } from '@/games/liars-dice/types'
import type { ShowdownState } from '@/games/blackjack-showdown/types'

// ── Hidden-information twins: the same table with everything a seat can't see re-drawn ──

function twinHoldem(state: HoldemState, seat: number, rng: () => number): HoldemState {
  const hidden = state.seats.flatMap((s, i) => (i === seat ? [] : s.hole))
  const pool = shuffled([...hidden, ...state.deck], rng)
  let k = 0
  const seats = state.seats.map((s, i) => (i === seat ? s : { ...s, hole: s.hole.map(() => pool[k++]!) }))
  return { ...state, seats, deck: pool.slice(k) }
}

function twinLiars(state: LiarsState, seat: number, rng: () => number): LiarsState {
  const seats = state.seats.map((s, i) => (i === seat ? s : { ...s, dice: s.dice.map(() => 1 + Math.floor(rng() * 6)) }))
  return { ...state, seats }
}

function twinShowdown(state: ShowdownState, seat: number, rng: () => number): ShowdownState {
  let { dealer, shoe } = state
  if (dealer.length >= 2) {
    const pool = shuffled([dealer[1]!, ...shoe], rng)
    dealer = [dealer[0]!, pool[0]!, ...dealer.slice(2)]
    shoe = pool.slice(1)
  } else shoe = shuffled(shoe, rng)
  const secret = state.hand === state.config.hands && state.phase === 'betting'
  const seats = state.seats.map((s, i) =>
    secret && i !== seat && s.bet > 0 ? { ...s, bet: 10 * (1 + Math.floor(rng() * Math.min(50, s.stack / 10))) } : s,
  )
  const log = secret ? state.log.map((e) => (e.hand === state.hand && e.seat !== seat && e.action.type === 'bet' ? { ...e, action: { ...e.action, amount: 1 } } : e)) : state.log
  return { ...state, dealer, shoe, seats, log }
}

// ── Habits per style, measured from the finished table ──

type Habits = Record<string, number>

function habitsHoldem(state: HoldemState, seat: number): Habits {
  const hands = new Set(state.log.filter((e) => e.seat === seat).map((e) => e.hand))
  const pre = state.log.filter((e) => e.seat === seat && e.street === 'preflop')
  const vpip = new Set(pre.filter((e) => e.kind === 'call' || e.kind === 'raise' || e.kind === 'all-in').map((e) => e.hand))
  const pfr = new Set(pre.filter((e) => e.kind === 'raise' || e.kind === 'all-in').map((e) => e.hand))
  const post = state.log.filter((e) => e.seat === seat && e.street !== 'preflop')
  const agg = post.filter((e) => e.kind === 'bet' || e.kind === 'raise' || e.kind === 'all-in').length
  const calls = post.filter((e) => e.kind === 'call').length
  return { hands: hands.size, vpip: vpip.size, pfr: pfr.size, agg, calls }
}

function habitsLiars(state: LiarsState, seat: number): Habits {
  const mine = state.log.filter((e) => e.seat === seat)
  return { actions: mine.length, calls: mine.filter((e) => e.action.type === 'liar').length }
}

function habitsShowdown(state: ShowdownState, seat: number): Habits {
  const bets = state.log.filter((e) => e.seat === seat && e.action.type === 'bet')
  const total = bets.reduce((sum, e) => sum + (e.action.type === 'bet' ? e.action.amount : 0), 0)
  return { bets: bets.length, betTotal: total }
}

function describeHabits(game: TableGameName, h: Habits): string {
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : '—')
  if (game === 'holdem') return `VPIP ${pct(h.vpip!, h.hands!)} · PFR ${pct(h.pfr!, h.hands!)} · post-flop aggression ${h.calls ? (h.agg! / h.calls).toFixed(2) : '∞'}`
  if (game === 'liars-dice') return `calls liar on ${pct(h.calls!, h.actions!)} of turns`
  return `avg bet ${h.bets ? Math.round(h.betTotal! / h.bets) : 0}`
}

// ── Experiments ──

interface Tally {
  tables: number
  wins: number
  cashes: number
  placeSum: number
  prize: number
  habits: Habits
}

const emptyTally = (): Tally => ({ tables: 0, wins: 0, cashes: 0, placeSum: 0, prize: 0, habits: {} })

function record(t: Tally, place: number, prize: number, buyIn: number, habits: Habits) {
  t.tables++
  if (place === 1) t.wins++
  if (prize > 0) t.cashes++
  t.placeSum += place
  t.prize += prize - buyIn
  for (const [k, v] of Object.entries(habits)) t.habits[k] = (t.habits[k] ?? 0) + v
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function run<S, V, A>(
  game: TableGameName,
  def: TableDef<S, V, A>,
  tables: number,
  seed: number,
  twin: (s: S, seat: number, rng: () => number) => S,
  habits: (s: S, seat: number) => Habits,
) {
  const seats = TABLE_GAME_BY_NAME.get(game)!.seats
  const buyIn = 100
  const totals = { deals: 0, decisions: 0, illegal: 0, leaks: 0, thinkMs: 0, ms: 0 }
  const tiers: Record<string, Tally> = {}
  const styles: Record<string, Tally> = {}

  const play = (bots: Bot[], tableSeed: number, into: (bot: Bot) => Tally) => {
    const started = performance.now()
    const r: SimResult<S> = playBotTable(def, bots, tableSeed, { twin, leakCheckEvery: 3 })
    totals.ms += performance.now() - started
    totals.deals += r.deals
    totals.decisions += r.decisions
    totals.illegal += r.illegal
    totals.leaks += r.leaks
    totals.thinkMs += r.thinkMs
    const prizes = payoutsFor(r.standings, buyIn, bots.length, game)
    bots.forEach((bot, i) => record(into(bot), placeIn(r.standings, i)!, prizes[i]!, buyIn, habits(r.final, i)))
  }

  const rng = createRng(seed)
  const draw = (count: number) => shuffled(BOT_ROSTER, rng).slice(0, count)

  // Tiers: half Sharks, half Rookies, seats alternating, random profiles.
  for (let t = 0; t < tables; t++) {
    const bots = draw(seats).map((profile, i): Bot => ({ profile, skill: (i + t) % 2 === 0 ? 'shark' : 'rookie' }))
    play(bots, seed * 1000 + t, (bot) => (tiers[bot.skill] ??= emptyTally()))
  }
  // Styles: everyone Regular.
  for (let t = 0; t < tables; t++) {
    const bots = draw(seats).map((profile): Bot => ({ profile, skill: 'regular' as BotSkill }))
    play(bots, seed * 1000 + 500_000 + t, (bot) => (styles[bot.profile.style] ??= emptyTally()))
  }

  const n = tables * 2
  console.log(`\n━━ ${TABLE_GAME_BY_NAME.get(game)!.label} · ${seats} seats · ${tables} tables per experiment · seed ${seed}`)
  console.log(
    `length ${(totals.deals / n).toFixed(1)} ${game === 'liars-dice' ? 'rounds' : 'hands'} · ${(totals.decisions / n).toFixed(0)} decisions · ` +
      `${(totals.thinkMs / totals.decisions / 1000).toFixed(2)}s think each (~${((totals.thinkMs / n / 60_000) * 1.25).toFixed(1)} min a table with pauses) · ` +
      `${(totals.ms / totals.decisions).toFixed(2)} ms compute per decision`,
  )
  console.log(`illegal actions ${totals.illegal} · hidden-info leaks ${totals.leaks}`)
  const fair = 1 / seats
  const line = (name: string, t: Tally, extra = '') =>
    console.log(
      `  ${pad(name, 16)} win ${pad(`${((100 * t.wins) / t.tables).toFixed(1)}%`, 6)} (fair ${(100 * fair).toFixed(0)}%) · cash ${pad(`${((100 * t.cashes) / t.tables).toFixed(1)}%`, 6)} · ` +
        `avg place ${(t.placeSum / t.tables).toFixed(2)} · net ${pad(`${(t.prize / t.tables / buyIn >= 0 ? '+' : '')}${((100 * t.prize) / t.tables / buyIn).toFixed(0)}%`, 5)} of buy-in${extra}`,
    )
  console.log('Tiers (Shark vs Rookie):')
  for (const [k, t] of Object.entries(tiers)) line(k, t)
  console.log('Styles (all Regular):')
  for (const [k, t] of Object.entries(styles).sort((a, b) => a[1].placeSum / a[1].tables - b[1].placeSum / b[1].tables)) {
    line(k as BotStyle, t, ` · ${describeHabits(game, t.habits)}`)
  }
  return totals
}

// ── Cash tables ──

/** Bot-only cash sessions: win rate by skill, churn, illegal actions and chip conservation. */
function runCash<S, V, A>(game: TableGameName, def: CashTableDef<S, V, A>, tables: number, seed: number, stakeId: CashStakeId) {
  const seats = TABLE_GAME_BY_NAME.get(game)!.seats
  const stake = cashStakeFor(game, stakeId)
  const unit = stakeUnit(game, stake)
  const hands = game === 'liars-dice' ? 40 : 300
  const totals = { hands: 0, decisions: 0, illegal: 0, conservation: 0, sit: 0, leave: 0, topUp: 0, wagered: 0, playersNet: 0, ms: 0 }
  const bySkill: Record<string, { net: number; hands: number; stints: number }> = {}
  const byStyle: Record<string, { net: number; hands: number; stints: number }> = {}
  for (let t = 0; t < tables; t++) {
    const started = performance.now()
    const r = playCashTable(def, game, stake, seats, seed * 1000 + 900_000 + t, hands)
    totals.ms += performance.now() - started
    totals.hands += r.hands
    totals.decisions += r.decisions
    totals.illegal += r.illegal
    totals.conservation += r.conservationErrors
    totals.sit += r.churn.sit
    totals.leave += r.churn.leave
    totals.topUp += r.churn.topUp
    totals.wagered += r.wagered
    totals.playersNet += r.playersNet
    for (const st of r.stints) {
      const k = (bySkill[st.skill] ??= { net: 0, hands: 0, stints: 0 })
      k.net += st.net
      k.hands += st.hands
      k.stints++
      const y = (byStyle[st.style] ??= { net: 0, hands: 0, stints: 0 })
      y.net += st.net
      y.hands += st.hands
      y.stints++
    }
  }
  const per = game === 'liars-dice' ? 'game' : '100 hands'
  const rate = (x: { net: number; hands: number }) =>
    game === 'liars-dice' ? (x.net / unit / Math.max(1, x.hands)).toFixed(2) : ((100 * x.net) / unit / Math.max(1, x.hands)).toFixed(1)
  const unitName = game === 'holdem' ? 'big blinds' : game === 'liars-dice' ? 'antes' : 'minimum bets'
  console.log(`\n━━ ${TABLE_GAME_BY_NAME.get(game)!.cash.label} cash · ${stake.label} (${limitsLabel(game, stake)}) · ${seats} seats · ${tables} sessions of ${hands} ${game === 'liars-dice' ? 'games' : 'hands'} · seed ${seed}`)
  console.log(`illegal actions ${totals.illegal} · chip conservation errors ${totals.conservation} · ${(totals.ms / Math.max(1, totals.decisions)).toFixed(2)} ms compute per decision`)
  console.log(`churn per session: ${(totals.sit / tables).toFixed(1)} arrivals · ${(totals.leave / tables).toFixed(1)} departures · ${(totals.topUp / tables).toFixed(1)} top ups`)
  if (game === 'blackjack-showdown') {
    console.log(`house edge ${((-100 * totals.playersNet) / Math.max(1, totals.wagered)).toFixed(2)}% of ${formatNum(totals.wagered)} wagered`)
  }
  console.log(`By skill (${unitName} per ${per}):`)
  for (const [k, x] of Object.entries(bySkill)) console.log(`  ${pad(k, 10)} ${pad(rate(x), 7)} over ${x.hands} ${game === 'liars-dice' ? 'games' : 'hands'} in ${x.stints} stints`)
  console.log(`By style (${unitName} per ${per}):`)
  for (const [k, x] of Object.entries(byStyle).sort((a, b) => b[1].net / Math.max(1, b[1].hands) - a[1].net / Math.max(1, a[1].hands))) {
    console.log(`  ${pad(k, 10)} ${pad(rate(x), 7)} over ${x.hands} ${game === 'liars-dice' ? 'games' : 'hands'}`)
  }
  return totals
}

const formatNum = (n: number) => Math.round(n).toLocaleString('en-US')

const args = process.argv.slice(2)
const seedFlag = args.indexOf('--seed')
const seed = seedFlag >= 0 ? Number(args[seedFlag + 1]) : 1
const valueAt = new Set([args.indexOf('--seed'), args.indexOf('--stake')].filter((i) => i >= 0).map((i) => i + 1))
const positional = args.filter((a, i) => !a.startsWith('--') && !valueAt.has(i))
const which = (positional[0] ?? 'all') as TableGameName | 'all'
const count = positional[1] ? Number(positional[1]) : undefined
const cashMode = args.includes('--cash')
const stakeFlag = args.indexOf('--stake')
const stakeId = (stakeFlag >= 0 ? args[stakeFlag + 1] : 'low') as CashStakeId

let bad = 0
if (cashMode) {
  if (which === 'all' || which === 'holdem') {
    const t = runCash('holdem', holdemCashDef, count ?? 12, seed, stakeId)
    bad += t.illegal + t.conservation
  }
  if (which === 'all' || which === 'liars-dice') {
    const t = runCash('liars-dice', liarsCashDef, count ?? 60, seed, stakeId)
    bad += t.illegal + t.conservation
  }
  if (which === 'all' || which === 'blackjack-showdown') {
    const t = runCash('blackjack-showdown', showdownCashDef, count ?? 60, seed, stakeId)
    bad += t.illegal + t.conservation
  }
} else {
if (which === 'all' || which === 'holdem') {
  const t = run('holdem', holdemDef, count ?? 60, seed, twinHoldem, habitsHoldem)
  bad += t.illegal + t.leaks
}
if (which === 'all' || which === 'liars-dice') {
  const t = run('liars-dice', liarsDef, count ?? 1000, seed, twinLiars, habitsLiars)
  bad += t.illegal + t.leaks
}
if (which === 'all' || which === 'blackjack-showdown') {
  const t = run('blackjack-showdown', showdownDef, count ?? 1000, seed, twinShowdown, habitsShowdown)
  bad += t.illegal + t.leaks
}
}
if (bad) {
  console.error(`\n${bad} illegal actions or leaks`)
  process.exit(1)
}
