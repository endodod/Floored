import type {
  BlackjackCard,
  BlackjackOutcome,
  BlackjackState,
  GameEngine,
} from './types'

const SUITS: BlackjackCard['suit'][] = ['♠', '♥', '♦', '♣']
const RANKS: BlackjackCard['rank'][] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

function newDeck(): BlackjackCard[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })))
}

function shuffle(deck: BlackjackCard[]): BlackjackCard[] {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = result[i]!
    result[i] = result[j]!
    result[j] = temp
  }
  return result
}

function cardValues(card: BlackjackCard): number[] {
  if (card.rank === 'A') return [1, 11]
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return [10]
  return [parseInt(card.rank, 10)]
}

export function handTotals(cards: BlackjackCard[]): number[] {
  const totals = cards.reduce<number[]>((acc, card) => {
    const values = cardValues(card)
    return acc.flatMap((total) => values.map((value) => total + value))
  }, [0])

  return Array.from(new Set(totals)).sort((a, b) => a - b)
}

export function calculateHandValue(cards: BlackjackCard[]): number {
  const totals = handTotals(cards)
  const validTotals = totals.filter((value) => value <= 21)
  return validTotals.length > 0 ? Math.max(...validTotals) : Math.min(...totals)
}

export function isBust(cards: BlackjackCard[]): boolean {
  return handTotals(cards).every((total) => total > 21)
}

export function isBlackjack(cards: BlackjackCard[]): boolean {
  return cards.length === 2 && handTotals(cards).includes(21)
}

export function dealerShouldHit(cards: BlackjackCard[]): boolean {
  const totals = handTotals(cards).filter((total) => total <= 21)
  if (totals.length === 0) return false
  return Math.max(...totals) < 17
}

function playDealer(deck: BlackjackCard[], dealerHand: BlackjackCard[]) {
  let currentDeck = [...deck]
  let currentHand = [...dealerHand]

  while (dealerShouldHit(currentHand)) {
    const [next, ...rest] = currentDeck
    if (!next) break
    currentHand = [...currentHand, next]
    currentDeck = rest
  }

  return { dealerHand: currentHand, deck: currentDeck }
}

// Cursed dealer: keeps hitting until it beats targetValue (ignores bust limit).
function cursedPlayDealer(deck: BlackjackCard[], dealerHand: BlackjackCard[], targetValue: number) {
  let currentDeck = [...deck]
  let currentHand = [...dealerHand]

  while (calculateHandValue(currentHand) <= targetValue && currentDeck.length > 0) {
    const [next, ...rest] = currentDeck
    if (!next) break
    currentHand = [...currentHand, next]
    currentDeck = rest
  }

  return { dealerHand: currentHand, deck: currentDeck }
}

function settle(state: BlackjackState, outcome: BlackjackOutcome): BlackjackState {
  const multiplier =
    outcome === 'win'
      ? state.playerBlackjack
        ? 2.5
        : 2
      : outcome === 'push'
      ? 1
      : 0

  const message =
    outcome === 'win'
      ? state.playerBlackjack
        ? 'Blackjack! You win.'
        : 'You win.'
      : outcome === 'push'
      ? 'Push. Your bet is returned.'
      : 'You lose.'

  return {
    ...state,
    stage: 'settled',
    outcome,
    payoutMultiplier: multiplier,
    message,
    canDouble: false,
  }
}

export function initBlackjack(): BlackjackState {
  return {
    deck: shuffle(newDeck()),
    playerHand: [],
    dealerHand: [],
    betAmount: 0,
    stage: 'betting',
    outcome: null,
    payoutMultiplier: 1,
    message: 'Place your bet.',
    canDouble: false,
    playerBlackjack: false,
    dealerBlackjack: false,
  }
}


export function startBlackjackRound(betAmount: number): BlackjackState {
  const deck = shuffle(newDeck())
  const [playerOne, dealerOne, playerTwo, dealerTwo, ...rest] = deck
  const playerHand = [playerOne!, playerTwo!]
  const dealerHand = [dealerOne!, dealerTwo!]
  const playerBlackjack = isBlackjack(playerHand)
  const dealerBlackjack = isBlackjack(dealerHand)
  const initialState: BlackjackState = {
    deck: rest,
    playerHand,
    dealerHand,
    betAmount,
    stage: playerBlackjack || dealerBlackjack ? 'settled' : 'inProgress',
    outcome: null,
    payoutMultiplier: 1,
    message: 'Your move.',
    canDouble: !playerBlackjack && !dealerBlackjack,
    playerBlackjack,
    dealerBlackjack,
  }

  if (playerBlackjack || dealerBlackjack) {
    const outcome: BlackjackOutcome = playerBlackjack
      ? dealerBlackjack ? 'push' : 'win'
      : 'loss'
    return settle(initialState, outcome)
  }

  return initialState
}

