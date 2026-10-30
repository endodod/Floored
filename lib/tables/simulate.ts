import { createRng } from '@/utils/rng'
import { createMind } from '@/lib/bots/core'
import type { Bot } from '@/lib/bots/types'
import { seatBots } from '@/lib/bots/core'
import { botSitStack, churnCash, type CashSeating } from './cash-session'
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

/** One bot's time in a seat: what it brought (sit + top-ups), took away, and how long it stayed. */
export interface CashSitting {
  bot: Bot
  brought: number
  left: number
  deals: number
}

export interface CashSimResult<S = unknown> {
  final: S
  sittings: CashSitting[]
  deals: number
  decisions: number
  illegal: number
  /** Chips bots brought (sits and top-ups) and took away when they left. */
  brought: number
  takenAway: number
  /** Chips at the table at the end (between hands, so no pot). */
  onTable: number
  arrivals: number
  departures: number
  topUps: number
}

/**
 * Plays a bot-only cash table for `deals` hands (games in Liar's Dice), headless
 * and seeded, with the same churn the browser runs between hands. Every chip a
 * bot brings or takes is booked, so callers can check that none appear or vanish.
 */
export function playCashTable<S, V, A>(
  def: CashTableDef<S, V, A>,
  game: TableGameName,
  stake: CashStake,
  seats: number,
  seed: number,
  deals: number,
  onAction?: (view: V, action: A) => void,
): CashSimResult<S> {
  const rng = createRng(seed)
  const ops = def.ops
  const bots = seatBots(seats, rng)
  let state = def.createCash(seats, stake)
  let seating: CashSeating = { bots: [...bots], sitStacks: bots.map(() => 0), refillIn: bots.map(() => 0) }
  const open = new Map<number, CashSitting>()
  const result: CashSimResult<S> = { final: state, sittings: [], deals: 0, decisions: 0, illegal: 0, brought: 0, takenAway: 0, onTable: 0, arrivals: 0, departures: 0, topUps: 0 }
  bots.forEach((bot, seat) => {
    const stack = botSitStack(game, stake, rng)
    state = ops.sit(state, seat, stack, false)
    seating.sitStacks[seat] = stack
    result.brought += stack
    open.set(seat, { bot, brought: stack, left: 0, deals: 0 })
  })
  const minds = bots.map((_, i) => createMind(i, seats))

  let idle = 0
  for (let step = 0; result.deals < deals || !ops.betweenHands(state); step++) {
    if (step > deals * 2000) throw new Error('Cash table did not progress')
    if (ops.betweenHands(state) && result.deals > 0 && idle === 0) {
      const churned = churnCash(ops, state, seating, game, stake, -1, rng)
      state = churned.state
      seating = churned.seating
      for (const e of churned.events) {
        if (e.kind === 'leave') {
          const s = open.get(e.seat)!
          s.left = e.amount
          result.sittings.push(s)
          open.delete(e.seat)
          result.takenAway += e.amount
          result.departures++
        } else if (e.kind === 'sit') {
          open.set(e.seat, { bot: seating.bots[e.seat]!, brought: e.amount, left: 0, deals: 0 })
          minds[e.seat] = createMind(e.seat, seats)
          result.brought += e.amount
          result.arrivals++
        } else {
          open.get(e.seat)!.brought += e.amount
          result.brought += e.amount
          result.topUps++
        }
      }
      idle = 1
    }
    if (def.engine.needsAdvance(state)) {
      const wasBetween = ops.betweenHands(state)
      state = def.engine.advance(state, rng)
      if (wasBetween) {
        result.deals++
        idle = 0
        for (const s of open.values()) s.deals++
      }
    } else {
      const seat = def.engine.toAct(state)
      if (seat == null) {
        if (!ops.betweenHands(state)) throw new Error('Cash table stuck: nobody to act and nothing to deal')
        idle = 0
        continue
      }
      const view = def.engine.viewFor(state, seat)
      const bot = seating.bots[seat]!
      const action = def.policy.decide(view, bot, minds[seat]!, rng)
      onAction?.(view, action)
      result.decisions++
      try {
        state = def.engine.apply(state, seat, action)
      } catch {
        result.illegal++
        state = def.engine.apply(state, seat, def.engine.timeoutAction(state, seat))
      }
    }
    seating.bots.forEach((bot, i) => {
      if (bot) def.policy.observe(def.engine.viewFor(state, i), bot, minds[i]!)
    })
  }
  for (const [seat, s] of open) {
    s.left = ops.stackBehind(state, seat)
    result.sittings.push(s)
    result.onTable += s.left
  }
  result.final = state
  return result
}
