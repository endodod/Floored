import type { Rng, Standings, TableEngine } from '@/lib/tables/types'
import { placeIn, rankSeats } from '@/lib/tables/standings'
import type { LiarsAction, LiarsBid, LiarsConfig, LiarsSeat, LiarsState, LiarsView } from './types'

/**
 * Liar's Dice. Everyone rolls their dice under a cup; in turn, players raise a
 * bid on how many dice of one face lie under all the cups (1s are wild), or
 * call "Liar!" on the last bid. The cups lift: if the bid was short the bidder
 * loses a die, otherwise the caller does. Last player with dice wins.
 * `advance` rolls a round (the only random step); `apply` takes a bid or a call.
 */

export const LIARS_DICE_PER_SEAT = 5

export function liarsConfig(seats: number): LiarsConfig {
  return { seats, dicePerSeat: LIARS_DICE_PER_SEAT }
}

export function createLiars(config: LiarsConfig): LiarsState {
  return {
    config,
    seats: Array.from({ length: config.seats }, () => ({ dice: new Array<number>(config.dicePerSeat).fill(0), out: false })),
    phase: 'reveal',
    round: 0,
    bid: null,
    bidder: null,
    toAct: null,
    starter: -1,
    log: [],
    lastReveal: null,
    busts: [],
  }
}

// ── Bid rules ────────────────────────────────────────────────────────────────

/**
 * Whether `next` raises `prev`:
 * - same kind (both 1s, or both other faces): more dice, or as many dice of a higher face;
 * - to 1s: at least half the count, rounded up;
 * - from 1s: at least double the count plus one.
 * The opening bid may be any count of 2s–6s (not 1s).
 */
export function isRaise(prev: LiarsBid | null, next: LiarsBid): boolean {
  if (next.count < 1 || next.face < 1 || next.face > 6 || !Number.isInteger(next.count)) return false
  if (!prev) return next.face !== 1
  if (prev.face === 1 && next.face === 1) return next.count > prev.count
  if (next.face === 1) return next.count >= Math.ceil(prev.count / 2)
  if (prev.face === 1) return next.count >= prev.count * 2 + 1
  return next.count > prev.count || (next.count === prev.count && next.face > prev.face)
}

/** The smallest count that raises `prev` with this face. */
export function minCountFor(prev: LiarsBid | null, face: number): number {
  if (!prev) return face === 1 ? Infinity : 1
  if (prev.face === 1 && face === 1) return prev.count + 1
  if (face === 1) return Math.ceil(prev.count / 2)
  if (prev.face === 1) return prev.count * 2 + 1
  return face > prev.face ? prev.count : prev.count + 1
}

/** Every raise up to `maxCount` dice, smallest first per face. */
export function legalBids(prev: LiarsBid | null, maxCount: number): LiarsBid[] {
  const bids: LiarsBid[] = []
  for (let face = 1; face <= 6; face++) {
    for (let count = minCountFor(prev, face); count <= maxCount; count++) bids.push({ count, face })
  }
  return bids
}

/** Dice under all cups that count for a bid. */
export function countFor(dice: number[][], face: number): number {
  let n = 0
  for (const cup of dice) for (const d of cup) if (d === face || (face !== 1 && d === 1)) n++
  return n
}

// ── Flow ─────────────────────────────────────────────────────────────────────

function nextAlive(seats: LiarsSeat[], from: number): number {
  const n = seats.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (!seats[i]!.out) return i
  }
  return -1
}

/** Removes a seat's cup from an in-progress game (used when leaving a cash table). */
export function removeLiarsSeat(state: LiarsState, seat: number): LiarsState {
  const current = state.seats[seat]
  if (!current || current.out) return state
  const seats = state.seats.map((value, index) => index === seat ? { ...value, dice: [], out: true } : value)
  const alive = seats.filter((value) => !value.out).length
  const next = state.toAct === seat ? nextAlive(seats, seat) : state.toAct
  return {
    ...state,
    seats,
    toAct: alive <= 1 ? null : next,
    phase: alive <= 1 ? 'over' : state.phase,
    starter: state.starter === seat ? nextAlive(seats, seat) : state.starter,
    busts: [...state.busts, { seat, round: state.round }],
  }
}

