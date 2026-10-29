/** Table games are deliberately separate from the solo GameName union. */
export type TableGameName = 'blackjack-showdown' | 'liars-dice' | 'holdem'
export interface TableGameInfo { id: TableGameName; name: string; summary: string; seats: number; status: 'playable' | 'coming-soon' }
