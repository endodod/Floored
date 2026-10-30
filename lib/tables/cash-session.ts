import { BOT_ROSTER } from '@/lib/bots/roster'
import type { Bot, BotSkill } from '@/lib/bots/types'
import { BOT_SIT_RANGE, CHURN, type CashStake } from './stakes'
import type { CashTableOps, Rng, TableGameName } from './types'

/**
 * Cash-table seating outside the engines: what bots sit down with, and the
 * churn between hands (games in Liar's Dice) — departures, top-ups and new
 * arrivals. Pure and driven by the table RNG, so a seed replays; used by the
 * browser runner and the bot simulation alike. Numbers: TABLES_CASH_HANDOFF.md 1.4.
 */

export interface CashSeating {
  /** One per seat; null for the human seat and for empty seats. */
  bots: (Bot | null)[]
  /** What each bot sat down with this time (its top-up target). */
  sitStacks: number[]
  /** Hands until an empty seat is filled; 0 when the seat is taken. */
  refillIn: number[]
}

export interface CashEvent {
  seat: number
  name: string
  kind: 'sit' | 'leave' | 'top-up'
  /** Chips brought, taken away, or added. */
  amount: number
}

/** The chip unit a stake is counted in: the big blind, the ante, or the minimum bet. */
export function stakeUnit(game: TableGameName, stake: CashStake): number {
  if (game === 'holdem') return stake.limits.blinds?.[1] ?? 10
  if (game === 'liars-dice') return stake.limits.ante ?? 50
  return stake.limits.bets?.[0] ?? 10
}

/** A bot's stack when it sits down: uniform over BOT_SIT_RANGE units of the stake. */
export function botSitStack(game: TableGameName, stake: CashStake, rng: Rng): number {
  const [lo, hi] = BOT_SIT_RANGE[game]
  return (lo + Math.floor(rng() * (hi - lo + 1))) * stakeUnit(game, stake)
}

/** A bot from the roster that isn't at the table, with a fresh skill draw. */
export function pickBot(rng: Rng, seated: (Bot | null)[]): Bot {
  const taken = new Set(seated.filter(Boolean).map((b) => b!.profile.id))
  const pool = BOT_ROSTER.filter((p) => !taken.has(p.id))
  const profile = pool[Math.floor(rng() * pool.length)] ?? BOT_ROSTER[0]!
  const skill: BotSkill = (['rookie', 'regular', 'shark'] as const)[Math.floor(rng() * 3)]!
  return { profile, skill }
}

/** The opening table: the human at `human` with their chips, a bot in every other seat. */
export function openCashTable<S>(
  ops: CashTableOps<S>,
  empty: S,
  game: TableGameName,
  stake: CashStake,
  human: number,
  humanStack: number,
  bots: (Bot | null)[],
  rng: Rng,
): { state: S; seating: CashSeating } {
  let state = ops.sit(empty, human, humanStack, false)
  const sitStacks = bots.map(() => 0)
  bots.forEach((bot, seat) => {
    if (!bot || seat === human) return
    sitStacks[seat] = botSitStack(game, stake, rng)
    state = ops.sit(state, seat, sitStacks[seat]!, false)
  })
  return { state, seating: { bots: [...bots], sitStacks, refillIn: bots.map(() => 0) } }
}

/**
 * One churn step, between hands. Bots with no chips leave; a bot up more than
 * twice its stack may leave; any bot may leave now and then; a short bot may
 * top up. Empty seats fill after 1–3 hands, and never fewer than two bots stay.
 */
export function churnCash<S>(
  ops: CashTableOps<S>,
  state: S,
  seating: CashSeating,
  game: TableGameName,
  stake: CashStake,
  human: number,
  rng: Rng,
): { state: S; seating: CashSeating; events: CashEvent[] } {
  const perGame = game === 'liars-dice'
  const bots = [...seating.bots]
  const sitStacks = [...seating.sitStacks]
  const refillIn = [...seating.refillIn]
  const events: CashEvent[] = []

  const sitNew = (seat: number) => {
    const bot = pickBot(rng, bots)
    const stack = botSitStack(game, stake, rng)
    state = ops.sit(state, seat, stack, true)
    bots[seat] = bot
    sitStacks[seat] = stack
    refillIn[seat] = 0
    events.push({ seat, name: bot.profile.name, kind: 'sit', amount: stack })
  }

  bots.forEach((bot, seat) => {
    if (!bot || seat === human) return
    const stack = ops.stackBehind(state, seat)
    const up = stack > 2 * sitStacks[seat]!
    const leaves =
      stack <= 0 ||
      (up && rng() < (perGame ? CHURN.leaveWhenUpGame : CHURN.leaveWhenUp)) ||
      rng() < (perGame ? CHURN.leaveAnyGame : CHURN.leaveAny)
    if (leaves) {
      const out = ops.stand(state, seat)
      state = out.state
      bots[seat] = null
      sitStacks[seat] = 0
      const [lo, hi] = CHURN.refillAfter
      refillIn[seat] = lo + Math.floor(rng() * (hi - lo + 1))
      events.push({ seat, name: bot.profile.name, kind: 'leave', amount: out.stack })
      return
    }
    if (stack < sitStacks[seat]! / 2 && rng() < CHURN.topUp) {
      const add = sitStacks[seat]! - stack
      state = ops.addChips(state, seat, add)
      events.push({ seat, name: bot.profile.name, kind: 'top-up', amount: add })
    }
  })

  // Empty seats count down and fill; seats emptied this step start counting next time.
  const leftNow = new Set(events.filter((e) => e.kind === 'leave').map((e) => e.seat))
  bots.forEach((bot, seat) => {
    if (bot || seat === human || leftNow.has(seat)) return
    refillIn[seat] = Math.max(0, refillIn[seat]! - 1)
    if (refillIn[seat] === 0) sitNew(seat)
  })

  // Never fewer than two bots: fill at once if churn emptied the table.
  for (let seat = 0; seat < bots.length && bots.filter(Boolean).length < 2; seat++) {
    if (!bots[seat] && seat !== human) sitNew(seat)
  }

  return { state, seating: { bots, sitStacks, refillIn }, events }
}
