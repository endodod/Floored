import { createRng } from '@/utils/rng'
import { createMind } from '@/lib/bots/core'
import type { Bot, BotSkill } from '@/lib/bots/types'
import type { ShowdownState } from '@/games/blackjack-showdown/types'
import { churnCashRun, openCashRun, type CashRun } from './cash'
import type { CashTableDef, TableDef } from './defs'
import type { CashStake } from './stakes'
import type { Standings, TableGameName } from './types'

export interface SimResult<S = unknown> {
  final: S
  standings: Standings
  /** Hands / rounds dealt. */
  deals: number
  decisions: number
  /** Bot actions the engine rejected (each replaced by the timeout action). */
  illegal: number
  /** Decisions whose view changed when hidden information was reshuffled (must stay 0). */
  leaks: number
  /** Total think time the bots would have shown, ms. */
  thinkMs: number
}

/**
 * Plays one bot-only table to the end, headless and seeded. `twin` (optional)
 * returns a copy of the state with all hidden information re-drawn; the view
 * each bot decides from must not change, or the bot could see too much.
 */
export function playBotTable<S, V, A>(
  def: TableDef<S, V, A>,
  bots: Bot[],
  seed: number,
  opts: { maxSteps?: number; twin?: (state: S, seat: number, rng: () => number) => S; leakCheckEvery?: number } = {},
): SimResult<S> {
  const rng = createRng(seed)
  // Separate stream for the leak check, so checking doesn't change how the table plays.
  const twinRng = createRng(seed ^ 0x9e3779b9)
  const minds = bots.map((_, i) => createMind(i, bots.length))
  let state = def.create(bots.length)
  const result: SimResult<S> = { final: state, standings: [], deals: 0, decisions: 0, illegal: 0, leaks: 0, thinkMs: 0 }
  const maxSteps = opts.maxSteps ?? 50_000

  for (let step = 0; step < maxSteps && !def.engine.isOver(state); step++) {
    if (def.engine.needsAdvance(state)) {
      state = def.engine.advance(state, rng)
      result.deals++
    } else {
      const seat = def.engine.toAct(state)
      if (seat == null) throw new Error('Table stuck: nobody to act and nothing to deal')
      const view = def.engine.viewFor(state, seat)
      if (opts.twin && result.decisions % (opts.leakCheckEvery ?? 1) === 0) {
        const other = def.engine.viewFor(opts.twin(state, seat, twinRng), seat)
        if (JSON.stringify(other) !== JSON.stringify(view)) result.leaks++
      }
      const bot = bots[seat]!
      result.thinkMs += def.policy.thinkMs(view, bot, rng)
      const action = def.policy.decide(view, bot, minds[seat]!, rng)
      result.decisions++
      try {
        state = def.engine.apply(state, seat, action)
      } catch {
        result.illegal++
        state = def.engine.apply(state, seat, def.engine.timeoutAction(state, seat))
      }
    }
    bots.forEach((bot, i) => def.policy.observe(def.engine.viewFor(state, i), bot, minds[i]!))
  }
  if (!def.engine.isOver(state)) throw new Error(`Table did not finish in ${maxSteps} steps`)
  result.standings = def.engine.standings(state)
  result.final = state
  return result
}

// ── Cash tables ──────────────────────────────────────────────────────────────

export interface CashSimResult<S = unknown> {
  final: S
  /** Hands (Liar's Dice: games) dealt. */
  hands: number
  decisions: number
  illegal: number
  /** Times the chips on the table didn't match what the bots brought minus what they took (must stay 0). */
  conservationErrors: number
  churn: { sit: number; leave: number; topUp: number }
  /** Per stint (a bot from sitting down to leaving, or to the end): skill, chips won or lost, hands played. */
  stints: { skill: BotSkill; style: string; net: number; hands: number }[]
  /** Blackjack: total bet and the players' net against the house. */
  wagered: number
  playersNet: number
}

/**
 * Plays one bot-only cash table for `hands` hands (games), with the bots coming
 * and going exactly as at a browser table (lib/tables/cash.ts). Checks chip
 * conservation between every hand: the chips on the table equal what the bots
 * brought in minus what they took away, plus (Blackjack) what they won from the house.
 */