/** Pre-deal hands for Hole Card Reader L2+ (betting-phase preview). */
export function previewBlackjackDeal(): BlackjackState {
  let state = startBlackjackRound(1)
  let guard = 0
  while (state.stage === 'settled' && guard++ < 32) {
    state = startBlackjackRound(1)
  }
  return {
    ...state,
    stage: 'betting',
    betAmount: 0,
    outcome: null,
    payoutMultiplier: 1,
    message: 'Place your bet.',
    canDouble: !state.playerBlackjack && !state.dealerBlackjack,
  }
}

export function commitPreviewBlackjack(preview: BlackjackState, betAmount: number): BlackjackState {
  if (preview.playerBlackjack || preview.dealerBlackjack) {
    const outcome: BlackjackOutcome = preview.playerBlackjack
      ? preview.dealerBlackjack
        ? 'push'
        : 'win'
      : 'loss'
    return settle({ ...preview, betAmount }, outcome)
  }
  return {
    ...preview,
    betAmount,
    stage: 'inProgress',
    outcome: null,
    message: 'Your move.',
    canDouble: true,
  }
}

export function hitBlackjack(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state
  const [next, ...rest] = state.deck
  if (!next) return { ...state, stage: 'settled', outcome: 'loss', message: 'No cards left.', canDouble: false }

  const nextState: BlackjackState = {
    ...state,
    deck: rest,
    playerHand: [...state.playerHand, next],
    canDouble: false,
    message: 'You hit.',
  }

  if (isBust(nextState.playerHand)) return settle(nextState, 'loss')
  if (calculateHandValue(nextState.playerHand) === 21) return standBlackjack(nextState)
  return nextState
}

export function standBlackjack(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state
  const { dealerHand, deck } = playDealer(state.deck, state.dealerHand)
  const nextState = {
    ...state,
    deck,
    dealerHand,
    message: 'Dealer plays.',
    canDouble: false,
  }

  if (isBust(dealerHand)) {
    return settle(nextState, 'win')
  }

  const playerValue = calculateHandValue(state.playerHand)
  const dealerValue = calculateHandValue(dealerHand)

  if (playerValue > dealerValue) return settle(nextState, 'win')
  if (playerValue === dealerValue) return settle(nextState, 'push')
  return settle(nextState, 'loss')
}

export function doubleDownBlackjack(
  state: BlackjackState,
  opts?: { allowMultiCard?: boolean },
): BlackjackState {
  if (state.stage !== 'inProgress') return state
  if (!opts?.allowMultiCard && state.playerHand.length !== 2) return state
  const [next, ...rest] = state.deck
  if (!next) return { ...state, stage: 'settled', outcome: 'loss', message: 'No cards left.', canDouble: false }

  const doubledState: BlackjackState = {
    ...state,
    deck: rest,
    playerHand: [...state.playerHand, next],
    betAmount: state.betAmount * 2,
    canDouble: false,
    message: 'Double down.',
  }

  if (isBust(doubledState.playerHand)) {
    return settle(doubledState, 'loss')
  }

  return standBlackjack(doubledState)
}

// ─── Cursed variants (used when the player is cursed) ───────────────────────

/**
 * Build a deck where the player starts with a weak hand (total 12–16) and
 * the dealer starts with a strong hand (total 17–20). The remaining cards
 * are shuffled normally so subsequent draws look organic.
 * Which dealer card is face-up is randomised to avoid a visible pattern.
 */
function buildCursedDeck(): BlackjackCard[] {
  const pool = shuffle(newDeck())

  const playerFirst  = pool.find(c => ['5','6','7'].includes(c.rank))
  const playerSecond = pool.find(c => c !== playerFirst && ['7','8','9'].includes(c.rank))
  // Dealer starts under 16 so their hand looks beatable; loseStand handles the rest.
  const dealerFirst  = pool.find(c => ![playerFirst, playerSecond].includes(c) && ['6','7','8'].includes(c.rank))
  const dealerSecond = pool.find(c => ![playerFirst, playerSecond, dealerFirst].includes(c) && ['5','6','7'].includes(c.rank))

  if (!playerFirst || !playerSecond || !dealerFirst || !dealerSecond) return pool

  const [dealerFaceUp, dealerHole] = Math.random() < 0.5
    ? [dealerFirst, dealerSecond]
    : [dealerSecond, dealerFirst]

  const reserved = new Set([playerFirst, playerSecond, dealerFaceUp, dealerHole])
  const remaining = shuffle(pool.filter(c => !reserved.has(c)))
  // Deal order: player[0], dealer[0-faceup], player[1], dealer[1-hole], ...rest
  return [playerFirst, dealerFaceUp, playerSecond, dealerHole, ...remaining]
}

