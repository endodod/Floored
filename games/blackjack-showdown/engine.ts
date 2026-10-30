import { calculateHandValue, dealerShouldHit, isBlackjack, isBust } from '@/games/blackjack/engine'
import type { BlackjackCard } from '@/games/blackjack/types'
import type { Rng, Standings, TableEngine } from '@/lib/tables/types'
import { placeIn, rankSeats } from '@/lib/tables/standings'
import type {
  Card,
  ShowdownAction,
  ShowdownConfig,
  ShowdownLegal,
  ShowdownOutcome,
  ShowdownSeat,
  ShowdownState,
  ShowdownView,
} from './types'

/**
 * Blackjack Showdown (tournament blackjack). Every seat plays the same dealer
 * from one shared shoe for a fixed number of hands; most chips after the last
 * hand wins. Table rules match the solo game (games/blackjack): blackjack pays
 * 3:2, the dealer hits 16 or less and stands on all 17s, double on the first
 * two cards, no split. Bets are placed in turn and are public, except on the
 * final hand, where they stay face down until the cards are dealt.
 */

export const SHOWDOWN_STARTING_STACK = 1000
export const SHOWDOWN_HANDS = 12
export const SHOWDOWN_MIN_BET = 50
export const SHOWDOWN_MIN_BET_MULTIPLIER = 1.5
export const SHOWDOWN_MAX_BET = 500

export function showdownMinBetForHand(hand: number): number {
  return Math.min(
    SHOWDOWN_MAX_BET,
    Math.ceil((SHOWDOWN_MIN_BET * SHOWDOWN_MIN_BET_MULTIPLIER ** Math.max(0, hand - 1)) / 25) * 25,
  )
}

export function showdownConfig(seats: number): ShowdownConfig {
  return {
    seats,
    startingStack: SHOWDOWN_STARTING_STACK,
    hands: SHOWDOWN_HANDS,
    minBet: SHOWDOWN_MIN_BET,
    maxBet: SHOWDOWN_MAX_BET,
    decks: 4,
    reshuffleAt: 60,
  }
}

export function showdownCashConfig(seats: number, minBet: number, maxBet: number | null): ShowdownConfig {
  return { seats, startingStack: 0, hands: Infinity, minBet, maxBet: maxBet ?? Number.MAX_SAFE_INTEGER, decks: 4, reshuffleAt: 60, format: 'cash' }
}

const SUITS: BlackjackCard['suit'][] = ['♠', '♥', '♦', '♣']
const RANKS: BlackjackCard['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function newShoe(decks: number, rng: Rng): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) cards.push({ suit, rank })
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j]!, cards[i]!]
  }
  return cards
}

export function createShowdown(config: ShowdownConfig): ShowdownState {
  return {
    config,
    seats: Array.from({ length: config.seats }, () => ({
      stack: config.startingStack,
      bet: 0,
      cards: [],
      done: false,
      doubled: false,
      out: false,
      empty: config.format === 'cash',
      outcome: null,
      net: 0,
    })),
    phase: 'handOver',
    hand: 0,
    first: -1,
    dealer: [],
    shoe: [],
    toAct: null,
    log: [],
    busts: [],
  }
}

function nextAlive(seats: ShowdownSeat[], from: number, pred: (s: ShowdownSeat) => boolean = () => true): number {
  const n = seats.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (!seats[i]!.out && !seats[i]!.empty && pred(seats[i]!)) return i
  }
  return -1
}

/** Seats in turn order for this hand, starting with `first`. */
function turnOrder(state: Pick<ShowdownState, 'seats' | 'first'>): number[] {
  const n = state.seats.length
  return Array.from({ length: n }, (_, k) => (state.first + k) % n).filter((i) => !state.seats[i]!.out && !state.seats[i]!.empty)
}

function startHand(prev: ShowdownState, rng: Rng): ShowdownState {
  const { config } = prev
  const shoe = prev.shoe.length < config.reshuffleAt ? newShoe(config.decks, rng) : prev.shoe
  const seats = prev.seats.map((s) => ({ ...s, bet: 0, cards: [], done: false, doubled: false, outcome: null, net: 0 }))
  // The first bettor rotates round the table; the very first one is drawn.
  const first = prev.first < 0 ? nextAlive(seats, Math.floor(rng() * seats.length) - 1 + seats.length) : nextAlive(seats, prev.first)
  return { ...prev, seats, shoe, first, dealer: [], phase: 'betting', hand: prev.hand + 1, toAct: first }
}

