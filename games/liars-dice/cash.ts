import { createLiars, liarsConfig, liarsEngine, removeLiarsSeat, viewLiars } from './engine'
import type { LiarsAction, LiarsState, LiarsView } from './types'
import type { Rng, Standings, TableEngine } from '@/lib/tables/types'

export interface LiarsCashState {
  config: { seats: number; ante: number; dicePerSeat: number }
  stacks: number[]
  empty: boolean[]
  antes: number[]
  game: LiarsState | null
  seatMap: number[]
  games: number
}
export interface LiarsCashView extends LiarsView { pot: number; stacks: number[]; ante: number; games: number }

export function createLiarsCash(seats: number, ante: number): LiarsCashState {
  return { config: { seats, ante, dicePerSeat: 5 }, stacks: new Array(seats).fill(0), empty: new Array(seats).fill(true), antes: new Array(seats).fill(0), game: null, seatMap: [], games: 0 }
}

/** Returns every seat's share of the ante pot, including short-ante refunds. */
export function settleLiarsPot(antes: number[], winner: number): number[] {
  const winnerAnte = antes[winner] ?? 0
  return antes.map((ante, seat) => seat === winner
    ? antes.reduce((sum, other) => sum + Math.min(other, winnerAnte), 0)
    : ante - Math.min(ante, winnerAnte))
}

function start(state: LiarsCashState, rng: Rng): LiarsCashState {
  const stacks = [...state.stacks], antes = new Array(state.config.seats).fill(0), seatMap: number[] = []
  for (let seat = 0; seat < state.config.seats; seat++) {
    if (state.empty[seat] || stacks[seat]! <= 0) continue
    const ante = Math.min(state.config.ante, stacks[seat]!)
    stacks[seat]! -= ante; antes[seat] = ante; seatMap.push(seat)
  }
  if (seatMap.length < 2) return { ...state, stacks, antes, seatMap, game: null }
  const game = liarsEngine.advance(createLiars(liarsConfig(seatMap.length)), rng)
  return { ...state, stacks, antes, seatMap, game, games: state.games + 1 }
}

function finish(state: LiarsCashState, game: LiarsState): LiarsCashState {
  const innerWinner = game.seats.findIndex((seat) => !seat.out)
  const winner = state.seatMap[innerWinner] ?? -1
  if (winner < 0) return { ...state, game: null }
  const stacks = [...state.stacks]
  const payouts = settleLiarsPot(state.antes, winner)
  for (let seat = 0; seat < stacks.length; seat++) stacks[seat]! += payouts[seat]!
  return { ...state, stacks, antes: new Array(stacks.length).fill(0), game: null, seatMap: [] }
}

function innerSeat(state: LiarsCashState, seat: number) { return state.seatMap.indexOf(seat) }
export function viewLiarsCash(state: LiarsCashState, seat: number): LiarsCashView {
  const inner = innerSeat(state, seat)
  const base = state.game && inner >= 0 ? viewLiars(state.game, inner) : { seat: inner, config: liarsConfig(0), phase: 'reveal' as const, round: 0, bid: null, bidder: null, toAct: null, dice: [], diceCounts: [], totalDice: 0, out: [], log: [], lastReveal: null, canCallLiar: false, canBid: false }
  const tableSeat = (innerSeat: number | null) => innerSeat == null ? null : state.seatMap[innerSeat] ?? null
  const diceCounts = state.empty.map((empty, tableSeat) => {
    const mapped = innerSeat(state, tableSeat)
    return empty || mapped < 0 ? 0 : base.diceCounts[mapped] ?? 0
  })
  const out = state.empty.map((empty, tableSeat) => {
    const mapped = innerSeat(state, tableSeat)
    return empty || mapped < 0 || !!base.out[mapped]
  })
  const reveal = base.lastReveal && {
    ...base.lastReveal,
    bidder: tableSeat(base.lastReveal.bidder) ?? -1,
    caller: tableSeat(base.lastReveal.caller) ?? -1,
    loser: tableSeat(base.lastReveal.loser) ?? -1,
    dice: state.empty.map((empty, tableSeat) => {
      const mapped = innerSeat(state, tableSeat)
      return empty || mapped < 0 ? [] : base.lastReveal!.dice[mapped] ?? []
    }),
  }
  return {
    ...base,
    seat,
    config: state.config,
    bidder: tableSeat(base.bidder),
    toAct: tableSeat(base.toAct),
    diceCounts,
    out,
    log: base.log.map((entry) => ({ ...entry, seat: tableSeat(entry.seat) ?? -1 })),
    lastReveal: reveal,
    pot: state.antes.reduce((a, b) => a + b, 0),
    stacks: state.stacks,
    ante: state.config.ante,
    games: state.games,
  }
}

export const liarsCashEngine: TableEngine<LiarsCashState, LiarsCashView, LiarsAction> = {
  viewFor: viewLiarsCash,
  toAct: (state) => state.game?.toAct == null ? null : state.seatMap[state.game.toAct] ?? null,
  apply: (state, seat, action) => {
    const inner = innerSeat(state, seat)
    if (!state.game || inner < 0) throw new Error("Liar's Dice cash: seat cannot act")
    const game = liarsEngine.apply(state.game, inner, action)
    return liarsEngine.isOver(game) ? finish({ ...state, game }, game) : { ...state, game }
  },
  needsAdvance: (state) => state.game == null,
  advance: start,
  timeoutAction: (state, seat) => state.game ? liarsEngine.timeoutAction(state.game, innerSeat(state, seat)) : { type: 'bid', bid: { count: 1, face: 2 } },
  isOver: () => false,
  standings: (): Standings => [],
  placeOf: () => null,
}

export const liarsCashOps = {
  betweenHands: (state: LiarsCashState) => state.game == null,
  sit: (state: LiarsCashState, seat: number, stack: number) => ({ ...state, stacks: state.stacks.map((value, i) => i === seat ? stack : value), empty: state.empty.map((value, i) => i === seat ? false : value) }),
  stand: (state: LiarsCashState, seat: number) => ({ stack: state.stacks[seat]!, state: { ...state, stacks: state.stacks.map((value, i) => i === seat ? 0 : value), empty: state.empty.map((value, i) => i === seat ? true : value) } }),
  addChips: (state: LiarsCashState, seat: number, amount: number) => ({ ...state, stacks: state.stacks.map((value, i) => i === seat ? value + amount : value) }),
  stackBehind: (state: LiarsCashState, seat: number) => state.stacks[seat]!,
  inPlay: (state: LiarsCashState, seat: number) => state.game != null && innerSeat(state, seat) >= 0,
  leaveAction: (state: LiarsCashState, seat: number) => {
    const inner = innerSeat(state, seat)
    if (!state.game || inner < 0) return state
    const game = removeLiarsSeat(state.game, inner)
    return liarsEngine.isOver(game) ? finish({ ...state, game }, game) : { ...state, game }
  },
  emptySeats: (state: LiarsCashState) => state.empty.map((value, i) => value ? i : -1).filter((i) => i >= 0),
  handsPlayed: (state: LiarsCashState) => state.games,
}