/** Start a cursed round: player gets a weak hand, dealer gets a strong hand. */
export function loseGame(betAmount: number): BlackjackState {
  const deck = buildCursedDeck()
  const [p1, d1, p2, d2, ...rest] = deck
  return {
    deck: rest,
    playerHand: [p1!, p2!],
    dealerHand: [d1!, d2!],
    betAmount,
    stage: 'inProgress',
    outcome: null,
    payoutMultiplier: 1,
    message: 'Your move.',
    canDouble: true,
    playerBlackjack: false,
    dealerBlackjack: false,
  }
}

/**
 * Cursed hit: if the player's current total is above 11, the next card drawn
 * is always a 10-value card — guaranteeing a bust. Below 12 the draw is normal.
 */
export function loseHit(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state

  let deck = [...state.deck]
  const playerValue = calculateHandValue(state.playerHand)

  if (playerValue > 12) {
    const tenIdx = deck.findIndex(c => ['10','J','Q','K'].includes(c.rank))
    if (tenIdx > 0) {
      ;[deck[0], deck[tenIdx]] = [deck[tenIdx]!, deck[0]!]
    }
  }

  const [next, ...rest] = deck
  if (!next) return { ...state, stage: 'settled', outcome: 'loss', message: 'No cards left.', canDouble: false }

  const nextState: BlackjackState = {
    ...state,
    deck: rest,
    playerHand: [...state.playerHand, next],
    canDouble: false,
    message: 'You hit.',
  }

  if (isBust(nextState.playerHand)) return settle(nextState, 'loss')
  if (calculateHandValue(nextState.playerHand) === 21) return loseStand(nextState)
  return nextState
}

/**
 * Cursed stand: dealer keeps drawing until it beats the player, then always
 * settles as a loss. Dealer can reach 21.
 */
export function loseStand(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state
  const playerValue = calculateHandValue(state.playerHand)
  const { dealerHand, deck } = cursedPlayDealer(state.deck, state.dealerHand, playerValue)
  return settle({ ...state, deck, dealerHand, message: 'Dealer plays.', canDouble: false }, 'loss')
}

/** Cursed double-down: applies the cursed hit rule then cursed stand. */
export function loseDouble(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress' || state.playerHand.length !== 2) return state

  let deck = [...state.deck]
  const playerValue = calculateHandValue(state.playerHand)

  if (playerValue > 12) {
    const tenIdx = deck.findIndex(c => ['10','J','Q','K'].includes(c.rank))
    if (tenIdx > 0) {
      ;[deck[0], deck[tenIdx]] = [deck[tenIdx]!, deck[0]!]
    }
  }

  const [next, ...rest] = deck
  if (!next) return { ...state, stage: 'settled', outcome: 'loss', message: 'No cards left.', canDouble: false }

  const doubledState: BlackjackState = {
    ...state,
    deck: rest,
    playerHand: [...state.playerHand, next],
    betAmount: state.betAmount * 2,
    canDouble: false,
    message: 'Double down.',
  }

  if (isBust(doubledState.playerHand)) return settle(doubledState, 'loss')
  return loseStand(doubledState)
}

// ─── Blessed variants (used when the player is blessed) ────────────────────

