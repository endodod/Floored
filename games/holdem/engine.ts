import type { CashTableOps, Rng, Standings, TableEngine } from '@/lib/tables/types'
import { placeIn, rankSeats } from '@/lib/tables/standings'
import { evaluate, fullDeck, labelOf, shuffled } from './evaluator'
import type {
  Card,
  HoldemAction,
  HoldemActionKind,
  HoldemConfig,
  HoldemHandResult,
  HoldemLegal,
  HoldemPotResult,
  HoldemSeat,
  HoldemState,
  HoldemStreet,
  HoldemView,
} from './types'

/**
 * No-limit Texas Hold'em, Sit & Go: everyone starts with the same stack,
 * blinds rise every `handsPerLevel` hands, and play goes on until one seat
 * holds every chip. Pure state machine: `advance` deals a hand (the only
 * random step), `apply` takes one betting action.
 */

/** Blind schedule: every level lasts HOLDEM_HANDS_PER_LEVEL hands; the last level repeats. */
export const HOLDEM_BLINDS: [number, number][] = [
  [10, 20],
  [15, 30],
  [25, 50],
  [50, 100],
  [75, 150],
  [100, 200],
  [150, 300],
  [200, 400],
  [300, 600],
  [500, 1000],
  [800, 1600],
  [1200, 2400],
]
export const HOLDEM_STARTING_STACK = 1500
export const HOLDEM_HANDS_PER_LEVEL = 5

export function holdemConfig(seats: number): HoldemConfig {
  return {
    seats,
    startingStack: HOLDEM_STARTING_STACK,
    blinds: HOLDEM_BLINDS,
    handsPerLevel: HOLDEM_HANDS_PER_LEVEL,
  }
}

export function holdemCashConfig(seats: number, blinds: [number, number]): HoldemConfig {
  return { seats, startingStack: 0, blinds: [blinds], handsPerLevel: Infinity, format: 'cash' }
}

export function createHoldem(config: HoldemConfig): HoldemState {
  const seats: HoldemSeat[] = Array.from({ length: config.seats }, () => ({
    stack: config.startingStack,
    hole: [],
    bet: 0,
    committed: 0,
    folded: false,
    allIn: false,
    out: false,
    empty: config.format === 'cash',
    startStack: config.startingStack,
    lastAction: null,
  }))
  return {
    config,
    seats,
    phase: 'handOver',
    street: 'preflop',
    hand: 0,
    button: -1,
    smallBlind: config.blinds[0]![0],
    bigBlind: config.blinds[0]![1],
    board: [],
    deck: [],
    toAct: null,
    currentBet: 0,
    minRaise: 0,
    pending: seats.map(() => false),
    mayRaise: seats.map(() => true),
    log: [],
    lastResult: null,
    busts: [],
  }
}

// ── Seat helpers ─────────────────────────────────────────────────────────────

function nextSeat(n: number, from: number, pred: (i: number) => boolean): number {
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (pred(i)) return i
  }
  return -1
}

const inHand = (s: HoldemSeat) => !s.out && !s.empty && !s.folded
const canAct = (s: HoldemSeat) => inHand(s) && !s.allIn

export function potOf(state: Pick<HoldemState, 'seats'>): number {
  return state.seats.reduce((sum, s) => sum + s.committed, 0)
}

export function blindsForHand(config: HoldemConfig, hand: number): [number, number] {
  const level = Math.min(Math.floor((hand - 1) / config.handsPerLevel), config.blinds.length - 1)
  return config.blinds[level]!
}

/** 0-based blind level of a hand. */
export function levelOf(config: HoldemConfig, hand: number): number {
  return Math.min(Math.floor((Math.max(hand, 1) - 1) / config.handsPerLevel), config.blinds.length - 1)
}

// ── Dealing a hand ───────────────────────────────────────────────────────────

