import { pick, type Rng } from './rng'

/** Last Orders (Marta): remember a growing drink order and tap it back. Score = rounds cleared / ROUNDS. */
export const DRINKS = [
  { id: 'beer', label: 'Beer', glyph: '🍺' },
  { id: 'wine', label: 'Wine', glyph: '🍷' },
  { id: 'coffee', label: 'Coffee', glyph: '☕' },
  { id: 'martini', label: 'Martini', glyph: '🍸' },
  { id: 'milk', label: 'Milk', glyph: '🥛' },
  { id: 'whiskey', label: 'Whiskey', glyph: '🥃' },
] as const

export const ROUNDS = 6
export const FIRST_ORDER = 3
/** Items in the order for a 0-based round: 3, 4, 5, 6, 7, 8. */
export const orderLength = (round: number) => FIRST_ORDER + round

export interface LastOrdersState {
  /** 0-based round being played (equals `cleared` while running). */
  round: number
  /** The drinks (indices into DRINKS) to remember this round. */
  order: number[]
  /** How many of the order the player has tapped correctly so far. */
  pos: number
  cleared: number
  over: boolean
}

export function newOrder(rng: Rng, round: number): number[] {
  return Array.from({ length: orderLength(round) }, () => pick(rng, DRINKS.length))
}

export function start(rng: Rng): LastOrdersState {
  return { round: 0, order: newOrder(rng, 0), pos: 0, cleared: 0, over: false }
}

export type TapResult = 'ok' | 'round' | 'win' | 'miss' | 'ignored'

/** Applies one tap. 'round' = order complete, next round dealt; 'win' = all rounds cleared; 'miss' = game over. */
export function tap(state: LastOrdersState, drink: number, rng: Rng): { state: LastOrdersState; result: TapResult } {
  if (state.over) return { state, result: 'ignored' }
  if (state.order[state.pos] !== drink) return { state: { ...state, over: true }, result: 'miss' }
  const pos = state.pos + 1
  if (pos < state.order.length) return { state: { ...state, pos }, result: 'ok' }
  const cleared = state.cleared + 1
  if (cleared >= ROUNDS) return { state: { ...state, pos, cleared, over: true }, result: 'win' }
  return { state: { round: state.round + 1, order: newOrder(rng, state.round + 1), pos: 0, cleared, over: false }, result: 'round' }
}

export const score = (state: LastOrdersState) => state.cleared / ROUNDS
