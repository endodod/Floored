/**
 * Story mode ("The Circuit") money rules. Every amount is in multiples of the
 * current city's minimum bet (`m`), so one set of numbers covers all seven
 * cities. The reasoning and the simulated results are in .md/STORY_MODE_PLAN.md
 * section 5; `pnpm sim:story` checks these numbers against its targets.
 */

/** Money you start the circuit with, in dollars (40 × Dustwater's $5 minimum bet). */
export const START_MONEY = 200

/**
 * Where you sleep (owner decision 2026-11-04): you choose every night, playing or
 * resting. The car is free (every city, for now) and gives CAR_BETS the next night; a
 * room costs 3m in the first city (Dustwater) and 4m after, and gives ROOM_BETS. Paid
 * down to $0, never into debt; a room you can't afford can't be chosen. The room also
 * wants the town to know you: standing SLEEP_REP.room (owner decision 2026-11-05). A
 * new story starts with START_BETS.
 */
export type SleepPlace = 'car' | 'room'
export const CAR_BETS = 5
export const ROOM_BETS = 10
export const START_BETS = CAR_BETS
/** The most bets a night can have (the room's). */
export const NIGHT_BETS = ROOM_BETS
/** Sleep costs in m: [first city, every city after]. */
export const SLEEP_COST_M: Record<SleepPlace, readonly [number, number]> = { car: [0, 0], room: [3, 4] }
export const SLEEP_BETS: Record<SleepPlace, number> = { car: CAR_BETS, room: ROOM_BETS }
/** The standing each place to sleep asks for (the motel only rents to people the town knows). */
export const SLEEP_REP: Record<SleepPlace, number> = { car: 0, room: 2 }
/** What sleeping somewhere costs, in m, in a city (`first`: the first city of the circuit). */
export const sleepCostM = (place: SleepPlace, first: boolean) => SLEEP_COST_M[place][first ? 0 : 1]

/**
 * Jobs (owner decisions 2026-11-04, lib/story/jobs.ts): each night in a town a
 * minigame job and a table job turn up at people who hold none, while the town
 * holds fewer than JOB_LIMIT (offered or taken). A table job pays TABLE_JOB_PAY_M
 * minimum bets and earns JOB_STANDING. A minigame job (one attempt: hit the target
 * or lose the job) pays more, MINIGAME_JOB_PAY_M, and earns no standing. Minigames
 * are only played as jobs: no practice and no other pay.
 */
export const JOB_LIMIT = 3
/**
 * An offer nobody takes leaves after this many nights (its giver can then offer again).
 * One: offers name games dealt that night, so an offer never outlives its night.
 */
export const JOB_OFFER_NIGHTS = 1
export const TABLE_JOB_PAY_M = { min: 3, max: 5 } as const
export const MINIGAME_JOB_PAY_M = { min: 6, max: 8 } as const
/** The pay range for a kind of job. */
export const jobPayM = (kind: 'minigame' | 'table') => (kind === 'minigame' ? MINIGAME_JOB_PAY_M : TABLE_JOB_PAY_M)

/**
 * Standing: how a town sees you, 0 to STANDING_MAX, kept per town (the map is in
 * store/story-store.ts). It rises by JOB_STANDING for every finished table job,
 * drops by MARKER_STANDING when you borrow from the town's lender (Pike in Dustwater;
 * going broke on its own costs none; owner decision 2026-11-04), and opens the better rooms.
 */
export const JOB_STANDING = 1
export const MARKER_STANDING = 1
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
export const BOSS_BUYIN_M = 100
export const BOSS_PURSE_M = 300
export const BOSS_REMATCH_NIGHTS = 2

/**
 * A loan (a "marker") from the town's lender, any time: its size, what you repay, and the
 * share of each win's profit that goes to it. Owing DEBT_WARN_M or more brings a warning
 * that offers a fresh start (the story itself can't be lost).
 */
export const MARKER_M = 20
export const MARKER_REPAY = 1.5
export const MARKER_GARNISH = 0.5
/** Each further marker in the same city costs this much more to repay. */
export const MARKER_REPAY_STEP = 0.25
export const DEBT_WARN_M = 100

/** Marta's diner: a plate costs MEAL_M and adds MEAL_BETS to tonight's bets, once a night. */
export const MEAL_M = 2
export const MEAL_BETS = 2

/** In multiples of m: the dollars a multiple stands for in a city. */
export function dollars(m: number, minBet: number): number {
  return Math.round(m * minBet)
}