function startHand(prev: HoldemState, rng: Rng): HoldemState {
  const n = prev.seats.length
  const hand = prev.hand + 1
  const [sb, bb] = blindsForHand(prev.config, hand)
  const seats: HoldemSeat[] = prev.seats.map((s) => ({
    ...s,
    hole: [],
    bet: 0,
    committed: 0,
    folded: s.out || !!s.empty || s.stack === 0,
    allIn: false,
    startStack: s.stack,
    lastAction: null,
  }))
  const alive = (i: number) => !seats[i]!.out && !seats[i]!.empty && seats[i]!.stack > 0
  const button = prev.button < 0 ? nextSeat(n, Math.floor(rng() * n) - 1 + n, alive) : nextSeat(n, prev.button, alive)

  let deck = shuffled(fullDeck(), rng)
  for (let round = 0; round < 2; round++) {
    let i = button
    for (let k = 0; k < n; k++) {
      i = nextSeat(n, i, alive)
      if (seats[i]!.hole.length === round) {
        seats[i]!.hole = [...seats[i]!.hole, deck[0]!]
        deck = deck.slice(1)
      }
    }
  }

  const aliveCount = seats.filter((s) => !s.out && !s.empty && s.stack > 0).length
  const sbSeat = aliveCount === 2 ? button : nextSeat(n, button, alive)
  const bbSeat = nextSeat(n, sbSeat, alive)
  const log: HoldemState['log'] = []
  const post = (seat: number, amount: number, kind: HoldemActionKind) => {
    const s = seats[seat]!
    const potBefore = potOf({ seats })
    const paid = Math.min(amount, s.stack)
    s.stack -= paid
    s.bet += paid
    s.committed += paid
    if (s.stack === 0) s.allIn = true
    s.lastAction = kind
    log.push({ hand, street: 'preflop', seat, kind, amount: paid, potBefore })
  }
  post(sbSeat, sb, 'small-blind')
  post(bbSeat, bb, 'big-blind')
  // Cash tables: a player who sat down since the last hand posts a big blind (a live bet).
  seats.forEach((s, i) => {
    if (s.newcomer && alive(i) && i !== sbSeat && i !== bbSeat) post(i, bb, 'big-blind')
    s.newcomer = false
  })

  const state: HoldemState = {
    ...prev,
    seats,
    phase: 'betting',
    street: 'preflop',
    hand,
    button,
    smallBlind: sb,
    bigBlind: bb,
    board: [],
    deck,
    toAct: null,
    currentBet: bb,
    minRaise: bb,
    pending: seats.map(canAct),
    mayRaise: seats.map(() => true),
    log: [...prev.log, ...log],
  }
  return continueFrom(state, bbSeat)
}

// ── Betting ──────────────────────────────────────────────────────────────────

export function legalFor(state: HoldemState, seat: number): HoldemLegal | null {
  if (state.phase !== 'betting' || state.toAct !== seat) return null
  const s = state.seats[seat]!
  const owe = Math.max(0, state.currentBet - s.bet)
  const toCall = Math.min(owe, s.stack)
  const maxRaiseTo = s.bet + s.stack
  const othersCanAct = state.seats.some((o, i) => i !== seat && canAct(o))
  const raiseOk = state.mayRaise[seat] && maxRaiseTo > state.currentBet && othersCanAct
  return {
    canCheck: owe === 0,
    toCall,
    minRaiseTo: raiseOk ? Math.min(state.currentBet + state.minRaise, maxRaiseTo) : null,
    maxRaiseTo: raiseOk ? maxRaiseTo : null,
  }
}