export function playCashTable<S, V, A>(
  def: CashTableDef<S, V, A>,
  game: TableGameName,
  stake: CashStake,
  seats: number,
  seed: number,
  hands: number,
  opts: { maxSteps?: number } = {},
): CashSimResult<S> {
  const rng = createRng(seed)
  let run: CashRun<S> = openCashRun(def, game, stake, seats, null, 0, rng)
  const minds = Array.from({ length: seats }, (_, i) => createMind(i, seats))
  const owner = run.seats.map((s) => s?.bot.profile.id ?? '')
  const stint = run.seats.map((s) => (s ? { chipsIn: s.sitStack, from: 0 } : null))
  const result: CashSimResult<S> = { final: run.state, hands: 0, decisions: 0, illegal: 0, conservationErrors: 0, churn: { sit: 0, leave: 0, topUp: 0 }, stints: [], wagered: 0, playersNet: 0 }
  const maxSteps = opts.maxSteps ?? hands * 400
  const ops = def.ops
  let settledHand = 0

  const onTable = (state: S) => run.seats.reduce((sum, s, i) => sum + (s ? ops.stackBehind(state, i) : 0), 0)
  const closeStint = (seat: number, chipsOut: number, hand: number) => {
    const s = stint[seat]
    const bot = run.seats[seat]
    if (!s || !bot) return
    result.stints.push({ skill: bot.bot.skill, style: bot.bot.profile.style, net: chipsOut - s.chipsIn, hands: hand - s.from })
    stint[seat] = null
  }

  for (let step = 0; step < maxSteps; step++) {
    let state = run.state
    const hand = ops.handsPlayed(state)
    if (ops.betweenHands(state)) {
      if (game === 'blackjack-showdown' && hand > settledHand) {
        // Count the house's side of the hand once, before anyone leaves.
        const sd = state as unknown as ShowdownState
        sd.seats.forEach((x) => {
          if (!x.empty && !x.idle && x.bet > 0) {
            result.wagered += x.bet
            result.playersNet += x.net
          }
        })
        settledHand = hand
      }
      if (onTable(state) !== run.botIn - run.botOut + result.playersNet) result.conservationErrors++
      if (hand >= hands) break
      if (hand > 0) {
        const before = run.seats.map((s) => s)
        const churned = churnCashRun(def, game, stake, run, null, rng)
        for (const e of churned.events) {
          if (e.kind === 'leave') {
            run = { ...run, seats: before }
            closeStint(e.seat, e.chips, hand)
            result.churn.leave++
          } else if (e.kind === 'sit') {
            stint[e.seat] = { chipsIn: e.chips, from: hand }
            result.churn.sit++
          } else {
            stint[e.seat]!.chipsIn += e.chips
            result.churn.topUp++
          }
        }
        run = churned.run
        state = run.state
        run.seats.forEach((s, i) => {
          const id = s?.bot.profile.id ?? ''
          if (owner[i] !== id) {
            owner[i] = id
            minds[i] = createMind(i, seats)
          }
        })
      }
      if (def.engine.needsAdvance(state)) {
        state = def.engine.advance(state, rng)
        result.hands = ops.handsPlayed(state)
      }
      run = { ...run, state }
      continue
    }
    if (def.engine.needsAdvance(state)) {
      run = { ...run, state: def.engine.advance(state, rng) }
      continue
    }
    const seat = def.engine.toAct(state)
    if (seat == null) throw new Error('Cash table stuck: nobody to act and nothing to deal')
    const bot = run.seats[seat]?.bot
    if (!bot) throw new Error(`Cash table: seat ${seat} acts but nobody sits there`)
    const view = def.engine.viewFor(state, seat)
    const action = def.policy.decide(view, bot, minds[seat]!, rng)
    result.decisions++
    try {
      state = def.engine.apply(state, seat, action)
    } catch {
      result.illegal++
      state = def.engine.apply(state, seat, def.engine.timeoutAction(state, seat))
    }
    run = { ...run, state }
    run.seats.forEach((s, i) => {
      if (s) def.policy.observe(def.engine.viewFor(state, i), s.bot, minds[i]!)
    })
  }
  const end = ops.handsPlayed(run.state)
  run.seats.forEach((s, i) => {
    if (s) closeStint(i, ops.stackBehind(run.state, i), end)
  })
  result.final = run.state
  return result
}