export function legalFor(state: ShowdownState, seat: number): ShowdownLegal | null {
  if (state.toAct !== seat) return null
  const s = state.seats[seat]!
  if (state.phase === 'betting') {
    const max = Math.min(state.config.maxBet, s.stack)
    const min = state.config.format === 'cash' ? Math.min(state.config.minBet, max) : Math.min(showdownMinBetForHand(state.hand), max)
    return { bet: { min, max }, canHit: false, canStand: false, canDouble: false }
  }
  if (state.phase === 'playing') {
    return {
      bet: null,
      canHit: true,
      canStand: true,
      canDouble: s.cards.length === 2 && s.stack >= s.bet * 2,
    }
  }
  return null
}

function draw(shoe: Card[]): [Card, Card[]] {
  return [shoe[0]!, shoe.slice(1)]
}

function deal(state: ShowdownState): ShowdownState {
  const order = turnOrder(state)
  const seats = state.seats.map((s) => ({ ...s, cards: [...s.cards] }))
  let shoe = state.shoe
  const dealer: Card[] = []
  let card: Card
  for (let round = 0; round < 2; round++) {
    for (const i of order) {
      ;[card, shoe] = draw(shoe)
      seats[i]!.cards.push(card)
    }
    ;[card, shoe] = draw(shoe)
    dealer.push(card)
  }
  for (const i of order) if (isBlackjack(seats[i]!.cards)) seats[i]!.done = true
  const next: ShowdownState = { ...state, seats, shoe, dealer, phase: 'playing', toAct: null }
  // Dealer blackjack: the hand is over for everyone at once.
  if (isBlackjack(dealer)) return settle(next)
  return nextToPlay(next, -1)
}

function nextToPlay(state: ShowdownState, after: number): ShowdownState {
  const order = turnOrder(state)
  const start = after < 0 ? 0 : order.indexOf(after) + 1
  const next = order.slice(start).find((i) => !state.seats[i]!.done)
  if (next != null) return { ...state, toAct: next }
  return settle(playDealer(state))
}

function playDealer(state: ShowdownState): ShowdownState {
  // Only draw if some hand is still live (not bust, not a paid blackjack).
  const live = state.seats.some((s) => !s.out && !isBust(s.cards) && !isBlackjack(s.cards))
  if (!live) return state
  let dealer = state.dealer
  let shoe = state.shoe
  while (dealerShouldHit(dealer) && shoe.length) {
    dealer = [...dealer, shoe[0]!]
    shoe = shoe.slice(1)
  }
  return { ...state, dealer, shoe }
}

export function outcomeOf(cards: Card[], dealer: Card[]): ShowdownOutcome {
  const dealerBj = isBlackjack(dealer)
  if (isBlackjack(cards)) return dealerBj ? 'push' : 'blackjack'
  if (dealerBj || isBust(cards)) return 'loss'
  if (isBust(dealer)) return 'win'
  const you = calculateHandValue(cards)
  const them = calculateHandValue(dealer)
  return you > them ? 'win' : you === them ? 'push' : 'loss'
}

function settle(state: ShowdownState): ShowdownState {
  const busts = [...state.busts]
  const seats = state.seats.map((s, i) => {
    if (s.out) return s
    const outcome = outcomeOf(s.cards, state.dealer)
    const net = outcome === 'blackjack' ? Math.floor(s.bet * 1.5) : outcome === 'win' ? s.bet : outcome === 'push' ? 0 : -s.bet
    const stack = s.stack + net
    const out = stack < showdownMinBetForHand(state.hand + 1)
    if (out) busts.push({ seat: i, hand: state.hand, stack })
    return { ...s, outcome, net, stack, done: true, out }
  })
  const alive = seats.filter((s) => !s.out && !s.empty).length
  const over = state.config.format !== 'cash' && (state.hand >= state.config.hands || alive <= 1)
  return { ...state, seats, busts, toAct: null, phase: over ? 'over' : 'handOver' }
}

