'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRng } from '@/utils/rng'
import { createMind } from '@/lib/bots/core'
import type { Bot, BotMind, SeatReads } from '@/lib/bots/types'
import { churnCashRun, openCashRun, type CashEvent, type CashRun } from '@/lib/tables/cash'
import type { CashTableDef, TableDef } from '@/lib/tables/defs'
import type { CashStake } from '@/lib/tables/stakes'
import type { Standings, TableGameName } from '@/lib/tables/types'

/** A cash table's controls and session figures (null at tournaments). */
export interface CashControls {
  /** Chips behind (not in a pot or at risk), plus a top up waiting for the next hand. */
  stack: number
  /** A top up waiting for the next hand. */
  pendingTopUp: number
  hands: number
  /** Nothing behind and not in a hand: you sit out until you top up or leave. */
  broke: boolean
  /** In a hand right now (leaving needs a confirm). */
  inPlay: boolean
  /** Asked to leave; waiting for the hand to settle (Blackjack). */
  leaving: boolean
  /** Set once you have stood up: the stack you leave with. */
  left: { stack: number; hands: number } | null
  /** Arrivals, departures and top ups, newest first, with the hand they happened before. */
  events: (CashEvent & { id: number; hand: number })[]
  leave: () => void
  /** Adds chips before the next hand (the wallet side is the caller's). */
  topUp: (amount: number) => void
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
  /** Who sits where (null: you, or an empty cash seat). Changes at cash tables. */
  bots: (Bot | null)[]
  cash: CashControls | null
}

interface CashOpts<S, V, A> {
  def: CashTableDef<S, V, A>
  game: TableGameName
  stake: CashStake
  /** What the human sits down with. */
  humanStack: number
}

interface Core<S> {
  state: S
  bots: (Bot | null)[]
  run: CashRun<S> | null
  pendingTopUp: number
  leaving: boolean
  left: { stack: number; hands: number } | null
  events: (CashEvent & { id: number; hand: number })[]
}

const MEMORY_KEY = 'floored-tables-opponent-memory'
const EVENTS_KEPT = 30

/**
 * Plays a table in the browser: deals with the seeded RNG, waits on the human
 * seat (with a turn timer: a stall checks or folds), and lets each bot think
 * for its own think time before it decides from its seat's view.
 *
 * Cash tables (`cash`): the runner seats everyone, runs the bots' comings and
 * goings between hands (lib/tables/cash.ts), applies top ups before the next
 * hand, and stands you up when you leave (after the hand settles where the
 * game needs that).
 */
