import type { GameName } from '@/store/types'
import type { TableGameName } from '@/lib/tables/types'

/**
 * The twelve cities of the circuit (.md/STORY_MODE_PLAN.md section 3). Ids are
 * stable: saves refer to them, so rename `name`, never `id`.
 */
export type CityId =
  | 'dustwater'
  | 'rattlesnake-junction'
  | 'port-lacey'
  | 'silver-mesa'
  | 'neon-flats'
  | 'bayou-crossing'
  | 'lantern-quay'
  | 'coral-reach'
  | 'monte-lune'
  | 'kurstadt'
  | 'the-aurora'
  | 'the-summit'

export type BossKind =
  /** A seeded challenge on the city's games: beat the rival's score, shown up front. */
  | { kind: 'challenge' }
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
  { id: 'dustwater', name: 'Dustwater', act: 1, feel: 'truck stop, back rooms', minBet: 5, games: ['coin-flip', 'street-cups', 'hilo', 'run-dice', 'over-under'], tables: [{ game: 'liars-dice', format: 'cash' }], boss: { kind: 'table', game: 'liars-dice' }, minigameGivers: 2 },
  { id: 'rattlesnake-junction', name: 'Rattlesnake Junction', act: 1, feel: 'rodeo saloon', minBet: 10, games: ['chicken-race', 'chicken-road', 'wheel', 'mines', 'andar-bahar'], tables: [{ game: 'blackjack-showdown', format: 'cash' }], boss: { kind: 'challenge' }, minigameGivers: 2 },
  { id: 'port-lacey', name: 'Port Lacey', act: 1, feel: 'boardwalk arcade', minBet: 25, games: ['plinko', 'wheel', 'slots', 'keno', 'crash', 'case-battles'], tables: [], boss: { kind: 'challenge' }, minigameGivers: 3 },
  { id: 'silver-mesa', name: 'Silver Mesa', act: 2, feel: 'classic strip', minBet: 50, games: ['blackjack', 'roulette', 'poker-1p', 'dragon-tower', 'deck-countdown', 'mines'], tables: [{ game: 'blackjack-showdown', format: 'tournament' }], boss: { kind: 'table', game: 'blackjack-showdown' }, minigameGivers: 2 },
  { id: 'neon-flats', name: 'Neon Flats', act: 2, feel: 'modern mega-resort', minBet: 100, games: ['crash', 'slots', 'plinko', 'tower-of-cards', 'case-battles', 'keno'], tables: [{ game: 'holdem', format: 'cash' }], boss: { kind: 'challenge' }, minigameGivers: 3 },
  { id: 'bayou-crossing', name: 'Bayou Crossing', act: 2, feel: 'riverboat', minBet: 250, games: ['blackjack', 'poker-1p', 'run-dice', 'over-under', 'street-cups', 'chicken-race'], tables: [{ game: 'liars-dice', format: 'tournament' }], boss: { kind: 'table', game: 'liars-dice' }, minigameGivers: 2 },
  { id: 'lantern-quay', name: 'Lantern Quay', act: 3, feel: 'harbour lights', minBet: 500, games: ['baccarat', 'sic-bo', 'dragon-tiger', 'andar-bahar', 'tower-of-cards'], tables: [{ game: 'holdem', format: 'cash' }], boss: { kind: 'challenge' }, minigameGivers: 3 },
  { id: 'coral-reach', name: 'Coral Reach', act: 3, feel: 'island resort', minBet: 1000, games: ['wheel', 'sic-bo', 'chicken-road', 'coin-flip', 'keno', 'hilo'], tables: [{ game: 'liars-dice', format: 'cash' }], boss: { kind: 'challenge' }, minigameGivers: 2 },
  { id: 'monte-lune', name: 'Monte Lune', act: 3, feel: 'Riviera', minBet: 2500, games: ['roulette', 'baccarat', 'blackjack', 'poker-1p', 'dragon-tiger'], tables: [{ game: 'holdem', format: 'tournament' }], boss: { kind: 'table', game: 'holdem' }, minigameGivers: 3 },
  { id: 'kurstadt', name: 'Kurstadt', act: 4, feel: 'old spa casino', minBet: 5000, games: ['roulette', 'hilo', 'deck-countdown', 'dragon-tower', 'mines', 'baccarat'], tables: [{ game: 'blackjack-showdown', format: 'cash' }], boss: { kind: 'table', game: 'blackjack-showdown' }, minigameGivers: 2 },
  { id: 'the-aurora', name: 'The Aurora', act: 4, feel: 'ocean liner', minBet: 10000, games: ['crash', 'tower-of-cards', 'coin-flip', 'case-battles', 'sic-bo', 'plinko'], tables: [{ game: 'holdem', format: 'cash' }, { game: 'holdem', format: 'tournament' }], boss: { kind: 'table', game: 'holdem' }, minigameGivers: 3 },
  { id: 'the-summit', name: 'The Summit', act: 4, feel: "Vale's private club", minBet: 25000, games: 'all-seen', tables: [{ game: 'holdem', format: 'cash' }, { game: 'liars-dice', format: 'cash' }, { game: 'blackjack-showdown', format: 'cash' }], boss: { kind: 'final' }, minigameGivers: 2 },
]

export const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]))
