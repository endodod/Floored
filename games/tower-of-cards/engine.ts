import type { HiLoCard } from '@/games/hilo/types'
import type { TowerCall, TowerOption, TowerState } from './types'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const VALUES: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 }
const CARDS: HiLoCard[] = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank, value: VALUES[rank]! })))

function shuffledDeck(): HiLoCard[] {
  const deck = [...CARDS]
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j]!, deck[i]!] }
  return deck
}
function round2(value: number) { return Math.round(value * 100) / 100 }
function floor2(value: number) { return Math.floor(value * 100) / 100 }
function isRed(suit: string) { return suit === '♥' || suit === '♦' }
function isWin(card: HiLoCard, call: TowerCall, cards: HiLoCard[]): boolean {
  if (call.step === 1) return isRed(card.suit) === (call.pick === 'red')
  if (call.step === 2) return call.pick === 'higher' ? card.value > cards[0]!.value : card.value < cards[0]!.value
  if (call.step === 3) {
    const low = Math.min(cards[0]!.value, cards[1]!.value), high = Math.max(cards[0]!.value, cards[1]!.value)
    return call.pick === 'inside' ? card.value > low && card.value < high : card.value < low || card.value > high
  }
  return card.suit === call.pick
}
function payFor(call: TowerCall, state: TowerState): number | null {
  if (call.step === 1) return 1.94
  const wins = state.deck.filter(card => isWin(card, call, state.cards)).length
  return wins === 0 ? null : floor2(state.deck.length / wins)
}
export function optionsFor(state: TowerState): TowerOption[] {
  const picks: TowerCall['pick'][] = state.step === 1 ? ['red', 'black'] : state.step === 2 ? ['higher', 'lower'] : state.step === 3 ? ['inside', 'outside'] : ['♠', '♥', '♦', '♣']
  return picks.map(pick => ({ pick, mult: payFor({ step: state.step, pick } as TowerCall, state) }))
}
export function initTower(): TowerState { return { stage: 'betting', deck: [], cards: [], stepMultipliers: [], step: 1, betAmount: 0, multiplier: 0, outcome: null, lastCall: null, message: 'Place your bet.' } }
export function startTower(betAmount: number): TowerState { return { ...initTower(), stage: 'playing', deck: shuffledDeck(), betAmount, message: 'Call the colour of the first card.' } }
export function callTower(state: TowerState, call: TowerCall, safetyNet = false): TowerState {
  if (state.stage !== 'playing' || call.step !== state.step || payFor(call, state) == null) return state
  const deck = [...state.deck], card = deck.pop()!
  if (!isWin(card, call, state.cards)) {
    if (safetyNet) {
      const multiplier = call.step === 1 ? 1 : state.multiplier
      const outcome = multiplier > 1 ? 'win' : 'push'
      return { ...state, deck, cards: [...state.cards, card], multiplier, lastCall: call, stage: 'settled', outcome, message: `Wrong call — ${card.rank}${card.suit}. Safety Net returns ${multiplier.toFixed(2)}×.` }
    }
    return { ...state, deck, cards: [...state.cards, card], lastCall: call, stage: 'settled', outcome: 'loss', message: `Wrong call — ${card.rank}${card.suit}.` }
  }
  const cards = [...state.cards, card]
  const stepMultiplier = payFor(call, state)!
  const stepMultipliers = [...state.stepMultipliers, stepMultiplier]
  const multiplier = round2((call.step === 1 ? 1 : state.multiplier) * stepMultiplier)
  if (call.step === 4) return { ...state, deck, cards, stepMultipliers, multiplier, lastCall: call, stage: 'settled', outcome: 'win', message: `Four calls cleared at ${multiplier.toFixed(2)}×!` }
  return { ...state, deck, cards, stepMultipliers, multiplier, step: (call.step + 1) as TowerState['step'], lastCall: call, stage: 'riding', outcome: null, message: `Right call — ${multiplier.toFixed(2)}×. Cash out or go on?` }
}
export function goOnTower(state: TowerState): TowerState { return state.stage === 'riding' ? { ...state, stage: 'playing', message: `Make call ${state.step}.` } : state }
export function cashOutTower(state: TowerState): TowerState { return state.stage === 'riding' ? { ...state, stage: 'settled', outcome: 'win', message: `Cashed out at ${state.multiplier.toFixed(2)}×.` } : state }
function moveCard(state: TowerState, pred: (card: HiLoCard) => boolean, call: TowerCall, shouldWin: boolean): TowerState {
  const index = state.deck.findIndex(card => pred(card) && isWin(card, call, state.cards) === shouldWin)
  if (index < 0) return callTower(state, call)
  const deck = [...state.deck], [card] = deck.splice(index, 1)
  deck.push(card!)
  return callTower({ ...state, deck }, call)
}
export function winCall(state: TowerState, call: TowerCall): TowerState { return moveCard(state, () => true, call, true) }
export function loseCall(state: TowerState, call: TowerCall): TowerState { return moveCard(state, () => true, call, false) }
