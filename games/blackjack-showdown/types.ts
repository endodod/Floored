import type { BlackjackCard } from '../blackjack/types'

export type Seat = 0 | 1 | 2 | 3
export type Phase = 'betting' | 'playing' | 'settled' | 'finished'
export type Action = { type: 'bet'; amount: number } | { type: 'hit' } | { type: 'stand' } | { type: 'double' } | { type: 'next-hand' }
export interface Player { name: string; chips: number; bet: number; hand: BlackjackCard[]; stood: boolean; busted: boolean; blackjack: boolean; out: boolean }
export interface ShowdownState { phase: Phase; handNumber: number; dealer: BlackjackCard[]; players: Player[]; shoe: BlackjackCard[]; currentSeat: Seat | null; hiddenBets: boolean; message: string; winner: Seat | null }
export interface PlayerView extends Omit<ShowdownState, 'shoe' | 'players'> { players: Array<Omit<Player, 'hand'> & { hand: BlackjackCard[]; hiddenBet: boolean }>; shoeCount: number; self: Seat }
