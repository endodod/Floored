import { BOT_ROSTER } from '@/lib/bots/roster'
import type { Bot, BotSkill } from '@/lib/bots/types'
import type { CashTableDef } from './defs'
import { BOT_SIT_RANGE, CHURN, type CashStake } from './stakes'
import type { Rng, TableGameName } from './types'
import { formatChips } from '@/utils/format'

/**
 * Cash tables: who sits where, and the bots coming and going between hands
 * (.md/TABLES_CASH_HANDOFF.md 1.4). Pure and seeded, so the browser runner and
 * the bot simulation play exactly the same churn.
 */

/** A bot in a cash seat, and the stack it sat down with (it tops up to that). */
export interface CashSeat {
  bot: Bot
  sitStack: number
}

export interface CashRun<S> {
  state: S
  /** One per seat; null for the human's seat and for empty seats. */
  seats: (CashSeat | null)[]
  /** Empty bot seats: hands (games) left until a new bot sits down; 0 when not waiting. */
  refillIn: number[]
  /** Chips the bots brought to the table (sits and top ups) and took away (leaving). Bots' bankrolls are unlimited. */
  botIn: number
  botOut: number
}

export interface CashEvent {
  seat: number
  kind: 'sit' | 'leave' | 'top-up'
  name: string
  chips: number
}

/** The stake's unit: the big blind, the ante, or the minimum bet. */
export function stakeUnit(game: TableGameName, stake: CashStake): number {
  if (game === 'holdem') return stake.limits.blinds?.[1] ?? 10
  if (game === 'liars-dice') return stake.limits.ante ?? 50
  return stake.limits.bets?.[0] ?? 10
}

/** A bot's sit-down stack: a whole number of units, uniform over the game's range. */
export function drawSitStack(game: TableGameName, stake: CashStake, rng: Rng): number {
  const [lo, hi] = BOT_SIT_RANGE[game]
  return (lo + Math.floor(rng() * (hi - lo + 1))) * stakeUnit(game, stake)
}

/** A roster bot not already at the table, with a fresh skill. */
export function drawBot(seats: (CashSeat | null)[], rng: Rng): Bot {
  const taken = new Set(seats.flatMap((s) => (s ? [s.bot.profile.id] : [])))
  const pool = BOT_ROSTER.filter((p) => !taken.has(p.id))
  const profile = pool[Math.floor(rng() * pool.length)]!
  const skill: BotSkill = (['rookie', 'regular', 'shark'] as const)[Math.floor(rng() * 3)]!
  return { profile, skill }
}

/** An empty table at this stake, the human (if any) at `human` with `humanStack`, every other seat a bot. */
export function openCashRun<S, V, A>(
  def: CashTableDef<S, V, A>,
  game: TableGameName,
  stake: CashStake,
  seats: number,
  human: number | null,
  humanStack: number,
  rng: Rng,
): CashRun<S> {
  let state = def.createCash(seats, stake)
  const run: CashRun<S> = { state, seats: new Array(seats).fill(null), refillIn: new Array(seats).fill(0), botIn: 0, botOut: 0 }
  for (let seat = 0; seat < seats; seat++) {
    if (seat === human) {
      state = def.ops.sit(state, seat, humanStack, false)
      continue
    }
    const bot = drawBot(run.seats, rng)
    const sitStack = drawSitStack(game, stake, rng)
    state = def.ops.sit(state, seat, sitStack, false)
    run.seats[seat] = { bot, sitStack }
    run.botIn += sitStack
  }
  return { ...run, state }
}

const botCount = (seats: (CashSeat | null)[]) => seats.filter(Boolean).length

/**
 * Between hands (games): bots at 0 leave, winners and anyone may leave, short
 * stacks may top up, empty seats fill after 1–3 hands, and the table never drops
 * below two bots. Only seats that aren't the human's are touched.
 */
export function churnCashRun<S, V, A>(
  def: CashTableDef<S, V, A>,
  game: TableGameName,
  stake: CashStake,
  run: CashRun<S>,
  human: number | null,
  rng: Rng,
): { run: CashRun<S>; events: CashEvent[] } {
  const perGame = game === 'liars-dice'
  const leaveWhenUp = perGame ? CHURN.leaveWhenUpGame : CHURN.leaveWhenUp
  const leaveAny = perGame ? CHURN.leaveAnyGame : CHURN.leaveAny
  const [refillLo, refillHi] = CHURN.refillAfter
  const drawRefill = () => refillLo + Math.floor(rng() * (refillHi - refillLo + 1))
  let { state, botIn, botOut } = run
  const seats = [...run.seats]
  const refillIn = [...run.refillIn]
  const events: CashEvent[] = []
  const justLeft = new Set<number>()

  const fill = (seat: number) => {
    const bot = drawBot(seats, rng)
    const sitStack = drawSitStack(game, stake, rng)
    state = def.ops.sit(state, seat, sitStack, true)
    seats[seat] = { bot, sitStack }
    refillIn[seat] = 0
    botIn += sitStack
    events.push({ seat, kind: 'sit', name: bot.profile.name, chips: sitStack })
  }

  // Leaving and topping up. Every bot rolls both dice each time, so a seed replays.
  for (let seat = 0; seat < seats.length; seat++) {
    const here = seats[seat]
    if (seat === human || !here) continue
    const stack = def.ops.stackBehind(state, seat)
    const up = rng() < leaveWhenUp
    const any = rng() < leaveAny
    const topUp = rng() < CHURN.topUp
    if (stack <= 0 || (stack > 2 * here.sitStack && up) || any) {
      const stood = def.ops.stand(state, seat)
      state = stood.state
      botOut += stood.stack
      seats[seat] = null
      refillIn[seat] = drawRefill()
      justLeft.add(seat)
      events.push({ seat, kind: 'leave', name: here.bot.profile.name, chips: stood.stack })
    } else if (stack < here.sitStack / 2 && topUp) {
      const add = here.sitStack - stack
      state = def.ops.addChips(state, seat, add)
      botIn += add
      events.push({ seat, kind: 'top-up', name: here.bot.profile.name, chips: add })
    }
  }

  // Empty seats fill after their wait of 1–3 hands (a seat that just emptied starts waiting now).
  for (let seat = 0; seat < seats.length; seat++) {
    if (seat === human || seats[seat] || justLeft.has(seat)) continue
    if (refillIn[seat]! > 1) refillIn[seat]!--
    else fill(seat)
  }

  // Never fewer than two bots.
  for (let seat = 0; seat < seats.length && botCount(seats) < 2; seat++) {
    if (seat !== human && !seats[seat]) fill(seat)
  }

  return { run: { state, seats, refillIn, botIn, botOut }, events }
}

/** The hand-history line for an arrival, a departure or a top up (name and chips only, never a style). */
export function cashEventText(e: CashEvent): string {
  if (e.kind === 'sit') return `${e.name} sits down with ${formatChips(e.chips)}`
  if (e.kind === 'leave') return `${e.name} leaves with ${formatChips(e.chips)}`
  return `${e.name} tops up ${formatChips(e.chips)}`
}
