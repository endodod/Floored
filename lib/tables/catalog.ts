import type { TableGameName } from './types'

/** The three table games. Not in `GAMES` (lib/game-catalog.ts): they stay out of every other mode. */
export interface TableGameEntry {
  name: TableGameName
  label: string
  symbol: string
  sub: string
  /** What the game tests. */
  skill: string
  /** Seats at the table, you included. */
  seats: number
  /** Seats on a phone, where the full table doesn't fit. */
  phoneSeats: number
  /** One line on how the table is decided. */
  format: string
  cash: { label: string; sub: string; format: string }
}

const ALL_TABLE_GAMES: TableGameEntry[] = [
  {
    name: 'holdem',
    label: "Texas Hold'em",
    symbol: '♠',
    sub: 'No-limit tournament against five bots',
    skill: 'Betting and bluffing',
    seats: 6,
    phoneSeats: 4,
    format: 'Last player with chips wins',
    cash: { label: "Texas Hold'em", sub: 'No-limit cash table, bring your own stack', format: 'Play until you leave or run out of chips' },
  },
  {
    name: 'liars-dice',
    label: "Liar's Dice",
    symbol: '⚄',
    sub: 'Bid on the dice under every cup, or call liar',
    skill: 'Odds and bluffing, no cards',
    seats: 4,
    phoneSeats: 4,
    format: 'Last player with dice wins',
    cash: { label: "Liar's Dice", sub: 'Ante each game, last cup standing takes the pot', format: 'Play until you leave or run out of chips' },
  },
  {
    name: 'blackjack-showdown',
    label: 'Blackjack Showdown',
    symbol: '♦',
    sub: 'Twelve hands against one dealer, most chips wins',
    skill: 'Bet sizing against rivals',
    seats: 4,
    phoneSeats: 4,
    format: 'Most chips after 12 hands wins',
    cash: { label: 'Blackjack', sub: 'Play the house at a shared table', format: 'Play until you leave or run out of chips' },
  },
]

const READY: TableGameName[] = ['holdem', 'liars-dice', 'blackjack-showdown']

export const TABLE_GAMES = ALL_TABLE_GAMES.filter((g) => READY.includes(g.name))
export const TABLE_GAME_BY_NAME = new Map(ALL_TABLE_GAMES.map((g) => [g.name, g]))

export function isTableGame(name: string): name is TableGameName {
  return READY.includes(name as TableGameName)
}
