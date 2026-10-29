import { createRng } from '@/utils/rng'
import { createMind } from '@/lib/bots/core'
import type { Bot } from '@/lib/bots/types'
import type { TableDef } from './defs'
import type { Standings } from './types'

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