function applyHoldem(prev: HoldemState, seat: number, action: HoldemAction): HoldemState {
  const legal = legalFor(prev, seat)
  if (!legal) throw new Error(`Hold'em: seat ${seat} cannot act now`)
  const seats = prev.seats.map((s) => ({ ...s }))
  const s = seats[seat]!
  const pending = [...prev.pending]
  const mayRaise = [...prev.mayRaise]
  let { currentBet, minRaise } = prev
  const potBefore = potOf(prev)
  let kind: HoldemActionKind

  const put = (chips: number) => {
    s.stack -= chips
    s.bet += chips
    s.committed += chips
    if (s.stack === 0) s.allIn = true
  }

  switch (action.type) {
    case 'fold':
      s.folded = true
      kind = 'fold'
      break
    case 'check':
      if (!legal.canCheck) throw new Error(`Hold'em: seat ${seat} cannot check`)
      kind = 'check'
      break
    case 'call':
      if (legal.canCheck) throw new Error(`Hold'em: seat ${seat} has nothing to call`)
      put(legal.toCall)
      kind = s.allIn ? 'all-in' : 'call'
      break
    case 'raise': {
      const { minRaiseTo, maxRaiseTo } = legal
      const to = Math.floor(action.to)
      if (minRaiseTo == null || maxRaiseTo == null) throw new Error(`Hold'em: seat ${seat} cannot raise`)
      if (to > maxRaiseTo || (to < minRaiseTo && to !== maxRaiseTo) || to <= currentBet) {
        throw new Error(`Hold'em: raise to ${to} is outside ${minRaiseTo}–${maxRaiseTo}`)
      }
      const increment = to - currentBet
      const wasBet = currentBet === 0
      put(to - s.bet)
      if (increment >= minRaise) {
        // A full raise reopens the betting for everyone.
        minRaise = increment
        seats.forEach((o, i) => {
          mayRaise[i] = true
          if (i !== seat && canAct(o)) pending[i] = true
        })
      } else {
        // An all-in short of a full raise: seats that already acted may only call or fold.
        seats.forEach((o, i) => {
          if (i === seat || !canAct(o) || o.bet >= to) return
          if (!pending[i]) mayRaise[i] = false
          pending[i] = true
        })
      }
      currentBet = to
      kind = s.allIn ? 'all-in' : wasBet ? 'bet' : 'raise'
      break
    }
  }
  pending[seat] = false
  s.lastAction = kind
  const state: HoldemState = {
    ...prev,
    seats,
    pending,
    mayRaise,
    currentBet,
    minRaise,
    log: [...prev.log, { hand: prev.hand, street: prev.street, seat, kind, amount: s.bet, potBefore }],
  }
  return continueFrom(state, seat)
}

/** After an action (or the blinds): hand to the next seat, close the street, or end the hand. */
function continueFrom(state: HoldemState, last: number): HoldemState {
  const n = state.seats.length
  const live = state.seats.filter(inHand)
  if (live.length === 1) return finishHand(state, false)

  // A seat with nothing to call and nobody left to bet against has no decision to make.
  const pending = state.pending.map((p, i) => {
    const s = state.seats[i]!
    if (!p || !canAct(s)) return false
    const others = state.seats.some((o, j) => j !== i && canAct(o))
    return others || s.bet < state.currentBet
  })
  state = { ...state, pending }
  const next = nextSeat(n, last, (i) => pending[i]!)
  if (next !== -1) return { ...state, toAct: next }
  return closeStreet(state)
}

const STREETS: HoldemStreet[] = ['preflop', 'flop', 'turn', 'river']

function closeStreet(state: HoldemState): HoldemState {
  const seats = state.seats.map((s) => ({ ...s, bet: 0 }))
  let { board, deck } = state
  const actors = seats.filter(canAct).length

  if (state.street === 'river' || actors <= 1) {
    // Showdown, dealing out whatever is left of the board first.
    const need = 5 - board.length
    board = [...board, ...deck.slice(0, need)]
    deck = deck.slice(need)
    return finishHand({ ...state, seats, board, deck, street: 'river' }, true)
  }

  const street = STREETS[STREETS.indexOf(state.street) + 1]!
  const count = street === 'flop' ? 3 : 1
  board = [...board, ...deck.slice(0, count)]
  deck = deck.slice(count)
  const next: HoldemState = {
    ...state,
    seats,
    board,
    deck,
    street,
    currentBet: 0,
    minRaise: state.bigBlind,
    pending: seats.map(canAct),
    mayRaise: seats.map(() => true),
    toAct: null,
  }
  return { ...next, toAct: nextSeat(seats.length, state.button, (i) => canAct(seats[i]!)) }
}

