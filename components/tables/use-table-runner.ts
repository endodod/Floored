'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRng } from '@/utils/rng'
import { createMind } from '@/lib/bots/core'
import type { Bot, BotMind, SeatReads } from '@/lib/bots/types'
import type { TableDef } from '@/lib/tables/defs'
import { churnCash, openCashTable, type CashEvent, type CashSeating } from '@/lib/tables/cash-session'
import type { CashStake } from '@/lib/tables/stakes'
import type { CashTableOps, Standings, TableGameName } from '@/lib/tables/types'

/** A cash table's arrivals and departures, for the hand history. */
export interface CashLogEntry extends CashEvent {
  id: string
  at: Date
}

export interface CashRunner {
  /** Who sits where now (bots come and go); null for you and for empty seats. */
  bots: (Bot | null)[]
  /** Your chips not in play right now. */
  stack: number
  /** Between hands (games in Liar's Dice): seats may change, top-ups are allowed. */
  betweenHands: boolean
  /** You're in the hand in progress, so leaving folds / stands / gives up your dice first. */
  inPlay: boolean
  /** You asked to leave during a Blackjack hand; you go when it settles. */
  leaving: boolean
  /** Out of chips: top up or leave. */
  broke: boolean
  log: CashLogEntry[]
  /** Leave the table; `onLeave` gets the chips you leave with (at once, or when the hand settles). */
  leave: () => void
  /** Add chips between hands (move them out of the wallet first). */
  topUp: (amount: number) => boolean
}

export interface TableRunner<V, A> {
  /** What the human seat may see — the board renders from this only. */
  view: V
  /** True while it's your turn. */
  yourTurn: boolean
  act: (action: A) => void
  /** The seat currently thinking, and when its decision lands. */
  thinking: { seat: number; ms: number; at: number } | null
  /** When your turn times out (ms timestamp), or null. */
  deadline: number | null
  /** Finishing groups so far (public: who is out, in what order). */
  standings: Standings
  /** Your place once decided (out, or the table is over). */
  place: number | null
  over: boolean
  /** Watching after you're out: bots play faster. */
  watching: boolean
  setWatching: (on: boolean) => void
  /** Cash tables only. */
  cash: CashRunner | null
}

const MEMORY_KEY = 'floored-tables-opponent-memory'

/**
 * Plays a table in the browser: deals with the seeded RNG, waits on the human
 * seat (with a turn timer: a stall checks or folds), and lets each bot think
 * for its own think time before it decides from its seat's view.
 *
 * Cash tables (`opts.cash`) also seat everyone at the start, run the bot churn
 * between hands (`lib/tables/cash-session.ts`), keep your chips synced
 * (`onStack`), and handle leaving and topping up by each engine's rules.
 */
