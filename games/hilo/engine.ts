import type { HiLoCard, HiLoState } from './types'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
}

const ALL_CARDS: HiLoCard[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({ suit, rank, value: RANK_VALUES[rank] ?? 0 }))
)

function randomCard(): HiLoCard {
  return ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)]!
}

function randomCardWhere(pred: (c: HiLoCard) => boolean): HiLoCard | null {
  const pool = ALL_CARDS.filter(pred)
  return pool.length === 0 ? null : pool[Math.floor(Math.random() * pool.length)]!
}

/** multiplier(streak) = 2 × 1.5^(streak−1), rounded to 2 dp. */
export function streakMultiplier(streak: number): number {
  return Math.round(2 * Math.pow(1.5, streak - 1) * 100) / 100
}

export function initHiLo(): HiLoState {
  return {
    deck: [],
    currentCard: null,
    nextCard: null,
    betAmount: 0,
    stage: 'betting',
    outcome: null,
    lastGuess: null,
    streak: 0,
    multiplier: 0,
    isTie: false,
    message: 'Place your bet.',
  }
}

export function startHiLoRound(betAmount: number): HiLoState {
  // Never deal A or 2 as the opening card — one side is always an impossible guess
  const currentCard = randomCardWhere((c) => c.value > 2 && c.value < 14)
  return {
    deck: [],
    currentCard,
    nextCard: null,
    betAmount,
    stage: 'playing',
    outcome: null,
    lastGuess: null,
    streak: 0,
    multiplier: 0,
    isTie: false,
    message: 'Higher or Lower?',
  }
}

/** Story pricing: each right guess multiplies the multiplier by this price for its own odds. */
export type HiLoPricing = (pWin: number) => number

/** Chance (out of 13 values) that the next card is strictly higher or lower than this one. */
export function hiloWinChance(current: HiLoCard, guess: 'higher' | 'lower'): number {
  const n = guess === 'higher' ? 14 - current.value : current.value - 2
  return n / 13
}

/** The multiplier a right guess would reach with story pricing (the current one starts at 1). */
export function storyNextMultiplier(state: HiLoState, guess: 'higher' | 'lower', pricing: HiLoPricing): number {
  const p = hiloWinChance(state.currentCard!, guess)
  return p > 0 ? Math.round(Math.max(1, state.multiplier) * pricing(p) * 100) / 100 : 0
}

export function guessHiLo(state: HiLoState, guess: 'higher' | 'lower', pricing?: HiLoPricing): HiLoState {
  const nextCard = randomCard()
  const current = state.currentCard!

  const isWin =
    guess === 'higher'
      ? nextCard.value > current.value
      : nextCard.value < current.value

  if (isWin) {
    const newStreak = state.streak + 1
    const newMult = pricing ? storyNextMultiplier(state, guess, pricing) : streakMultiplier(newStreak)
    return {
      ...state,
      nextCard,
      lastGuess: guess,
      streak: newStreak,
      multiplier: newMult,
      isTie: false,
      stage: 'riding',
      message: `${nextCard.rank}${nextCard.suit} — ${newMult}× · Cash out or go again?`,
    }
  }

  if (nextCard.value === current.value) {
    const keptMult = Math.max(1, state.multiplier)
    const multHint = state.multiplier > 1 ? ` · ${state.multiplier}× preserved` : ''
    return {
      ...state,
      nextCard,
      lastGuess: guess,
      isTie: true,
      stage: 'riding',
      multiplier: keptMult,
      message: `${nextCard.rank}${nextCard.suit} — Tie${multHint}. Cash out or keep going.`,
    }
  }

  return {
    ...state,
    nextCard,
    lastGuess: guess,
    isTie: false,
    outcome: 'loss',
    stage: 'settled',
    message: `${nextCard.rank}${nextCard.suit} — Wrong call.`,
  }
}

