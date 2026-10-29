import type { TableGameInfo } from './types'

export const TABLE_GAMES: TableGameInfo[] = [
  { id: 'blackjack-showdown', name: 'Blackjack Showdown', summary: 'Twelve hands. One shared dealer. Outplay three rivals for the whole prize pool.', seats: 4, status: 'playable' },
  { id: 'liars-dice', name: "Liar's Dice", summary: 'Read the odds, raise the bid, or call the table’s bluff.', seats: 4, status: 'playable' },
  { id: 'holdem', name: 'Texas Hold’em', summary: 'A six-seat Sit & Go with rising blinds, side pots and a 65/35 top-two payout.', seats: 6, status: 'playable' },
]