function buildBlessedDeck(): BlackjackCard[] {
  const pool = shuffle(newDeck())
  // First card from A/7/8/9/10 (equal 20% each) + 10-value second card
  // gives BJ(21) / 17 / 18 / 19 / 20 with equal probability.
  const goodFirstRanks: BlackjackCard['rank'][] = ['A', '7', '8', '9', '10']
  const playerFirst  = pool.find(c => goodFirstRanks.includes(c.rank))
  const playerSecond = pool.find(c => c !== playerFirst && ['10','J','Q','K'].includes(c.rank))
  // Min total 12 (7+5) ensures any ten-value draw busts the dealer.
  const dealerFirst  = pool.find(c => ![playerFirst, playerSecond].includes(c) && ['7','8'].includes(c.rank))
  const dealerSecond = pool.find(c => ![playerFirst, playerSecond, dealerFirst].includes(c) && ['5','6','7'].includes(c.rank))

  if (!playerFirst || !playerSecond || !dealerFirst || !dealerSecond) return pool

  const [dealerFaceUp, dealerHole] = Math.random() < 0.5
    ? [dealerFirst, dealerSecond]
    : [dealerSecond, dealerFirst]

  const reserved = new Set([playerFirst, playerSecond, dealerFaceUp, dealerHole])
  const remaining = shuffle(pool.filter(c => !reserved.has(c)))
  return [playerFirst, dealerFaceUp, playerSecond, dealerHole, ...remaining]
}

/** Start a blessed round: player gets a strong hand (17–BJ), dealer has a bust-prone hand. */
export function winGame(betAmount: number): BlackjackState {
  const deck = buildBlessedDeck()
  const [p1, d1, p2, d2, ...rest] = deck
  const playerHand = [p1!, p2!]
  const dealerHand = [d1!, d2!]
  const playerBlackjack = isBlackjack(playerHand)
  const initialState: BlackjackState = {
    deck: rest,
    playerHand,
    dealerHand,
    betAmount,
    stage: playerBlackjack ? 'settled' : 'inProgress',
    outcome: null,
    payoutMultiplier: 1,
    message: 'Your move.',
    canDouble: !playerBlackjack,
    playerBlackjack,
    dealerBlackjack: false,
  }
  if (playerBlackjack) return settle(initialState, 'win')
  return initialState
}

/** Blessed hit: always find a safe card; prefer one that lands exactly on 21 then auto-stands. */
export function winHit(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state
  const playerValue = calculateHandValue(state.playerHand)
  if (playerValue <= 11) return hitBlackjack(state)

  let deck = [...state.deck]
  const exactIdx = deck.findIndex(c => calculateHandValue([...state.playerHand, c]) === 21)
  const safeIdx  = exactIdx >= 0
    ? exactIdx
    : deck.findIndex(c => calculateHandValue([...state.playerHand, c]) <= 21)
  if (safeIdx > 0) {
    ;[deck[0], deck[safeIdx]] = [deck[safeIdx]!, deck[0]!]
  }

  const [next, ...rest] = deck
  if (!next) return hitBlackjack(state)

  const nextState: BlackjackState = {
    ...state,
    deck: rest,
    playerHand: [...state.playerHand, next],
    canDouble: false,
    message: 'You hit.',
  }

  if (isBust(nextState.playerHand)) return settle(nextState, 'loss')
  if (calculateHandValue(nextState.playerHand) === 21) return winStand(nextState)
  return nextState
}

/** Blessed stand: load tens to the front of the deck to push the dealer to bust, then evaluate honestly. */
export function winStand(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress') return state
  const tens = state.deck.filter(c => ['10','J','Q','K'].includes(c.rank))
  const rest  = state.deck.filter(c => !['10','J','Q','K'].includes(c.rank))
  const deck  = [...tens, ...shuffle(rest)]
  const { dealerHand, deck: finalDeck } = playDealer(deck, state.dealerHand)
  const nextState = { ...state, deck: finalDeck, dealerHand, message: 'Dealer plays.', canDouble: false }

  if (isBust(dealerHand)) return settle(nextState, 'win')

  const playerValue = calculateHandValue(state.playerHand)
  const dealerValue = calculateHandValue(dealerHand)
  if (playerValue > dealerValue) return settle(nextState, 'win')
  if (playerValue === dealerValue) return settle(nextState, 'push')
  return settle(nextState, 'loss')
}

/** Blessed double-down: blessed hit then blessed stand on doubled bet. */
export function winDouble(state: BlackjackState): BlackjackState {
  if (state.stage !== 'inProgress' || state.playerHand.length !== 2) return state
  const hit = winHit(state)
  if (hit.stage === 'settled') return { ...hit, betAmount: state.betAmount * 2 }
  return winStand({ ...hit, betAmount: state.betAmount * 2 })
}

export const blackjackEngine: GameEngine<BlackjackState, void> = {
  init: () => initBlackjack(),
  start: (betAmount) => startBlackjackRound(betAmount),
  resolve: (outcome, state) => settle(state, outcome),
  getPayoutMultiplier: (state) => state.payoutMultiplier,
}