export function useTableRunner<S, V, A>(
  def: TableDef<S, V, A>,
  opts: {
    seats: number
    human: number
    /** One per seat; null for the human. Tournaments only; a cash table seats its own bots. */
    bots: (Bot | null)[]
    /** Separates a bot's saved reads by game. */
    memoryKey?: string
    seed: number
    turnMs: number
    /** Pause before a random step (next deal / next roll), to read the last result. */
    pauseMs: (state: S) => number
    cash?: CashOpts<S, V, A>
  },
): TableRunner<V, A> {
  const { human, turnMs, pauseMs } = opts
  const rng = useRef(createRng(opts.seed))
  const cashOpts = opts.cash
  const ops = cashOpts?.def.ops
  const [core, setCore] = useState<Core<S>>(() => {
    if (!cashOpts) return { state: def.create(opts.seats), bots: opts.bots, run: null, pendingTopUp: 0, leaving: false, left: null, events: [] }
    const run = openCashRun(cashOpts.def, cashOpts.game, cashOpts.stake, opts.seats, human, cashOpts.humanStack, createRng(opts.seed ^ 0x5eed))
    return { state: run.state, bots: run.seats.map((s) => s?.bot ?? null), run, pendingTopUp: 0, leaving: false, left: null, events: [] }
  })
  const { state, bots } = core
  const minds = useRef<BotMind[]>(Array.from({ length: opts.seats }, (_, i) => createMind(i, opts.seats)))
  /** Which bot each mind belongs to: a new bot in a seat starts with a fresh mind. */
  const mindOwner = useRef<string[]>(new Array(opts.seats).fill(''))
  const [thinking, setThinking] = useState<TableRunner<V, A>['thinking']>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [watching, setWatching] = useState(false)
  const engine = def.engine
  const memoryKey = opts.memoryKey ?? 'table'

  const over = engine.isOver(state)
  const seat = engine.toAct(state)
  const place = engine.placeOf(state, human)
  const pace = watching ? 0.35 : 1
  const left = core.left
  const between = ops ? ops.betweenHands(state) : false

  // A bot that sits down recalls what it learned about you at earlier tables.
  useEffect(() => {
    let saved: Record<string, SeatReads> = {}
    try {
      saved = JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? '{}') as Record<string, SeatReads>
    } catch { /* Continue with an empty memory if browser storage is unavailable. */ }
    bots.forEach((bot, i) => {
      const id = bot?.profile.id ?? ''
      if (mindOwner.current[i] === id) return
      mindOwner.current[i] = id
      if (cashOpts) minds.current[i] = createMind(i, opts.seats)
      if (!bot) return
      const reads = saved[`${memoryKey}:${bot.profile.id}`]
      if (reads) minds.current[i]!.reads[human] = { ...minds.current[i]!.reads[human]!, ...reads }
    })
  }, [bots, human, memoryKey, cashOpts, opts.seats])

  // Bots observe public actions, then retain their read on you if they return in a later table.
  useEffect(() => {
    if (bots.some((bot, i) => (bot?.profile.id ?? '') !== mindOwner.current[i])) return
    bots.forEach((bot, i) => {
      if (bot) def.policy.observe(engine.viewFor(state, i), bot, minds.current[i]!)
    })
    try {
      const saved = JSON.parse(window.localStorage.getItem(MEMORY_KEY) ?? '{}') as Record<string, SeatReads>
      bots.forEach((bot, i) => {
        if (bot) saved[`${memoryKey}:${bot.profile.id}`] = minds.current[i]!.reads[human]!
      })
      window.localStorage.setItem(MEMORY_KEY, JSON.stringify(saved))
    } catch { /* The table remains playable without persistent reads. */ }
  }, [state, bots, def, engine, human, memoryKey])

  /** Cash, between hands: top up, churn the bots, then deal if the table can. */
  const cashStep = useCallback(
    (c: Core<S>): Core<S> => {
      if (!cashOpts || !ops || !c.run || c.left || !ops.betweenHands(c.state)) return c
      let s = c.state
      if (c.pendingTopUp > 0) s = ops.addChips(s, human, c.pendingTopUp)
      let run: CashRun<S> = { ...c.run, state: s }
      let events = c.events
      const hand = ops.handsPlayed(s)
      if (hand > 0) {
        const churned = churnCashRun(cashOpts.def, cashOpts.game, cashOpts.stake, run, human, rng.current)
        run = churned.run
        if (churned.events.length) {
          const base = (events[0]?.id ?? 0) + 1
          const added = churned.events.map((e, k) => ({ ...e, id: base + k, hand }))
          events = [...added.reverse(), ...events].slice(0, EVENTS_KEPT)
        }
      }
      s = run.state
      if (engine.needsAdvance(s)) s = engine.advance(s, rng.current)
      return { ...c, state: s, run: { ...run, state: s }, bots: run.seats.map((x) => x?.bot ?? null), pendingTopUp: 0, events }
    },
    [cashOpts, ops, human, engine],
  )

  // Leaving with a hand still to settle (Blackjack): stand up once it has.
  useEffect(() => {
    if (!ops || !core.leaving || core.left || !between) return
    setCore((c) => {
      if (!c.leaving || c.left || !ops.betweenHands(c.state)) return c
      const stood = ops.stand(c.state, human)
      return { ...c, state: stood.state, left: { stack: stood.stack + c.pendingTopUp, hands: ops.handsPlayed(c.state) } }
    })
  }, [ops, core.leaving, core.left, between, human])

  useEffect(() => {
    if (over || left || core.leaving && between) return
    let timer: ReturnType<typeof setTimeout> | undefined
    if (ops && between) {
      // Cash: the next hand (with any comings and goings) after the usual pause.
      timer = setTimeout(() => setCore(cashStep), pauseMs(state) * pace)
    } else if (engine.needsAdvance(state)) {
      timer = setTimeout(
        () => setCore((c) => (engine.needsAdvance(c.state) ? { ...c, state: engine.advance(c.state, rng.current) } : c)),
        pauseMs(state) * pace,
      )
    } else if (seat === human) {
      if (core.leaving) {
        // Leaving once the hand settles: every decision left is a stand.
        timer = setTimeout(() => setCore((c) => (engine.toAct(c.state) === human ? { ...c, state: engine.apply(c.state, human, engine.timeoutAction(c.state, human)) } : c)), 300)
      } else {
        const at = Date.now() + turnMs
        setDeadline(at)
        timer = setTimeout(
          () => setCore((c) => (engine.toAct(c.state) === human ? { ...c, state: engine.apply(c.state, human, engine.timeoutAction(c.state, human)) } : c)),
          turnMs,
        )
      }
    } else if (seat != null) {
      const bot = bots[seat]
      if (!bot) return
      const view = engine.viewFor(state, seat)
      const ms = Math.round(def.policy.thinkMs(view, bot, rng.current) * pace)
      setThinking({ seat, ms, at: Date.now() + ms })
      timer = setTimeout(() => {
        const action = def.policy.decide(view, bot, minds.current[seat]!, rng.current)
        setCore((c) => {
          if (engine.toAct(c.state) !== seat) return c
          try {
            return { ...c, state: engine.apply(c.state, seat, action) }
          } catch {
            return { ...c, state: engine.apply(c.state, seat, engine.timeoutAction(c.state, seat)) }
          }
        })
      }, ms)
    }
    return () => {
      if (timer) clearTimeout(timer)
      setThinking(null)
      setDeadline(null)
    }
  }, [state, seat, over, left, core.leaving, between, ops, cashStep, human, bots, def, engine, turnMs, pauseMs, pace])

  const act = useCallback(
    (action: A) =>
      setCore((c) => {
        if (c.leaving || engine.toAct(c.state) !== human) return c
        try {
          return { ...c, state: engine.apply(c.state, human, action) }
        } catch {
          // The dock only offers legal moves; a stale click is ignored.
          return c
        }
      }),
    [engine, human],
  )

  const leave = useCallback(() => {
    if (!ops) return
    setCore((c) => {
      if (c.left || c.leaving) return c
      // Fold / give up the dice / sit out before betting, as the game allows.
      let s = ops.inPlay(c.state, human) ? ops.leaveAction(c.state, human) : c.state
      // Still in play (a Blackjack bet is down): stand when the hand settles.
      if (ops.inPlay(s, human)) return { ...c, state: s, leaving: true }
      const stood = ops.stand(s, human)
      s = stood.state
      return { ...c, state: s, left: { stack: stood.stack + c.pendingTopUp, hands: ops.handsPlayed(s) } }
    })
  }, [ops, human])

  const topUp = useCallback((amount: number) => {
    const chips = Math.floor(amount)
    if (chips < 1) return
    setCore((c) => (c.left || c.leaving ? c : { ...c, pendingTopUp: c.pendingTopUp + chips }))
  }, [])

  const view = useMemo(() => engine.viewFor(state, human), [engine, state, human])
  const standings = useMemo(() => engine.standings(state), [engine, state])

  const cash = useMemo<CashControls | null>(() => {
    if (!ops) return null
    const behind = left ? 0 : ops.stackBehind(state, human)
    return {
      stack: left ? left.stack : behind + core.pendingTopUp,
      pendingTopUp: core.pendingTopUp,
      hands: ops.handsPlayed(state),
      broke: !left && behind <= 0 && core.pendingTopUp <= 0 && !ops.inPlay(state, human),
      inPlay: !left && ops.inPlay(state, human),
      leaving: core.leaving,
      left,
      events: core.events,
      leave,
      topUp,
    }
  }, [ops, state, human, left, core.pendingTopUp, core.leaving, core.events, leave, topUp])

  return { view, standings, yourTurn: seat === human && !over && !core.leaving && !left, act, thinking, deadline, place, over, watching, setWatching, bots, cash }
}
