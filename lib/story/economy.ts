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

/** One-time story errands per city, and what each pays. */
export const ERRANDS_PER_CITY = 4
export const ERRAND_PAY_M = 6

/** Jobs board: hustles offered per night (met by playing), and their fixed pay. */
export const HUSTLES_PER_NIGHT = 2
export const HUSTLE_PAY_M = 4

/** Comps by room (dive, main floor, high-roller): a share of everything you bet in a night comes back, win or lose, capped per night. */
export const COMPS_RATE: readonly [number, number, number] = [0.04, 0.05, 0.06]
export const COMPS_CAP_M: readonly [number, number, number] = [10, 15, 20]

/** Each room draws this many of the city's games each night (see lib/story/rotation.ts). */
export const GAMES_PER_ROOM = 3

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
