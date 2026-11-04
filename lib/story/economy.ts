/**
 * Story mode ("The Circuit") money rules. Every amount is in multiples of the
 * current city's minimum bet (`m`), so one set of numbers covers all twelve
 * cities. The reasoning and the simulated results are in .md/STORY_MODE_PLAN.md
 * section 5; `pnpm sim:story` checks these numbers against its targets.
 */

/** Money you start the circuit with, in dollars (40 × Dustwater's $5 minimum bet). */
export const START_MONEY = 200

/** A night at a venue: up to this many bets across its games (or one Tables session). */
export const NIGHT_BETS = 12

/** Lodging, paid every night (playing or resting); taken down to $0, never into debt. */
export const LODGING_M = 3
/** Below this you sleep in your car: no lodging, so a broke player climbs back in a few nights. */
export const CAR_BELOW_M = 10

/** A minigame pays up to this at a perfect score; each character's minigame once per night. */
export const MINIGAME_MAX_M = 3

/**
 * Jobs (owner decision 2026-11-04, lib/story/jobs.ts): people in a town hand them
 * out one at a time. Each night in a town one new offer turns up at someone who
 * holds none, while the town has fewer than JOB_LIMIT (offered or taken). Every
 * job pays JOB_PAY_M.min to JOB_PAY_M.max minimum bets and earns JOB_STANDING.
 */
export const JOB_LIMIT = 3
export const JOB_PAY_M = { min: 3, max: 5 } as const

/**
 * Standing: how a town sees you, 0 to STANDING_MAX, kept per town (the map is in
 * store/story-store.ts). It rises by JOB_STANDING for every finished job,
 * drops by BUST_STANDING when you go bust, and opens the better rooms.
 */
export const JOB_STANDING = 1
export const BUST_STANDING = 1
export const STANDING_MAX = 5

/** The standing each room asks for: dive, main floor, high-roller room. */
export const VENUE_REP: readonly [number, number, number] = [0, 1, 3]

/**
 * The standing bonus, by standing 0–STANDING_MAX: end a night up at the tables and
 * the house adds this share of the night's table winnings (payouts less stakes) on
 * top. Standing 1 and 3 open rooms; 2, 4 and 5 raise the bonus to 5%, 10% and 20%,
 * so standing keeps paying once every room is open (owner decision 2026-11-04).
 */
export const STANDING_BONUS: readonly number[] = [0, 0, 0.05, 0.05, 0.1, 0.2]
/** The standings that raise the bonus (each one higher than the last). */
export const BONUS_STEPS: readonly number[] = STANDING_BONUS.flatMap((r, i) => (i > 0 && r > STANDING_BONUS[i - 1]! ? [i] : []))
/** The bonus a night's table result earns at a standing: nothing on a night down or even. */
export function standingBonus(standing: number, tableWinnings: number): number {
  const rate = STANDING_BONUS[Math.max(0, Math.min(STANDING_MAX, Math.floor(standing)))] ?? 0
  return tableWinnings > 0 ? Math.round(rate * tableWinnings) : 0
}

/** Jobs board: hustles offered per night (met by playing), and their fixed pay. */
export const HUSTLES_PER_NIGHT = 2
export const HUSTLE_PAY_M = 4

/** Comps by room (dive, main floor, high-roller): a share of everything you bet in a night comes back, win or lose, capped per night. */
export const COMPS_RATE: readonly [number, number, number] = [0.04, 0.05, 0.06]
export const COMPS_CAP_M: readonly [number, number, number] = [10, 15, 20]

/** Each room draws this many of the city's games each night (see lib/story/rotation.ts). */
export const GAMES_PER_ROOM = 4

/** Venue table limits: dive, main floor, high-roller room (null = no maximum). */
export const VENUE_MAX_M: readonly [number, number, number | null] = [20, 100, null]

/** Boss showdown: buy-in, purse on a win, and the nights before a rematch after a loss (no easier rematch). */
export const BOSS_BUYIN_M = 50
export const BOSS_PURSE_M = 150
export const BOSS_REMATCH_NIGHTS = 2

/** Travel to the next city costs this many of the NEXT city's minimum bets. */
export const TRAVEL_FARE_M = 20

/** The Notary's marker after a bust: size, what you repay, and the share of each win's profit that goes to it. */
export const MARKER_M = 20
export const MARKER_REPAY = 1.5
export const MARKER_GARNISH = 0.5
/** Each further marker in the same city costs this much more to repay. */
export const MARKER_REPAY_STEP = 0.25

/** In multiples of m: the dollars a multiple stands for in a city. */
export function dollars(m: number, minBet: number): number {
  return Math.round(m * minBet)
}
