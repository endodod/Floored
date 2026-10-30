import type { GameName } from '@/store/types'

/** 18 rungs, one game each; with more games than rungs, some are left over each climb. */
export const LADDER_RUNGS = 18
export const CHECKPOINT_EVERY = 3
export const START_POT = 100
export const LADDER_LIVES = 3
/** Pot multiplier for clearing the final rung. */
export const TOP_BONUS = 2

/**
 * Highest round multiplier each game can pay with a single all-in stake — shown in the picker,
 * since any profit clears a rung but bigger wins grow the pot faster.
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
  'street-cups':  2.5,
  'case-battles': 12,
  'poker-1p':     800,
  'hilo':         Infinity,
  'keno':         100,
  'coin-flip':    Infinity,
  'deck-countdown': 9178.56,
  'tower-of-cards': 756.92,
}

export function isCheckpoint(rung: number): boolean {
  return rung > 0 && rung % CHECKPOINT_EVERY === 0
}

export function formatMaxMult(game: GameName): string {
  const max = GAME_MAX_MULT[game]
  if (max == null) return 'varies'
  if (max === Infinity) return '∞'
  return `${max}×`
}
