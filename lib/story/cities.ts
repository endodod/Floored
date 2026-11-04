import type { GameName } from '@/store/types'
import type { TableGameName } from '@/lib/tables/types'

/**
 * The seven cities of the circuit (.md/STORY_MODE_PLAN.md section 3; five were cut on
 * 2026-11-04). Ids are stable: saves refer to them, so rename `name`, never `id`.
 */
export type CityId = 'dustwater' | 'silver-mesa' | 'bayou-crossing' | 'monte-lune' | 'kurstadt' | 'the-aurora' | 'the-summit'

/** Cities cut on 2026-11-04 (saves in one move to the next city that's left; see the store). */
export const REMOVED_CITIES: Record<string, CityId> = {
  'rattlesnake-junction': 'silver-mesa',
  'port-lacey': 'silver-mesa',
  'neon-flats': 'bayou-crossing',
  'lantern-quay': 'kurstadt',
  'coral-reach': 'kurstadt',
}

export type BossKind =
  /** A Tables tournament with the boss seated: finish above them. */
  | { kind: 'table'; game: TableGameName }
  /** The final: three table rounds against Vale. */
  | { kind: 'final' }

export interface City {
  id: CityId
  name: string
  act: 1 | 2 | 3 | 4
  feel: string
  /** The city's minimum bet in dollars: the unit `m` for all of its money. */
  minBet: number
  /** House games on its floors; the Summit offers every game you have seen. */
  games: GameName[] | 'all-seen'
  /** Tables on offer: cash rooms and tournaments. */
  tables: { game: TableGameName; format: 'cash' | 'tournament' }[]
  boss: BossKind
  /** Characters with a minigame here (each playable once per night). */
  minigameGivers: number
}

export const CITIES: City[] = [
  // Seven cities (owner decision 2026-11-04): six house champions at a Tables game, in the
  // order Liar's Dice, Blackjack Showdown, Hold'em, twice, then the final. Minimum bets rise
  // about four times a city. Each of the 24 house games is dealt in exactly two cities.
  { id: 'dustwater', name: 'Dustwater', act: 1, feel: 'truck stop, back rooms', minBet: 5, games: ['coin-flip', 'street-cups', 'hilo', 'run-dice', 'over-under', 'wheel', 'chicken-race', 'crash'], tables: [{ game: 'liars-dice', format: 'cash' }], boss: { kind: 'table', game: 'liars-dice' }, minigameGivers: 2 },
  { id: 'silver-mesa', name: 'Silver Mesa', act: 1, feel: 'classic strip', minBet: 20, games: ['blackjack', 'roulette', 'poker-1p', 'dragon-tower', 'deck-countdown', 'mines', 'slots', 'keno'], tables: [{ game: 'blackjack-showdown', format: 'tournament' }], boss: { kind: 'table', game: 'blackjack-showdown' }, minigameGivers: 2 },
  { id: 'bayou-crossing', name: 'Bayou Crossing', act: 2, feel: 'riverboat', minBet: 75, games: ['blackjack', 'poker-1p', 'run-dice', 'over-under', 'street-cups', 'chicken-race', 'chicken-road', 'dragon-tiger'], tables: [{ game: 'holdem', format: 'cash' }], boss: { kind: 'table', game: 'holdem' }, minigameGivers: 2 },
  { id: 'monte-lune', name: 'Monte Lune', act: 2, feel: 'Riviera', minBet: 250, games: ['roulette', 'baccarat', 'sic-bo', 'andar-bahar', 'tower-of-cards', 'plinko', 'case-battles', 'coin-flip'], tables: [{ game: 'liars-dice', format: 'tournament' }], boss: { kind: 'table', game: 'liars-dice' }, minigameGivers: 3 },
  { id: 'kurstadt', name: 'Kurstadt', act: 3, feel: 'old spa casino', minBet: 1000, games: ['hilo', 'deck-countdown', 'dragon-tower', 'mines', 'baccarat', 'sic-bo', 'andar-bahar', 'dragon-tiger'], tables: [{ game: 'blackjack-showdown', format: 'cash' }], boss: { kind: 'table', game: 'blackjack-showdown' }, minigameGivers: 2 },
  { id: 'the-aurora', name: 'The Aurora', act: 3, feel: 'ocean liner', minBet: 5000, games: ['crash', 'tower-of-cards', 'case-battles', 'plinko', 'slots', 'keno', 'chicken-road', 'wheel'], tables: [{ game: 'holdem', format: 'cash' }, { game: 'holdem', format: 'tournament' }], boss: { kind: 'table', game: 'holdem' }, minigameGivers: 3 },
  { id: 'the-summit', name: 'The Summit', act: 4, feel: "Vale's private club", minBet: 25000, games: 'all-seen', tables: [{ game: 'holdem', format: 'cash' }, { game: 'liars-dice', format: 'cash' }, { game: 'blackjack-showdown', format: 'cash' }], boss: { kind: 'final' }, minigameGivers: 2 },
]

export const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]))
