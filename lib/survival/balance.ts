import type { Difficulty, GameName } from '@/store/types'

/** Dev/testing: grant every shop upgrade when a survival run starts. Set false before release. */
export const GRANT_ALL_UPGRADES = false

/** Dev/testing: bankroll and sparks when a survival run starts (and idle reset). */
export const STARTING_BANKROLL = 1000
export const STARTING_SPARKS = 20

/** Dev/testing: starting reroll tickets granted in inventory for a run */
export const STARTING_REROLL_TICKETS = 3
/** How many reroll tickets are awarded automatically when advancing to the next floor */
export const REROLL_TICKETS_PER_FLOOR = 2

/** Cap on combined game + run payout boost multiplier applied to wins. */
export const RAW_PAYOUT_MULT_CAP = 1.5

/** Max bonus sparks from exceeding floor quota. */
export const OVER_QUOTA_SPARK_MAX = 10

export const MAX_FLOORS = 10
export const FLOOR_BET_LIMIT = 10
export const FLOOR_UNSEEN_WEIGHT = 3
export const FLOOR_OWNED_WEIGHT = 2
export const FLOOR_REPEAT_WEIGHT = 0.5
export const FLOOR_MAX_APPEARANCES = 5

/**
 * Games with a registered survival route. Kept in sync with GAMES and the
 * game registry; availableSurvival controls lobby display only.
 */
export const SURVIVAL_GAME_POOL: GameName[] = [
  'blackjack',
  'crash',
  'plinko',
  'over-under',
  'wheel',
  'run-dice',
  'mines',
  'chicken-road',
  'slots',
  'roulette',
  'dragon-tower',
  'chicken-race',
  'street-cups',
  'case-battles',
  'poker-1p',
  'hilo',
  'keno',
  'coin-flip',
  'deck-countdown',
  'tower-of-cards',
  'baccarat',
]

export const DIFFICULTY_QUOTA_MULT: Record<Difficulty, number> = {
  normal: 1.0,
  hard: 1.5,
  nightmare: 2.5,
}

/**
 * Multiplier on shop upgrade/consumable prices (see calcShopPrice).
 * Harder runs demand more sparks per purchase.
 */
export const DIFFICULTY_SHOP_PRICE_MULT: Record<Difficulty, number> = {
  normal: 1.0,
  hard: 1.5,
  nightmare: 2.0,
}

/**
 * Absolute bankroll goal for a given floor.
 * Floors 1–10: 2000 * 500^((floor-1)/9)  →  $2K … $1M
 * Endless (11+): $1M * 1.6^(floor-10)    →  much steeper per-floor ramp
 */
export function calcQuotaTarget(floor: number, difficulty: Difficulty): number {
  const base =
    floor <= MAX_FLOORS
      ? Math.round(2_000 * Math.pow(500, (floor - 1) / 9))
      : Math.round(1_000_000 * Math.pow(1.6, floor - MAX_FLOORS))
  return Math.round(base * DIFFICULTY_QUOTA_MULT[difficulty])
}

/** Sparks cost for a catalog item after difficulty scaling. */
export function calcShopPrice(baseCost: number, difficulty: Difficulty): number {
  return Math.ceil(baseCost * DIFFICULTY_SHOP_PRICE_MULT[difficulty])
}

/** Base + step × rerolls already used this floor, scaled by difficulty. */
export function calcRerollCost(
  base: number,
  step: number,
  rerollsUsed: number,
  difficulty: Difficulty,
): number {
  return Math.ceil((base + step * rerollsUsed) * DIFFICULTY_SHOP_PRICE_MULT[difficulty])
}

export const SHOP_REROLL_BASE = 5
export const SHOP_REROLL_STEP = 4
export const MISSION_REROLL_BASE = 4
export const MISSION_REROLL_STEP = 3

export function calcShopRerollCost(rerollsUsed: number, difficulty: Difficulty): number {
  return calcRerollCost(SHOP_REROLL_BASE, SHOP_REROLL_STEP, rerollsUsed, difficulty)
}

export function calcMissionRerollCost(rerollsUsed: number, difficulty: Difficulty): number {
  return calcRerollCost(MISSION_REROLL_BASE, MISSION_REROLL_STEP, rerollsUsed, difficulty)
}

/**
 * Spark reward multiplier per floor.
 * Floors 1–10: linear 1.0× … 2.8× (same as before).
 * Endless (11+): accelerates to match steeper quota curve.
 */
export function sparkFloorMult(floor: number): number {
  if (floor <= 10) return 1 + (floor - 1) * 0.2
  return 2.8 + (floor - 10) * 0.5
}