const totalDice = (s: LiarsState) => s.seats.reduce((sum, seat) => sum + seat.dice.length, 0)

function roll(prev: LiarsState, rng: Rng): LiarsState {
  const seats = prev.seats.map((s) => ({
    ...s,
    dice: s.dice.map(() => 1 + Math.floor(rng() * 6)).sort((a, b) => a - b),
  }))
  const starter = prev.starter < 0 ? Math.floor(rng() * seats.length) : prev.starter
  const first = seats[starter]!.out ? nextAlive(seats, starter) : starter
  return { ...prev, seats, phase: 'bidding', round: prev.round + 1, bid: null, bidder: null, toAct: first, starter: first }
}

function applyLiars(prev: LiarsState, seat: number, action: LiarsAction): LiarsState {
  if (prev.phase !== 'bidding' || prev.toAct !== seat) throw new Error(`Liar's Dice: seat ${seat} cannot act now`)
  const log = [...prev.log, { round: prev.round, seat, action }]

  if (action.type === 'bid') {
    const { bid } = action
    if (!isRaise(prev.bid, bid) || bid.count > totalDice(prev)) {
      throw new Error(`Liar's Dice: ${bid.count}×${bid.face} does not raise the bid`)
    }
    return { ...prev, bid, bidder: seat, toAct: nextAlive(prev.seats, seat), log }
  }

  if (!prev.bid || prev.bidder == null) throw new Error("Liar's Dice: there is no bid to call")
  const dice = prev.seats.map((s) => s.dice)
  const actual = countFor(dice, prev.bid.face)
  const loser = actual < prev.bid.count ? prev.bidder : seat
  const seats = prev.seats.map((s, i) => (i === loser ? { ...s, dice: s.dice.slice(1) } : s))
  const busts = [...prev.busts]
  if (seats[loser]!.dice.length === 0) {
    seats[loser] = { ...seats[loser]!, out: true }
    busts.push({ seat: loser, round: prev.round })
  }
  const alive = seats.filter((s) => !s.out).length
  return {
    ...prev,
    seats,
    busts,
    log,
    toAct: null,
    phase: alive <= 1 ? 'over' : 'reveal',
    // The loser opens the next round; if they went out, the next seat does.
    starter: seats[loser]!.out ? nextAlive(seats, loser) : loser,
    lastReveal: { round: prev.round, bid: prev.bid, bidder: prev.bidder, caller: seat, actual, loser, dice },
  }
}

export function viewLiars(state: LiarsState, seat: number): LiarsView {
  const total = totalDice(state)
  const bidding = state.phase === 'bidding' && state.toAct === seat
  return {
    seat,
    config: state.config,
    phase: state.phase,
    round: state.round,
    bid: state.bid,
    bidder: state.bidder,
    toAct: state.toAct,
    dice: state.seats[seat]!.dice,
    diceCounts: state.seats.map((s) => s.dice.length),
    totalDice: total,
    out: state.seats.map((s) => s.out),
    log: state.log,
    lastReveal: state.lastReveal,
    canCallLiar: bidding && state.bid != null,
    canBid: bidding && legalBids(state.bid, total).length > 0,
  }
}

function liarsStandings(state: LiarsState): Standings {
  const alive = state.seats.map((_, i) => i).filter((i) => !state.seats[i]!.out)
  return rankSeats(alive, state.busts.map((b) => ({ seat: b.seat, order: b.round, tiebreak: 0 })))
}

export const liarsEngine: TableEngine<LiarsState, LiarsView, LiarsAction> = {
  viewFor: viewLiars,
  toAct: (s) => (s.phase === 'bidding' ? s.toAct : null),
  apply: applyLiars,
  needsAdvance: (s) => s.phase === 'reveal',
  advance: (s, rng) => {
    if (s.phase !== 'reveal') throw new Error("Liar's Dice: nothing to roll")
    return roll(s, rng)
  },
  timeoutAction: (s) => {
    if (s.bid) return { type: 'liar' }
    return { type: 'bid', bid: { count: 1, face: 2 } }
  },
  isOver: (s) => s.phase === 'over',
  standings: liarsStandings,
  placeOf: (s, seat) => (s.seats[seat]!.out || s.phase === 'over' ? placeIn(liarsStandings(s), seat) : null),
}