/** Force-tie: draws a card with the same value as the current card (for testing ties). */
export function tieGame(state: HiLoState): HiLoState {
  if (state.stage !== 'playing' && state.stage !== 'riding') return state
  const current = state.currentCard!
  const nextCard = randomCardWhere((c) => c.value === current.value)
  if (!nextCard) return state
  const keptMult = Math.max(1, state.multiplier)
  const multHint = state.multiplier > 1 ? ` · ${state.multiplier}× preserved` : ''
  return {
    ...state,
    nextCard,
    lastGuess: null,
    isTie: true,
    stage: 'riding',
    multiplier: keptMult,
    message: `${nextCard.rank}${nextCard.suit} — Tie${multHint}. Cash out or keep going.`,
  }
}

/** Blessed guess: forces a winning card; on impossible guess (Ace+higher) forces a tie instead. */
export function winGame(state: HiLoState, guess: 'higher' | 'lower'): HiLoState {
  if (state.stage !== 'playing' && state.stage !== 'riding') return state
  const current = state.currentCard!
  const nextCard = randomCardWhere((c) =>
    guess === 'higher' ? c.value > current.value : c.value < current.value
  )
  if (!nextCard) {
    // Impossible guess (e.g. higher on Ace) — force a tie so blessed can't lose
    const tieCard = randomCardWhere((c) => c.value === current.value)
    if (!tieCard) return cashOutHiLo({ ...state, multiplier: Math.max(1, state.multiplier) })
    const keptMult = Math.max(1, state.multiplier)
    const multHint = state.multiplier > 1 ? ` · ${state.multiplier}× preserved` : ''
    return {
      ...state,
      nextCard: tieCard,
      lastGuess: guess,
      isTie: true,
      stage: 'riding',
      multiplier: keptMult,
      message: `${tieCard.rank}${tieCard.suit} — Tie${multHint}. Cash out or keep going.`,
    }
  }
  const newStreak = state.streak + 1
  const newMult = streakMultiplier(newStreak)
  return {
    ...state,
    nextCard,
    lastGuess: guess,
    isTie: false,
    streak: newStreak,
    multiplier: newMult,
    stage: 'riding',
    message: `${nextCard.rank}${nextCard.suit} — ${newMult}× · Cash out or go again?`,
  }
}

/** Cursed guess: forces a losing card. */
export function loseGame(state: HiLoState, guess: 'higher' | 'lower'): HiLoState {
  if (state.stage !== 'playing' && state.stage !== 'riding') return state
  const current = state.currentCard!
  const nextCard = randomCardWhere((c) =>
    guess === 'higher' ? c.value < current.value : c.value > current.value
  )
  if (!nextCard) return guessHiLo(state, guess)
  return {
    ...state,
    nextCard,
    lastGuess: guess,
    isTie: false,
    outcome: 'loss',
    stage: 'settled',
    message: `${nextCard.rank}${nextCard.suit} — Wrong call.`,
  }
}

/** Hot Streak perk: advances streak by 1 extra and recalculates the multiplier. */
export function bumpStreak(state: HiLoState): HiLoState {
  const newStreak = state.streak + 1
  const newMult = streakMultiplier(newStreak)
  return {
    ...state,
    streak: newStreak,
    multiplier: newMult,
    message: `${state.nextCard?.rank}${state.nextCard?.suit} — ${newMult}× · Cash out or go again?`,
  }
}

/** Player cashes out — locks in the current multiplier as a win. */
export function cashOutHiLo(state: HiLoState): HiLoState {
  return {
    ...state,
    isTie: false,
    outcome: 'win',
    stage: 'settled',
    message: `Cashed out at ${state.multiplier}×!`,
  }
}

/** Player goes again — last revealed card becomes the current card; bet on the next. */
export function goAgainHiLo(state: HiLoState): HiLoState {
  return {
    ...state,
    isTie: false,
    currentCard: state.nextCard,
    nextCard: null,
    lastGuess: null,
    stage: 'playing',
    message: 'Higher or Lower?',
  }
}
