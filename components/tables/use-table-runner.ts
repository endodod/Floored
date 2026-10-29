'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRng } from '@/utils/rng'
import { createMind } from '@/lib/bots/core'
import type { Bot, BotMind } from '@/lib/bots/types'
import type { TableDef } from '@/lib/tables/defs'
import type { Standings } from '@/lib/tables/types'

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
}

/**
 * Plays a table in the browser: deals with the seeded RNG, waits on the human
 * seat (with a turn timer: a stall checks or folds), and lets each bot think
 * for its own think time before it decides from its seat's view.
 */
export function useTableRunner<S, V, A>(
  def: TableDef<S, V, A>,
  opts: {
    seats: number
    human: number
    /** One per seat; null for the human. */
    bots: (Bot | null)[]
    seed: number
    turnMs: number
    /** Pause before a random step (next deal / next roll), to read the last result. */
    pauseMs: (state: S) => number
  },
): TableRunner<V, A> {
  const { human, bots, turnMs, pauseMs } = opts
  const [state, setState] = useState<S>(() => def.create(opts.seats))
  const rng = useRef(createRng(opts.seed))
  const minds = useRef<BotMind[]>(Array.from({ length: opts.seats }, (_, i) => createMind(i, opts.seats)))
  const [thinking, setThinking] = useState<TableRunner<V, A>['thinking']>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [watching, setWatching] = useState(false)
  const engine = def.engine

  const over = engine.isOver(state)
  const seat = engine.toAct(state)
  const place = engine.placeOf(state, human)
  const pace = watching ? 0.35 : 1

  // Every bot reads the table after each step (public information only).
  useEffect(() => {
    bots.forEach((bot, i) => {
      if (bot) def.policy.observe(engine.viewFor(state, i), bot, minds.current[i]!)
    })
  }, [state, bots, def, engine])

  useEffect(() => {
    if (over) return
    let timer: ReturnType<typeof setTimeout> | undefined
    if (engine.needsAdvance(state)) {
      timer = setTimeout(() => setState((s) => (engine.needsAdvance(s) ? engine.advance(s, rng.current) : s)), pauseMs(state) * pace)
    } else if (seat === human) {
      const at = Date.now() + turnMs
      setDeadline(at)
      timer = setTimeout(() => setState((s) => (engine.toAct(s) === human ? engine.apply(s, human, engine.timeoutAction(s, human)) : s)), turnMs)
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
  }, [state, seat, over, human, bots, def, engine, turnMs, pauseMs, pace])

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

  const view = useMemo(() => engine.viewFor(state, human), [engine, state, human])
  const standings = useMemo(() => engine.standings(state), [engine, state])

  return { view, standings, yourTurn: seat === human && !over, act, thinking, deadline, place, over, watching, setWatching }
}