// ── Settling ─────────────────────────────────────────────────────────────────

/** Main pot and side pots from what each seat committed this hand. */
export function buildPots(seats: HoldemSeat[]): { amount: number; eligible: number[] }[] {
  const left = seats.map((s) => s.committed)
  const pots: { amount: number; eligible: number[] }[] = []
  for (;;) {
    const contenders = seats.map((s, i) => i).filter((i) => inHand(seats[i]!) && left[i]! > 0)
    if (!contenders.length) break
    const level = Math.min(...contenders.map((i) => left[i]!))
    let amount = 0
    left.forEach((c, i) => {
      const take = Math.min(c, level)
      amount += take
      left[i] = c - take
    })
    pots.push({ amount, eligible: contenders })
  }
  // Chips from folded seats above every live seat's commitment go to the last pot.
  const dead = left.reduce((a, b) => a + b, 0)
  if (dead && pots.length) pots[pots.length - 1]!.amount += dead
  return pots
}

function finishHand(state: HoldemState, showdown: boolean): HoldemState {
  const n = state.seats.length
  const seats = state.seats.map((s) => ({ ...s, bet: 0 }))
  const scores = seats.map((s) => (showdown && inHand(s) ? evaluate([...s.hole, ...state.board]) : -1))
  const pots: HoldemPotResult[] = buildPots(seats).map(({ amount, eligible }) => {
    const best = Math.max(...eligible.map((i) => scores[i]!))
    const winners = eligible.filter((i) => scores[i] === best)
    return { amount, eligible, winners, label: showdown && eligible.length > 1 ? labelOf(best) : null }
  })

  for (const pot of pots) {
    // Odd chips go one by one to the winners closest to the left of the button.
    const order = [...pot.winners].sort((a, b) => ((a - state.button + n - 1) % n) - ((b - state.button + n - 1) % n))
    const share = Math.floor(pot.amount / order.length)
    let odd = pot.amount - share * order.length
    for (const w of order) {
      seats[w]!.stack += share + (odd > 0 ? 1 : 0)
      odd--
    }
  }

  const busted: number[] = []
  const busts = [...state.busts]
  seats.forEach((s, i) => {
    if (!s.out && !s.empty && s.stack === 0 && state.config.format !== 'cash') {
      s.out = true
      busted.push(i)
      busts.push({ seat: i, hand: state.hand, startStack: s.startStack })
    }
  })

  const result: HoldemHandResult = {
    hand: state.hand,
    pots,
    net: seats.map((s, i) => s.stack - state.seats[i]!.startStack),
    shown: state.seats.map((s) => (showdown && inHand(s) ? s.hole : null)),
    labels: scores.map((sc) => (sc >= 0 ? labelOf(sc) : null)),
    showdown,
    busted,
  }
  const alive = seats.filter((s) => !s.out && !s.empty && s.stack > 0).length
  return {
    ...state,
    seats,
    busts,
    pending: seats.map(() => false),
    toAct: null,
    phase: state.config.format !== 'cash' && alive <= 1 ? 'over' : 'handOver',
    lastResult: result,
  }
}

// ── Views and the engine contract ────────────────────────────────────────────

export function viewHoldem(state: HoldemState, seat: number): HoldemView {
  const shown = state.lastResult?.hand === state.hand && state.phase !== 'betting' ? state.lastResult.shown : null
  return {
    seat,
    config: state.config,
    phase: state.phase,
    street: state.street,
    hand: state.hand,
    button: state.button,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    board: state.board,
    toAct: state.toAct,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    pot: potOf(state),
    seats: state.seats.map((s, i) => ({
      ...s,
      hole: i === seat ? s.hole : (shown?.[i] ?? null),
    })),
    log: state.log,
    lastResult: state.lastResult,
    legal: legalFor(state, seat),
  }
}