export function useTableRunner<S, V, A>(
  def: TableDef<S, V, A>,
  opts: {
    seats: number
    human: number
    /** One per seat; null for the human. */
    bots: (Bot | null)[]
    /** Separates a bot's saved reads by game (and format). */
    memoryKey?: string
    seed: number
    turnMs: number
    /** Pause before a random step (next deal / next roll), to read the last result. */
    pauseMs: (state: S) => number
    cash?: {
      game: TableGameName
      ops: CashTableOps<S>
      createCash: (seats: number, stake: CashStake) => S
      stake: CashStake
      /** Your chips when you sit down. */
      stack: number
      /** Every change to your chips behind and the hands played (for the store). */
      onStack: (stack: number, hands: number) => void
      /** You left with these chips. */
      onLeave: (stack: number) => void
    }
  },
): TableRunner<V, A> {
  const { human, turnMs, pauseMs } = opts
  const cashOpts = opts.cash
  const rng = useRef(createRng(opts.seed))
  const [initial] = useState(() => {
    if (!cashOpts) return { state: def.create(opts.seats), seating: null as CashSeating | null }
    return openCashTable(cashOpts.ops, cashOpts.createCash(opts.seats, cashOpts.stake), cashOpts.game, cashOpts.stake, human, cashOpts.stack, opts.bots, rng.current)
  })
  const [state, setState] = useState<S>(initial.state)
  const [seating, setSeating] = useState<CashSeating | null>(initial.seating)
  const bots = seating ? seating.bots : opts.bots
  const minds = useRef<BotMind[]>(Array.from({ length: opts.seats }, (_, i) => createMind(i, opts.seats)))
  const loadedFor = useRef<(string | null)[]>(Array.from({ length: opts.seats }, () => null))
  const [thinking, setThinking] = useState<TableRunner<V, A>['thinking']>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [watching, setWatching] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [cashLog, setCashLog] = useState<CashLogEntry[]>([])
  const left = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const seatingRef = useRef(seating)
  seatingRef.current = seating
  const engine = def.engine

  const over = engine.isOver(state)
  const seat = engine.toAct(state)
  const place = engine.placeOf(state, human)
  const pace = watching ? 0.35 : 1

  // Load each bot's saved reads on you when it takes its seat (again, after a cash-table seat change).
  useEffect(() => {
    let saved: Record<string, SeatReads> = {}
    try {
      saved = JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? '{}') as Record<string, SeatReads>
    } catch { /* Continue with an empty memory if browser storage is unavailable. */ }
    bots.forEach((bot, i) => {
      const id = bot?.profile.id ?? null
      if (loadedFor.current[i] === id) return
      loadedFor.current[i] = id
      minds.current[i] = createMind(i, opts.seats)
      const reads = bot ? saved[`${opts.memoryKey ?? 'table'}:${bot.profile.id}`] : undefined
      if (reads) minds.current[i]!.reads[human] = { ...minds.current[i]!.reads[human]!, ...reads }
    })
  }, [bots, human, opts.memoryKey, opts.seats])

  // Bots observe public actions, then retain their read on you if they return in a later table.
  useEffect(() => {
    bots.forEach((bot, i) => {
      if (bot && loadedFor.current[i] === bot.profile.id) def.policy.observe(engine.viewFor(state, i), bot, minds.current[i]!)
    })
    try {
      const saved = JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? '{}') as Record<string, SeatReads>
      bots.forEach((bot, i) => {
        if (bot) saved[`${opts.memoryKey ?? 'table'}:${bot.profile.id}`] = minds.current[i]!.reads[human]!
      })
      window.localStorage.setItem(MEMORY_KEY, JSON.stringify(saved))
    } catch { /* The table remains playable without persistent reads. */ }
  }, [state, bots, def, engine, human, opts.memoryKey])

  // Cash: keep the store's copy of your chips current (closing the tab leaves with exactly this).
  const onStack = cashOpts?.onStack
  const stackNow = cashOpts ? cashOpts.ops.stackBehind(state, human) : 0
  const handsNow = cashOpts ? cashOpts.ops.handsPlayed(state) : 0
  useEffect(() => {
    if (!left.current) onStack?.(stackNow, handsNow)
  }, [onStack, stackNow, handsNow])

  const standUp = useCallback(() => {
    if (!cashOpts || left.current) return
    left.current = true
    const { stack } = cashOpts.ops.stand(stateRef.current, human)
    cashOpts.onLeave(stack)
  }, [cashOpts, human])

  const betweenHands = cashOpts ? cashOpts.ops.betweenHands(state) : false

  // Leaving a Blackjack hand in progress: go once it settles.
  useEffect(() => {
    if (leaving && cashOpts && !cashOpts.ops.inPlay(state, human)) standUp()
  }, [leaving, cashOpts, state, human, standUp])

  useEffect(() => {
    if (over || left.current) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const cashTurn = cashOpts && betweenHands
    if (engine.needsAdvance(state) || cashTurn) {
      timer = setTimeout(() => {
        let s = stateRef.current
        // (Not before the first deal: the table opens as it was seated.)
        if (cashOpts && cashOpts.ops.betweenHands(s) && cashOpts.ops.handsPlayed(s) > 0 && seatingRef.current) {
          // Bots come and go between hands, before the next deal.
          const churned = churnCash(cashOpts.ops, s, seatingRef.current, cashOpts.game, cashOpts.stake, human, rng.current)
          s = churned.state
          setSeating(churned.seating)
          if (churned.events.length) {
            const at = new Date()
            setCashLog((log) => [...churned.events.map((e, i) => ({ ...e, id: `${at.getTime()}-${i}`, at })), ...log].slice(0, 80))
          }
        }
        if (engine.needsAdvance(s)) s = engine.advance(s, rng.current)
        setState(s)
      }, pauseMs(state) * pace)
    } else if (seat === human) {
      if (leaving) {
        // On your way out of a Blackjack hand: stand on every remaining decision.
        timer = setTimeout(() => setState((s) => (engine.toAct(s) === human ? engine.apply(s, human, engine.timeoutAction(s, human)) : s)), 300)
      } else {
        const at = Date.now() + turnMs
        setDeadline(at)
        timer = setTimeout(() => setState((s) => (engine.toAct(s) === human ? engine.apply(s, human, engine.timeoutAction(s, human)) : s)), turnMs)
      }
    } else if (seat != null) {
      const bot = bots[seat]
      if (!bot) return
      const view = engine.viewFor(state, seat)
      const ms = Math.round(def.policy.thinkMs(view, bot, rng.current) * pace)
      setThinking({ seat, ms, at: Date.now() + ms })
      timer = setTimeout(() => {
        const action = def.policy.decide(view, bot, minds.current[seat]!, rng.current)
        setState((s) => {
          if (engine.toAct(s) !== seat) return s
          try {
            return engine.apply(s, seat, action)
          } catch {
            return engine.apply(s, seat, engine.timeoutAction(s, seat))
          }
        })
      }, ms)
    }
    return () => {
      if (timer) clearTimeout(timer)
      setThinking(null)
      setDeadline(null)
    }
  }, [state, seat, over, human, bots, def, engine, turnMs, pauseMs, pace, cashOpts, betweenHands, leaving])

  const act = useCallback(
    (action: A) =>
      setState((s) => {
        if (engine.toAct(s) !== human) return s
        try {
          return engine.apply(s, human, action)
        } catch {
          // The dock only offers legal moves; a stale click is ignored.
          return s
        }
      }),
    [engine, human],
  )

  const leave = useCallback(() => {
    if (!cashOpts || left.current) return
    let s = stateRef.current
    if (cashOpts.ops.inPlay(s, human)) s = cashOpts.ops.leaveAction(s, human)
    stateRef.current = s
    setState(s)
    // A Blackjack bet already down plays out; everything else leaves now.
    if (cashOpts.ops.inPlay(s, human)) setLeaving(true)
    else standUp()
  }, [cashOpts, human, standUp])

  const topUp = useCallback(
    (amount: number) => {
      if (!cashOpts || left.current || amount < 1 || !cashOpts.ops.betweenHands(stateRef.current)) return false
      const s = cashOpts.ops.addChips(stateRef.current, human, Math.floor(amount))
      stateRef.current = s
      setState(s)
      return true
    },
    [cashOpts, human],
  )

  const view = useMemo(() => engine.viewFor(state, human), [engine, state, human])
  const standings = useMemo(() => engine.standings(state), [engine, state])

  const cash: CashRunner | null = cashOpts
    ? {
        bots,
        stack: stackNow,
        betweenHands,
        inPlay: cashOpts.ops.inPlay(state, human),
        leaving,
        broke: stackNow <= 0 && !cashOpts.ops.inPlay(state, human),
        log: cashLog,
        leave,
        topUp,
      }
    : null

  return { view, standings, yourTurn: seat === human && !over, act, thinking, deadline, place, over, watching, setWatching, cash }
}
