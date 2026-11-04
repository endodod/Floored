import { pick, type Rng } from './rng'

/**
 * Chip Count (Jo): a stack of mixed chips comes across the felt; tap its total
 * before the clock runs out. Five rounds, each stack bigger and the clock
 * shorter. A wrong total or running out of time loses that round only; the
 * shift always plays all five. Score = rounds counted right / ROUNDS.
 */
export const CHIPS = [
  { value: 1, label: '1', chip: '#e9e6df', ink: '#1d1c21' },
  { value: 5, label: '5', chip: '#b83a50', ink: '#f4f1ea' },
  { value: 25, label: '25', chip: '#2f8a62', ink: '#f4f1ea' },
  { value: 100, label: '100', chip: '#1b1a1f', ink: '#d9a441' },
] as const

export const ROUNDS = 5
/** Chips in the stack for a 0-based round: 4, 5, 6, 7, 8. */
export const stackSize = (round: number) => 4 + round
/** Seconds on the clock for a 0-based round: 9, 8, 7, 6, 5. */
export const roundSeconds = (round: number) => 9 - round
/** Answers offered each round (the right one among them). */
export const OPTIONS = 4

export interface ChipCountState {
  /** 0-based round being played. */
  round: number
  /** The stack, as indices into CHIPS, largest first (how a dealer would cut it). */
  stack: number[]
  /** The totals to choose from, in ascending order; one is right. */
  options: number[]
  answer: number
  correct: number
  over: boolean
}

export const total = (stack: number[]) => stack.reduce((sum, i) => sum + CHIPS[i]!.value, 0)

/**
 * Wrong totals that look right: the stack with one chip swapped for its neighbour
 * denomination, or one chip more or fewer. Never the answer, never repeated, never below 1.
 */
function nearMisses(rng: Rng, stack: number[], answer: number): number[] {
  const deltas = new Set<number>()
  for (const i of stack) {
    if (i > 0) deltas.add(CHIPS[i - 1]!.value - CHIPS[i]!.value)
    if (i < CHIPS.length - 1) deltas.add(CHIPS[i + 1]!.value - CHIPS[i]!.value)
    deltas.add(CHIPS[i]!.value)
    deltas.add(-CHIPS[i]!.value)
  }
  const pool = [...deltas].map((d) => answer + d).filter((v) => v > 0 && v !== answer)
  const out: number[] = []
  while (out.length < OPTIONS - 1 && pool.length) {
    const [v] = pool.splice(pick(rng, pool.length), 1)
    if (!out.includes(v!)) out.push(v!)
  }
  return out
}

export function deal(rng: Rng, round: number): Pick<ChipCountState, 'stack' | 'options' | 'answer'> {
  const stack = Array.from({ length: stackSize(round) }, () => pick(rng, CHIPS.length)).sort((a, b) => b - a)
  const answer = total(stack)
  const options = [answer, ...nearMisses(rng, stack, answer)].sort((a, b) => a - b)
  return { stack, options, answer }
}

export function start(rng: Rng): ChipCountState {
  return { round: 0, ...deal(rng, 0), correct: 0, over: false }
}

export type CallResult = 'right' | 'wrong' | 'ignored'

/** A called total, or null when the clock ran out. Deals the next round, or ends the shift after the last. */
export function call(state: ChipCountState, value: number | null, rng: Rng): { state: ChipCountState; result: CallResult } {
  if (state.over) return { state, result: 'ignored' }
  const right = value === state.answer
  const correct = state.correct + (right ? 1 : 0)
  const round = state.round + 1
  const next: ChipCountState = round >= ROUNDS ? { ...state, correct, over: true } : { round, ...deal(rng, round), correct, over: false }
  return { state: next, result: right ? 'right' : 'wrong' }
}

export const score = (state: ChipCountState) => state.correct / ROUNDS
