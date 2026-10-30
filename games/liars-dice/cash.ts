import { createLiars, liarsConfig, liarsEngine, removeLiarsSeat, viewLiars } from './engine'
import type { LiarsAction, LiarsState, LiarsView } from './types'
import type { CashTableOps, Rng, Standings, TableEngine } from '@/lib/tables/types'

/**
 * Liar's Dice at a cash table: a session is a run of games. Each game every
 * seat with chips antes (a short stack antes all it has), a normal game of
 * Liar's Dice is played among them, and the last cup standing takes the pot
 * (`settleLiarsPot`). The inner game is the tournament engine, unchanged;
 * `seatMap` maps its seats to table seats.
 */
export interface LiarsCashState {
  config: { seats: number; ante: number; dicePerSeat: number }
  stacks: number[]
  empty: boolean[]
  antes: number[]
  game: LiarsState | null
  /** Inner seat → table seat for the game in play. */
  seatMap: number[]
  games: number
  /** The last finished game: who won, what each seat got back, and its final reveal (shown until the next game). */
  lastGame: { winner: number; payouts: number[]; game: LiarsState; seatMap: number[] } | null
}

export interface LiarsCashView extends LiarsView {
  pot: number
  stacks: number[]
  empty: boolean[]
  ante: number
  games: number
  /** Table seats in the game in play. */
  inGame: boolean[]
  lastGame: LiarsCashState['lastGame']
}

export function createLiarsCash(seats: number, ante: number): LiarsCashState {
  return {
    config: { seats, ante, dicePerSeat: 5 },
    stacks: new Array(seats).fill(0),
    empty: new Array(seats).fill(true),
    antes: new Array(seats).fill(0),
    game: null,
    seatMap: [],
    games: 0,
    lastGame: null,
  }
}

/**
 * Every seat's share of the ante pot. The winner takes min(their ante, the
 * other's) from each player (their own included); everyone gets back the part
 * of their ante above that. With full antes all round, the winner takes it all.
 */
export function settleLiarsPot(antes: number[], winner: number): number[] {
  const winnerAnte = antes[winner] ?? 0
  return antes.map((ante, seat) =>
    seat === winner ? antes.reduce((sum, other) => sum + Math.min(other, winnerAnte), 0) : ante - Math.min(ante, winnerAnte),
  )
}

const playable = (state: LiarsCashState) =>
  state.stacks.map((_, i) => i).filter((i) => !state.empty[i] && state.stacks[i]! > 0)

function start(state: LiarsCashState, rng: Rng): LiarsCashState {
  const seatMap = playable(state)
  // Never take antes without a game to play for them.
  if (seatMap.length < 2) return state
  const stacks = [...state.stacks]
  const antes = new Array(state.config.seats).fill(0)
  for (const seat of seatMap) {
    const ante = Math.min(state.config.ante, stacks[seat]!)
    stacks[seat]! -= ante
    antes[seat] = ante
  }
  const game = liarsEngine.advance(createLiars({ seats: seatMap.length, dicePerSeat: state.config.dicePerSeat }), rng)
  return { ...state, stacks, antes, seatMap, game, games: state.games + 1, lastGame: null }
}

function finish(state: LiarsCashState, game: LiarsState): LiarsCashState {
  const innerWinner = game.seats.findIndex((seat) => !seat.out)
  const winner = state.seatMap[innerWinner] ?? -1
  if (winner < 0) return { ...state, game: null, seatMap: [] }
  const stacks = [...state.stacks]
  const payouts = settleLiarsPot(state.antes, winner)
  for (let seat = 0; seat < stacks.length; seat++) {
    // A seat that left mid-game forfeits its whole ante: its refund goes to the winner.
    if (state.empty[seat]) stacks[winner]! += payouts[seat]!
    else stacks[seat]! += payouts[seat]!
  }
  return { ...state, stacks, antes: new Array(stacks.length).fill(0), game: null, seatMap: [], lastGame: { winner, payouts, game, seatMap: state.seatMap } }
}

/** Ends the game once it is over; otherwise keeps the inner state. */
function withGame(state: LiarsCashState, game: LiarsState): LiarsCashState {
  return liarsEngine.isOver(game) ? finish({ ...state, game }, game) : { ...state, game }
}

const innerSeat = (state: LiarsCashState, seat: number) => state.seatMap.indexOf(seat)

