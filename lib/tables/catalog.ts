import type { TableGameName } from './types'

/** The three table games. Not in `GAMES` (lib/game-catalog.ts): they stay out of every other mode. */
export interface TableGameEntry {
  name: TableGameName
  label: string
  sub: string
  /** What the game tests. */
  skill: string
  /** Seats at the table, you included. */
  seats: number
  /** Seats on a phone, where the full table doesn't fit. */
  phoneSeats: number
  /** One line on how the table is decided. */
  format: string
}

export const TABLE_GAMES: TableGameEntry[] = [
  {
    name: 'holdem',
    label: "Texas Hold'em",
    sub: 'No-limit Sit & Go against five bots',
    skill: 'Betting and bluffing',
    seats: 6,
    phoneSeats: 4,
    format: 'Last player with chips wins',
  },
  {
    name: 'liars-dice',
    label: "Liar's Dice",
    sub: 'Bid on the dice under every cup, or call liar',
    skill: 'Odds and bluffing, no cards',
    seats: 4,
    phoneSeats: 4,
    format: 'Last player with dice wins',
  },
  {
    name: 'blackjack-showdown',
    label: 'Blackjack Showdown',
    sub: 'Twelve hands against one dealer, most chips wins',
    skill: 'Bet sizing against rivals',
    seats: 4,
    phoneSeats: 4,
    format: 'Most chips after 12 hands wins',
  },
]

export const TABLE_GAME_BY_NAME = new Map(TABLE_GAMES.map((g) => [g.name, g]))

export function isTableGame(name: string): name is TableGameName {
  return TABLE_GAME_BY_NAME.has(name as TableGameName)
}
