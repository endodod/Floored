import type { CupSwap, StreetCupsState } from './types'

function generateSwaps(count: number): CupSwap[] {
  const swaps: CupSwap[] = []
  for (let i = 0; i < count; i++) {
    const a = Math.floor(Math.random() * 3)
    let b = Math.floor(Math.random() * 2)
    if (b >= a) b++
    swaps.push({ a, b })
  }
  return swaps
}

export function initStreetCups(): StreetCupsState {
  return {
    betAmount: 0,
    stage: 'betting',
    revealSlot: null,
    shuffleSwaps: [],
    winningSlot: null,
    playerPick: null,
    outcome: null,
    message: 'Place your bet.',
  }
}

export function startStreetCups(betAmount: number): StreetCupsState {
  return {
    betAmount,
    stage: 'revealing',
    revealSlot: Math.floor(Math.random() * 3),
    shuffleSwaps: generateSwaps(12),
    winningSlot: null,
    playerPick: null,
    outcome: null,
    message: 'Watch carefully…',
  }
}

export function endShuffleStreetCups(state: StreetCupsState): StreetCupsState {
  return {
    ...state,
    stage: 'picking',
    winningSlot: Math.floor(Math.random() * 3),
    message: 'Pick a cup.',
  }
}

export function pickCupStreetCups(state: StreetCupsState, pickedSlot: number): StreetCupsState {
  const outcome = pickedSlot === state.winningSlot ? 'win' : 'loss'
  return {
    ...state,
    playerPick: pickedSlot,
    outcome,
    stage: 'settled',
    message: outcome === 'win' ? 'You found the crown!' : 'Wrong cup!',
  }
}

/** Win pays 2× the bet. */
export const STREET_CUPS_WIN_MULTIPLIER = 2.5

/** Blessed pick: the crown is always under the player's chosen cup. */
export function winGame(state: StreetCupsState, pickedSlot: number): StreetCupsState {
  return {
    ...state,
    playerPick: pickedSlot,
    winningSlot: pickedSlot,
    outcome: 'win',
    stage: 'settled',
    message: 'You found the crown!',
  }
}

/** Cursed pick: winning slot is always a different cup from the one the player chose. */
export function loseGame(state: StreetCupsState, pickedSlot: number): StreetCupsState {
  const others = [0, 1, 2].filter((s) => s !== pickedSlot)
  const winningSlot = others[Math.floor(Math.random() * others.length)] ?? (pickedSlot === 0 ? 1 : 0)
  return {
    ...state,
    playerPick: pickedSlot,
    winningSlot,
    outcome: 'loss',
    stage: 'settled',
    message: 'Wrong cup!',
  }
}

export function streetCupsEliminatedCup(winningSlot: number): number {
  const wrong = [0, 1, 2].filter((s) => s !== winningSlot)
  return wrong[Math.floor(Math.random() * wrong.length)]!
}
