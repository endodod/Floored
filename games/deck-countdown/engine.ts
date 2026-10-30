import type { HiLoCard } from '@/games/hilo/types'
import type { DeckCountdownState } from './types'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const VALUES: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 }
const CARDS: HiLoCard[] = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank, value: VALUES[rank]! })))

function buildMultipliers(): number[] {
  const multipliers = [0, 1]
  let fairReturn = 0.97
  for (let flip = 2; flip <= 13; flip++) {
    fairReturn *= (53 - flip) / (56 - 4 * flip)
    multipliers[flip] = Math.floor(fairReturn * 100) / 100
  }
  return multipliers
}

export const DECK_COUNTDOWN_MULTS = buildMultipliers()

function shuffledDeck(): HiLoCard[] {
  const deck = [...CARDS]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j]!, deck[i]!]
  }
  return deck
}

export function initDeckCountdown(): DeckCountdownState {
  return { stage: 'betting', deck: [], flipped: [], bustCard: null, burnedCards: [], betAmount: 0, multiplier: 1, outcome: null, message: 'Place your bet.' }
}

export function startDeckCountdown(betAmount: number): DeckCountdownState {
  const deck = shuffledDeck()
  const first = deck.pop()!
  return { stage: 'playing', deck, flipped: [first], bustCard: null, burnedCards: [], betAmount, multiplier: 1, outcome: null, message: 'A new rank. Flip again or cash out.' }
}

export function flipDeckCountdown(state: DeckCountdownState): DeckCountdownState {
  if (state.stage !== 'playing' || !state.deck.length) return state
  const deck = [...state.deck]
  const card = deck.pop()!
  if (state.flipped.some(c => c.rank === card.rank)) return { ...state, stage: 'settled', deck, bustCard: card, outcome: 'loss', message: `Repeat ${card.rank} — busted.` }
  const flipped = [...state.flipped, card]
  const multiplier = DECK_COUNTDOWN_MULTS[flipped.length]!
  if (flipped.length === 13) return { ...state, deck, flipped, multiplier, outcome: 'win', stage: 'settled', message: 'All 13 ranks cleared!' }
  return { ...state, deck, flipped, multiplier, message: `${flipped.length} ranks cleared. Flip again or cash out.` }
}

/** Burn the first repeated rank, then immediately resolve the same flip again. */
export function flipWithBurn(state: DeckCountdownState): DeckCountdownState {
  if (state.stage !== 'playing' || !state.deck.length) return state
  const deck = [...state.deck]
  const first = deck.pop()!
  if (!state.flipped.some(c => c.rank === first.rank)) return flipDeckCountdown(state)
  const second = deck.pop()
  if (!second) return { ...state, deck, bustCard: first, stage: 'settled', outcome: 'loss', message: `Repeat ${first.rank} — busted.` }
  const burnedCards = [...state.burnedCards, first]
  const flipped = [...state.flipped, second]
  if (state.flipped.some(c => c.rank === second.rank)) return { ...state, deck, burnedCards, bustCard: second, stage: 'settled', outcome: 'loss', message: `Repeat ${second.rank} — busted.` }
  const multiplier = DECK_COUNTDOWN_MULTS[flipped.length]!
  if (flipped.length === 13) return { ...state, deck, burnedCards, flipped, multiplier, outcome: 'win', stage: 'settled', message: 'All 13 ranks cleared!' }
  return { ...state, deck, burnedCards, flipped, multiplier, message: `${flipped.length} ranks cleared. Flip again or cash out.` }
}

export function cashOutDeckCountdown(state: DeckCountdownState): DeckCountdownState {
  if (state.stage !== 'playing' || state.flipped.length < 2) return state
  return { ...state, stage: 'settled', outcome: 'win', message: `Cashed out at ${state.multiplier.toFixed(2)}×.` }
}

export function bustChance(state: DeckCountdownState): number {
  return state.deck.length ? Math.max(0, (3 * state.flipped.length - state.burnedCards.length) / state.deck.length) : 0
}

export function winFlip(state: DeckCountdownState): DeckCountdownState {
  if (state.stage !== 'playing') return state
  const i = state.deck.findIndex(c => !state.flipped.some(f => f.rank === c.rank))
  if (i < 0) return flipDeckCountdown(state)
  const deck = [...state.deck]; const [card] = deck.splice(i, 1)
  return flipDeckCountdown({ ...state, deck: [...deck, card!] })
}

export function loseFlip(state: DeckCountdownState): DeckCountdownState {
  if (state.stage !== 'playing') return state
  const i = state.deck.findIndex(c => state.flipped.some(f => f.rank === c.rank))
  if (i < 0) return flipDeckCountdown(state)
  const deck = [...state.deck]; const [card] = deck.splice(i, 1)
  return flipDeckCountdown({ ...state, deck: [...deck, card!] })
}
