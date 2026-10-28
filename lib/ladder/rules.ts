import type { GameName } from '@/store/types'

/** One rung per game — reaching the top uses every game exactly once. */
export const LADDER_RUNGS = 18
export const CHECKPOINT_EVERY = 3
/** Multiplier a round must reach to clear a rung, per section of three rungs. */
export const SECTION_TARGETS = [1.5, 2, 2.5, 3, 4, 5] as const
export const START_POT = 100
export const LADDER_LIVES = 3
/** Pot multiplier for clearing the final rung. */
export const TOP_BONUS = 2

/**
 * Highest round multiplier each game can pay with a single all-in stake.
 * `Infinity` = streak / cash-out games with no practical cap; `null` = depends on the round (Run Dice).
 */
export const GAME_MAX_MULT: Record<GameName, number | null> = {
  'blackjack':    2.5,
  'crash':        30,
  'plinko':       100,
  'over-under':   9.2,
  'wheel':        5,
  'run-dice':     null,
  'mines':        Infinity,
  'chicken-road': 40,
  'slots':        50,
  'roulette':     36,
  'dragon-tower': 5.38,
  'chicken-race': 3.6,
  'street-cups':  2,
  'case-battles': 12,
  'poker-1p':     800,
  'hilo':         Infinity,
  'keno':         10,
  'coin-flip':    Infinity,
}

/** Target for the rung being climbed, where `rung` is the number of rungs already cleared. */
export function rungTarget(rung: number): number {
  const section = Math.min(Math.floor(rung / CHECKPOINT_EVERY), SECTION_TARGETS.length - 1)
  return SECTION_TARGETS[section]!
}

/** Highest checkpoint at or below `rung` (0 = the ground). */
export function lastCheckpoint(rung: number): number {
  return Math.floor(rung / CHECKPOINT_EVERY) * CHECKPOINT_EVERY
}

export function isCheckpoint(rung: number): boolean {
  return rung > 0 && rung % CHECKPOINT_EVERY === 0
}

export function canReachTarget(game: GameName, target: number): boolean {
  const max = GAME_MAX_MULT[game]
  return max == null || max >= target
}

/**
 * Whether `games` can still cover every rung from `rung` to the top:
 * pair the biggest targets with the biggest max multipliers.
 */
export function canReachTop(games: GameName[], rung: number): boolean {
  const targets: number[] = []
  for (let r = rung; r < LADDER_RUNGS; r++) targets.push(rungTarget(r))
  if (games.length < targets.length) return false
  const maxes = games.map((g) => GAME_MAX_MULT[g] ?? Infinity).sort((a, b) => b - a)
  targets.sort((a, b) => b - a)
  return targets.every((t, i) => maxes[i]! >= t)
}

export function formatMaxMult(game: GameName): string {
  const max = GAME_MAX_MULT[game]
  if (max == null) return 'varies'
  if (max === Infinity) return '∞'
  return `${max}×`
}
