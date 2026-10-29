import type { Card } from '@/games/poker-1p/types'

export type { Card }

export type HoldemStreet = 'preflop' | 'flop' | 'turn' | 'river'

/** `betting` waits on `toAct`; `handOver` shows the result until the next deal; `over` = one player has every chip. */
export type HoldemPhase = 'betting' | 'handOver' | 'over'

export type HoldemAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  /** Bet or raise so this seat's total bet on the street becomes `to`. */
  | { type: 'raise'; to: number }

export type HoldemActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in' | 'small-blind' | 'big-blind'

export interface HoldemSeat {
  stack: number
  /** Two hole cards while in a hand; empty when out of chips. */
  hole: Card[]
  /** Chips put in on the current street. */
  bet: number
  /** Chips put in this hand, all streets. */
  committed: number
  folded: boolean
  allIn: boolean
  /** Out of the tournament (no chips). */
  out: boolean
  /** Stack at the start of the hand — breaks ties between seats busting in the same hand. */
  startStack: number
  lastAction: HoldemActionKind | null
}

export interface HoldemLogEntry {
  hand: number
  street: HoldemStreet
  seat: number
  kind: HoldemActionKind
  /** The seat's street bet after the action (or the chips added for blinds). */
  amount: number
  /** Size of the pot before this action, all streets. */
  potBefore: number
}

export interface HoldemPotResult {
  amount: number
  /** Seats that could win this pot. */
  eligible: number[]
  winners: number[]
  /** Best hand label among the winners, null when everyone else folded. */
  label: string | null
}

export interface HoldemHandResult {
  hand: number
  pots: HoldemPotResult[]
  /** Net change per seat this hand. */
  net: number[]
  /** Hole cards shown at showdown (null = mucked or never dealt). */
  shown: (Card[] | null)[]
  /** Hand label per seat at showdown. */
  labels: (string | null)[]
  showdown: boolean
  /** Seats that busted in this hand. */
  busted: number[]
}

export interface HoldemConfig {
  seats: number
  startingStack: number
  /** Blind levels, [small, big]; the last one repeats. */
  blinds: [number, number][]
  /** Hands per blind level. */
  handsPerLevel: number
}

export interface HoldemState {
  config: HoldemConfig
  seats: HoldemSeat[]
  phase: HoldemPhase
  street: HoldemStreet
  /** Hands dealt so far (1-based number of the current / last hand). */
  hand: number
  button: number
  smallBlind: number
  bigBlind: number
  board: Card[]
  /** The rest of this hand's shuffled deck; streets deal from its top. */
  deck: Card[]
  toAct: number | null
  /** Highest street bet. */
  currentBet: number
  /** Size of the last full bet or raise on this street (the minimum raise increment). */
  minRaise: number
  /** Seats that still have to act on this street. */
  pending: boolean[]
  /** False for a seat that may only call or fold (an all-in short of a full raise didn't reopen the betting). */
  mayRaise: boolean[]
  log: HoldemLogEntry[]
  lastResult: HoldemHandResult | null
  /** Seats in the order they went out, with the hand number; ties = same hand. */
  busts: { seat: number; hand: number; startStack: number }[]
}

/** What one seat may see. Other seats' hole cards are null until shown at a showdown. */
export interface HoldemView {
  seat: number
  config: HoldemConfig
  phase: HoldemPhase
  street: HoldemStreet
  hand: number
  button: number
  smallBlind: number
  bigBlind: number
  board: Card[]
  toAct: number | null
  currentBet: number
  minRaise: number
  pot: number
  seats: (Omit<HoldemSeat, 'hole'> & { hole: Card[] | null })[]
  log: HoldemLogEntry[]
  lastResult: HoldemHandResult | null
  legal: HoldemLegal | null
}

export interface HoldemLegal {
  canCheck: boolean
  /** Chips needed to call (0 when checking is possible). Capped at the stack (a call all-in). */
  toCall: number
  /** Raise bounds as a total street bet, or null when raising isn't allowed. */
  minRaiseTo: number | null
  maxRaiseTo: number | null
}