function applyShowdown(prev: ShowdownState, seat: number, action: ShowdownAction): ShowdownState {
  const legal = legalFor(prev, seat)
  if (!legal) throw new Error(`Showdown: seat ${seat} cannot act now`)
  const log = [...prev.log, { hand: prev.hand, seat, action }]
  const seats = prev.seats.map((s) => ({ ...s }))
  const s = seats[seat]!

  if (action.type === 'bet') {
    const amount = Math.floor(action.amount)
    if (!legal.bet || amount < legal.bet.min || amount > legal.bet.max) {
      throw new Error(`Showdown: bet ${amount} is outside the limits`)
    }
    s.bet = amount
    const state = { ...prev, seats, log }
    const next = nextAlive(seats, seat, (o) => o.bet === 0)
    return next === -1 ? deal(state) : { ...state, toAct: next }
  }

  if (!legal.canHit) throw new Error(`Showdown: seat ${seat} is not playing a hand`)
  let shoe = prev.shoe
  if (action.type === 'stand') {
    s.done = true
  } else if (action.type === 'hit' || action.type === 'double') {
    if (action.type === 'double') {
      if (!legal.canDouble) throw new Error(`Showdown: seat ${seat} cannot double`)
      s.bet *= 2
      s.doubled = true
    }
    s.cards = [...s.cards, shoe[0]!]
    shoe = shoe.slice(1)
    if (action.type === 'double' || isBust(s.cards) || calculateHandValue(s.cards) === 21) s.done = true
  }
  const state = { ...prev, seats, shoe, log }
  return s.done ? nextToPlay(state, seat) : state
}

export function viewShowdown(state: ShowdownState, seat: number): ShowdownView {
  const secretBets = state.config.format !== 'cash' && state.hand === state.config.hands && state.phase === 'betting'
  const hideHole = state.phase === 'betting' || state.phase === 'playing'
  return {
    seat,
    config: state.config,
    phase: state.phase,
    hand: state.hand,
    first: state.first,
    dealer: state.dealer.map((c, i) => (i === 1 && hideHole ? null : c)),
    toAct: state.toAct,
    seats: state.seats.map((s, i) => ({
      ...s,
      bet: secretBets && i !== seat ? null : s.bet,
      hasBet: s.bet > 0,
    })),
    secretBets,
    log: secretBets ? state.log.filter((e) => e.hand !== state.hand || e.seat === seat) : state.log,
    legal: legalFor(state, seat),
    cardsLeft: state.shoe.length,
  }
}

export const showdownCashOps = {
  betweenHands: (state: ShowdownState) => state.phase === 'handOver',
  sit: (state: ShowdownState, seat: number, stack: number) => ({ ...state, seats: state.seats.map((s, i) => i === seat ? { ...s, stack, empty: false, out: false } : s) }),
  stand: (state: ShowdownState, seat: number) => { const stack = state.seats[seat]!.stack; return { stack, state: { ...state, seats: state.seats.map((s, i) => i === seat ? { ...s, stack: 0, empty: true, out: false } : s) } } },
  addChips: (state: ShowdownState, seat: number, amount: number) => ({ ...state, seats: state.seats.map((s, i) => i === seat ? { ...s, stack: s.stack + amount } : s) }),
  stackBehind: (state: ShowdownState, seat: number) => state.seats[seat]!.stack,
  inPlay: (state: ShowdownState, seat: number) => state.phase === 'playing' && !state.seats[seat]!.done,
  leaveAction: (state: ShowdownState) => state,
  emptySeats: (state: ShowdownState) => state.seats.map((s, i) => s.empty ? i : -1).filter((i) => i >= 0),
  handsPlayed: (state: ShowdownState) => state.hand,
}

function showdownStandings(state: ShowdownState): Standings {
  const alive = state.seats.map((_, i) => i).filter((i) => !state.seats[i]!.out)
  return rankSeats(
    alive,
    state.busts.map((b) => ({ seat: b.seat, order: b.hand, tiebreak: b.stack })),
    state.phase === 'over' ? (i) => state.seats[i]!.stack : undefined,
  )
}

export const showdownEngine: TableEngine<ShowdownState, ShowdownView, ShowdownAction> = {
  viewFor: viewShowdown,
  toAct: (s) => (s.phase === 'betting' || s.phase === 'playing' ? s.toAct : null),
  apply: applyShowdown,
  needsAdvance: (s) => s.phase === 'handOver',
  advance: (s, rng) => {
    if (s.phase !== 'handOver') throw new Error('Showdown: nothing to deal')
    return startHand(s, rng)
  },
  timeoutAction: (s, seat) =>
    s.phase === 'betting' ? { type: 'bet', amount: legalFor(s, seat)?.bet?.min ?? s.config.minBet } : { type: 'stand' },
  isOver: (s) => s.phase === 'over',
  standings: showdownStandings,
  placeOf: (s, seat) => (s.seats[seat]!.out || s.phase === 'over' ? placeIn(showdownStandings(s), seat) : null),
}
