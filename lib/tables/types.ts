/**
 * Tables mode: multi-seat casino games against bots. The table games are not
 * `GameName`s on purpose, so they never reach the Freeplay lobby, Survival,
 * the Ladder or the Daily (see .md/BOT_TABLES_HANDOFF.md).
 */
export type TableGameName = 'holdem' | 'liars-dice' | 'blackjack-showdown'

/** Stakes tier; bot skill follows it (Rookie → Regular → Shark). */
export type TableTier = 'rookie' | 'regular' | 'shark'

/** A source of uniform numbers in [0, 1) — `createRng(seed)` from utils/rng.ts. */
export type Rng = () => number

/**
 * Finishing order of a table, best first. Each entry is a group of seats that
 * tied for that place (they share the prizes of the places they cover).
 */
export type Standings = number[][]

/**
 * The contract every table engine meets, so one runner (the UI hook and the
 * simulation harness) can drive all three games.
 *
 * - `apply` is pure and deterministic; illegal actions throw.
 * - Anything random (a shuffle, a dice roll) happens in `advance`, which the
 *   runner calls when `needsAdvance` is true (between hands / rounds).
 * - `viewFor` strips everything the seat could not see; bots only ever get a view.
 */
export interface TableEngine<State, View, Action> {
  viewFor: (state: State, seat: number) => View
  /** Seat whose decision is pending, or null (between hands, or the table is over). */
  toAct: (state: State) => number | null
  apply: (state: State, seat: number, action: Action) => State
  /** True when the table waits on a random step (next hand, next round). */
  needsAdvance: (state: State) => boolean
  advance: (state: State, rng: Rng) => State
  /** What a seat that stalls does: check if it can, else fold / call / the smallest legal move. */
  timeoutAction: (state: State, seat: number) => Action
  isOver: (state: State) => boolean
  /** Places decided so far for seats that are out; full order once the table is over. */
  standings: (state: State) => Standings
  /** Place (1-based) of a seat once it is decided (out, or the table is over), else null. */
  placeOf: (state: State, seat: number) => number | null
}
