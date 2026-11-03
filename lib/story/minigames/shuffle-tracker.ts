import { pick, type Rng } from './rng'

/** Shuffle Tracker (Pike): follow the queen through the swaps. Score = right / ROUNDS. */
export const ROUNDS = 5
export const CUPS = 3
/** Swaps per round and how long one swap takes (ms), getting harder each round. */
export const SWAPS = [4, 6, 8, 10, 12] as const
export const SWAP_MS = [700, 560, 440, 340, 260] as const

export interface Shuffle {
  /** The slot (0-2) the queen starts under. */
  queenStart: number
  /** Each swap exchanges the cups standing in two slots. */
  swaps: [number, number][]
  /** The slot the queen ends in. */
  queenEnd: number
}

export function makeShuffle(rng: Rng, round: number): Shuffle {
  const queenStart = pick(rng, CUPS)
  const swaps: [number, number][] = []
  let prev = ''
  for (let i = 0; i < SWAPS[round]!; i++) {
    // Pick two distinct slots; avoid repeating the same pair back to back.
    let a = 0
    let b = 0
    let key = prev
    while (key === prev) {
      a = pick(rng, CUPS)
      b = (a + 1 + pick(rng, CUPS - 1)) % CUPS
      key = [Math.min(a, b), Math.max(a, b)].join('-')
    }
    prev = key
    swaps.push([a, b])
  }
  let q = queenStart
  for (const [a, b] of swaps) q = q === a ? b : q === b ? a : q
  return { queenStart, swaps, queenEnd: q }
}

export interface TrackerState {
  round: number
  right: number
  shuffle: Shuffle
  /** The slot picked this round, or null while following. */
  picked: number | null
  over: boolean
}

export function start(rng: Rng): TrackerState {
  return { round: 0, right: 0, shuffle: makeShuffle(rng, 0), picked: null, over: false }
}

/** Records the pick for this round. */
export function guess(state: TrackerState, slot: number): { state: TrackerState; correct: boolean } {
  if (state.over || state.picked != null) return { state, correct: false }
  const correct = slot === state.shuffle.queenEnd
  return { state: { ...state, picked: slot, right: state.right + (correct ? 1 : 0) }, correct }
}

/** Moves on after a pick: the next round, or over. */
export function next(state: TrackerState, rng: Rng): TrackerState {
  if (state.round + 1 >= ROUNDS) return { ...state, over: true }
  return { ...state, round: state.round + 1, shuffle: makeShuffle(rng, state.round + 1), picked: null }
}

export const score = (state: TrackerState) => state.right / ROUNDS
