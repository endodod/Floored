export interface LiarsBid {
  count: number
  /** 1–6; 1s are wild for every other face. */
  face: number
}

export type LiarsAction = { type: 'bid'; bid: LiarsBid } | { type: 'liar' }

/** `bidding` waits on `toAct`; `reveal` shows the cups until the next roll; `over` = one player has dice left. */
export type LiarsPhase = 'bidding' | 'reveal' | 'over'

export interface LiarsSeat {
  /** The dice under this seat's cup (as many as it has left). */
  dice: number[]
  out: boolean
}

export interface LiarsLogEntry {
  round: number
  seat: number
  action: LiarsAction
}

export interface LiarsReveal {
  round: number
  bid: LiarsBid
  bidder: number
  caller: number
  /** Dice that counted for the bid (the face, plus wild 1s). */
  actual: number
  loser: number
  /** Every cup, lifted. */
  dice: number[][]
}

export interface LiarsConfig {
  seats: number
  dicePerSeat: number
}

export interface LiarsState {
  config: LiarsConfig
  seats: LiarsSeat[]
  phase: LiarsPhase
  /** Round number (1-based once the first roll is made). */
  round: number
  bid: LiarsBid | null
  bidder: number | null
  toAct: number | null
  /** Seat that opens the next round (the last loser, or the next seat if they went out). */
  starter: number
  log: LiarsLogEntry[]
  lastReveal: LiarsReveal | null
  /** Seats in the order they went out, with the round. */
  busts: { seat: number; round: number }[]
}

export interface LiarsView {
  seat: number
  config: LiarsConfig
  phase: LiarsPhase
  round: number
  bid: LiarsBid | null
  bidder: number | null
  toAct: number | null
  /** Your own dice; empty for others' cups. */
  dice: number[]
  /** Dice each seat has left (public). */
  diceCounts: number[]
  totalDice: number
  out: boolean[]
  log: LiarsLogEntry[]
  lastReveal: LiarsReveal | null
  /** Can call "Liar!" now. */
  canCallLiar: boolean
  /** Can raise the bid at all (false when the bid is already the highest possible). */
  canBid: boolean
}
