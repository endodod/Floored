import type { BlackjackCard } from '@/games/blackjack/types'

export type Card = BlackjackCard

/** `betting` / `playing` wait on `toAct`; `handOver` shows the result until the next deal; `over` after the last hand. */
export type ShowdownPhase = 'betting' | 'playing' | 'handOver' | 'over'

export type ShowdownAction =
  | { type: 'bet'; amount: number }
  | { type: 'hit' }
  | { type: 'stand' }
  | { type: 'double' }

export type ShowdownOutcome = 'blackjack' | 'win' | 'push' | 'loss'

export interface ShowdownSeat {
  stack: number
  /** This hand's bet (0 = not placed yet). */
  bet: number
  cards: Card[]
  /** Finished acting this hand (stood, doubled, bust, 21 or blackjack). */
  done: boolean
  doubled: boolean
  out: boolean
  /** Cash-table seat without a player. */
  empty?: boolean
  outcome: ShowdownOutcome | null
  /** Chips won (+) or lost (−) this hand. */
  net: number
}

export interface ShowdownConfig {
  seats: number
  startingStack: number
  hands: number
  minBet: number
  maxBet: number
  decks: number
  /** Reshuffle before a hand when fewer cards than this are left in the shoe. */
  reshuffleAt: number
  format?: 'tournament' | 'cash'
}

export interface ShowdownLogEntry {
  hand: number
  seat: number
  action: ShowdownAction
}

export interface ShowdownState {
  config: ShowdownConfig
  seats: ShowdownSeat[]
  phase: ShowdownPhase
  /** Number of the current / last hand, 1-based. */
  hand: number
  /** Seat that bets and plays first this hand (rotates). */
  first: number
  dealer: Card[]
  shoe: Card[]
  toAct: number | null
  log: ShowdownLogEntry[]
  busts: { seat: number; hand: number; stack: number }[]
}

export interface ShowdownView {
  seat: number
  config: ShowdownConfig
  phase: ShowdownPhase
  hand: number
  first: number
  /** The dealer's hole card is null until the dealer plays. */
  dealer: (Card | null)[]
  toAct: number | null
  /** Other seats' bets are null while the final hand's bets are secret. */
  seats: (Omit<ShowdownSeat, 'bet'> & { bet: number | null; hasBet: boolean })[]
  /** True on the last hand: bets are placed face down and revealed together. */
  secretBets: boolean
  log: ShowdownLogEntry[]
  legal: ShowdownLegal | null
  cardsLeft: number
}

export interface ShowdownLegal {
  bet: { min: number; max: number } | null
  canHit: boolean
  canStand: boolean
  canDouble: boolean
}