function holdemStandings(state: HoldemState): Standings {
  const alive = state.seats.map((_, i) => i).filter((i) => !state.seats[i]!.out && !state.seats[i]!.empty)
  return rankSeats(
    alive,
    state.busts.map((b) => ({ seat: b.seat, order: b.hand, tiebreak: b.startStack })),
  )
}

export const holdemEngine: TableEngine<HoldemState, HoldemView, HoldemAction> = {
  viewFor: viewHoldem,
  toAct: (s) => (s.phase === 'betting' ? s.toAct : null),
  apply: applyHoldem,
  // A cash table waits for a second player with chips before it deals.
  needsAdvance: (s) => s.phase === 'handOver' && (s.config.format !== 'cash' || s.seats.filter((x) => !x.empty && x.stack > 0).length >= 2),
  advance: (s, rng) => {
    if (s.phase !== 'handOver') throw new Error("Hold'em: nothing to deal")
    return startHand(s, rng)
  },
  timeoutAction: (s, seat) => (legalFor(s, seat)?.canCheck ? { type: 'check' } : { type: 'fold' }),
  isOver: (s) => s.config.format !== 'cash' && s.phase === 'over',
  standings: holdemStandings,
  placeOf: (s, seat) => (s.seats[seat]!.out || s.phase === 'over' ? placeIn(holdemStandings(s), seat) : null),
}

/**
 * A seat leaving mid-hand folds, on its turn or not. Chips it already put in
 * stay in the pot; if one player is left, they take it.
 */
function foldOutOfTurn(state: HoldemState, seat: number): HoldemState {
  if (state.phase !== 'betting' || !inHand(state.seats[seat]!)) return state
  if (state.toAct === seat) return applyHoldem(state, seat, { type: 'fold' })
  const seats = state.seats.map((s, i) => (i === seat ? { ...s, folded: true, lastAction: 'fold' as HoldemActionKind } : s))
  const pending = state.pending.map((p, i) => (i === seat ? false : p))
  const next: HoldemState = {
    ...state,
    seats,
    pending,
    log: [...state.log, { hand: state.hand, street: state.street, seat, kind: 'fold', amount: seats[seat]!.bet, potBefore: potOf(state) }],
  }
  if (seats.filter(inHand).length === 1) return finishHand(next, false)
  // Nobody left to act against: close the street (or run the board out).
  if (next.toAct == null || !pending.some(Boolean)) return closeStreet(next)
  return next
}

/** Cash-table seat changes. Sitting, standing and topping up happen between hands. */
export const holdemCashOps: CashTableOps<HoldemState> = {
  betweenHands: (state) => state.phase === 'handOver',
  sit: (state, seat, stack, newcomer) => {
    if (!state.seats[seat]!.empty) throw new Error(`Hold'em: seat ${seat} is taken`)
    return { ...state, seats: state.seats.map((s, i) => (i === seat ? { ...s, stack, empty: false, out: false, folded: true, hole: [], bet: 0, committed: 0, startStack: stack, lastAction: null, newcomer } : s)) }
  },
  stand: (state, seat) => {
    const stack = state.seats[seat]!.stack
    return { stack, state: { ...state, seats: state.seats.map((s, i) => (i === seat ? { ...s, stack: 0, empty: true, out: false, hole: [], folded: true, allIn: false, newcomer: false, lastAction: null } : s)) } }
  },
  addChips: (state, seat, amount) => ({ ...state, seats: state.seats.map((s, i) => (i === seat ? { ...s, stack: s.stack + amount } : s)) }),
  stackBehind: (state, seat) => state.seats[seat]!.stack,
  inPlay: (state, seat) => state.phase === 'betting' && inHand(state.seats[seat]!),
  leaveAction: foldOutOfTurn,
  emptySeats: (state) => state.seats.map((s, i) => (s.empty ? i : -1)).filter((i) => i >= 0),
  handsPlayed: (state) => state.hand,
}

export type { Card }