export function viewLiarsCash(state: LiarsCashState, seat: number): LiarsCashView {
  // Between games the last game stays on the table (its final reveal), with its seat map.
  const shown = state.game ?? state.lastGame?.game ?? null
  const map = state.game ? state.seatMap : (state.lastGame?.seatMap ?? [])
  const inner = map.indexOf(seat)
  const base: LiarsView =
    state.game && inner >= 0
      ? viewLiars(state.game, inner)
      : {
          seat: inner,
          config: liarsConfig(0),
          phase: state.game ? state.game.phase : 'reveal',
          round: shown?.round ?? 0,
          bid: state.game?.bid ?? null,
          bidder: null,
          toAct: null,
          dice: [],
          diceCounts: [],
          totalDice: shown ? shown.seats.reduce((n, s) => n + s.dice.length, 0) : 0,
          out: [],
          log: [],
          lastReveal: null,
          canCallLiar: false,
          canBid: false,
        }
  // Inner seat numbers become table seat numbers, so a board can show every seat.
  const toTable = (i: number | null) => (i == null ? null : (map[i] ?? null))
  const diceCounts = state.stacks.map((_, t) => {
    const i = map.indexOf(t)
    return shown && i >= 0 ? shown.seats[i]!.dice.length : 0
  })
  const out = state.stacks.map((_, t) => {
    const i = map.indexOf(t)
    return !shown || i < 0 || shown.seats[i]!.out
  })
  const reveal = shown?.lastReveal
  return {
    ...base,
    seat,
    config: { seats: state.config.seats, dicePerSeat: state.config.dicePerSeat },
    bidder: toTable(state.game?.bidder ?? null),
    toAct: toTable(state.game?.phase === 'bidding' ? state.game.toAct : null),
    diceCounts,
    out,
    log: (shown?.log ?? []).map((e) => ({ ...e, seat: toTable(e.seat) ?? -1 })),
    lastReveal: reveal
      ? {
          ...reveal,
          bidder: toTable(reveal.bidder) ?? -1,
          caller: toTable(reveal.caller) ?? -1,
          loser: toTable(reveal.loser) ?? -1,
          dice: state.stacks.map((_, t) => {
            const i = map.indexOf(t)
            return i >= 0 ? (reveal.dice[i] ?? []) : []
          }),
        }
      : null,
    pot: state.antes.reduce((a, b) => a + b, 0),
    stacks: state.stacks,
    empty: state.empty,
    ante: state.config.ante,
    games: state.games,
    inGame: state.stacks.map((_, t) => state.game != null && innerSeat(state, t) >= 0),
    lastGame: state.lastGame,
  }
}

export const liarsCashEngine: TableEngine<LiarsCashState, LiarsCashView, LiarsAction> = {
  viewFor: viewLiarsCash,
  toAct: (state) => (state.game && liarsEngine.toAct(state.game) != null ? (state.seatMap[liarsEngine.toAct(state.game)!] ?? null) : null),
  apply: (state, seat, action) => {
    const inner = innerSeat(state, seat)
    if (!state.game || inner < 0) throw new Error("Liar's Dice cash: seat cannot act")
    return withGame(state, liarsEngine.apply(state.game, inner, action))
  },
  // Between rounds the inner game rolls again; between games a new one starts once two players have chips.
  needsAdvance: (state) => (state.game ? liarsEngine.needsAdvance(state.game) : playable(state).length >= 2),
  advance: (state, rng) => (state.game ? withGame(state, liarsEngine.advance(state.game, rng)) : start(state, rng)),
  timeoutAction: (state, seat) =>
    state.game ? liarsEngine.timeoutAction(state.game, innerSeat(state, seat)) : { type: 'bid', bid: { count: 1, face: 2 } },
  isOver: () => false,
  standings: (): Standings => [],
  placeOf: () => null,
}

/** Cash-table seat changes: sitting and topping up between games; leaving any time. */
export const liarsCashOps: CashTableOps<LiarsCashState> = {
  betweenHands: (state) => state.game == null,
  sit: (state, seat, stack) => {
    if (!state.empty[seat]) throw new Error(`Liar's Dice: seat ${seat} is taken`)
    return {
      ...state,
      stacks: state.stacks.map((v, i) => (i === seat ? stack : v)),
      empty: state.empty.map((v, i) => (i === seat ? false : v)),
    }
  },
  stand: (state, seat) => ({
    stack: state.stacks[seat]!,
    state: {
      ...state,
      stacks: state.stacks.map((v, i) => (i === seat ? 0 : v)),
      empty: state.empty.map((v, i) => (i === seat ? true : v)),
    },
  }),
  addChips: (state, seat, amount) => ({ ...state, stacks: state.stacks.map((v, i) => (i === seat ? v + amount : v)) }),
  stackBehind: (state, seat) => state.stacks[seat]!,
  inPlay: (state, seat) => state.game != null && innerSeat(state, seat) >= 0 && !state.game.seats[innerSeat(state, seat)]!.out,
  /** Gives up the seat's dice; the ante stays in the pot. Stand afterwards. */
  leaveAction: (state, seat) => {
    const inner = innerSeat(state, seat)
    if (!state.game || inner < 0) return state
    return withGame(state, removeLiarsSeat(state.game, inner))
  },
  emptySeats: (state) => state.empty.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
  handsPlayed: (state) => state.games,
}
