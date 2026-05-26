import type { MineTile, MinesState } from './types'

const DIFFICULTY_MINES: Record<MinesState['difficulty'], number> = {
  easy: 3,
  medium: 7,
  hard: 13,
  insane: 20,
}

function randomTiles(count: number, total: number) {
  const indices = new Set<number>()
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * total))
  }
  return indices
}

function buildTiles(mines: number) {
  const mineIndices = randomTiles(mines, 25)
  return Array.from({ length: 25 }, (_, index) => ({
    id: index,
    hasMine: mineIndices.has(index),
    revealed: false,
  }))
}

export function initMines() {
  return {
    stage: 'betting' as const,
    difficulty: 'easy' as const,
    betAmount: 0,
    tiles: [] as MineTile[],
    remainingSafe: 22,
    multiplier: 1,
    outcome: null as null,
    message: 'Choose difficulty and place your bet.',
  }
}

export function startMinesRound(amount: number, difficulty: MinesState['difficulty']): MinesState {
  const totalMines = DIFFICULTY_MINES[difficulty]
  const safeCount = 25 - totalMines
  return {
    stage: 'inProgress',
    difficulty,
    betAmount: amount,
    tiles: buildTiles(totalMines),
    remainingSafe: safeCount,
    multiplier: 1,
    outcome: null,
    message: `Find safe tiles. ${safeCount} safe squares remain.`,
  }
}

export function revealSafeMineTile(state: MinesState, tileId: number): MinesState {
  const tile = state.tiles.find((t) => t.id === tileId)
  if (!tile || tile.revealed || tile.hasMine) return state
  return {
    ...state,
    tiles: state.tiles.map((t) => (t.id === tileId ? { ...t, revealed: true } : t)),
    message: state.message,
  }
}

export function revealMineTile(state: MinesState, tileId: number): MinesState {
  if (state.stage !== 'inProgress') return state
  const tile = state.tiles.find((tile) => tile.id === tileId)
  if (!tile || tile.revealed) return state

  const nextTiles = state.tiles.map((t) =>
    t.id === tileId ? { ...t, revealed: true } : t
  )

  if (tile.hasMine) {
    return {
      ...state,
      stage: 'settled',
      tiles: nextTiles,
      multiplier: 0,
      outcome: 'loss',
      message: 'Boom! You hit a mine.',
    }
  }

  const nextRemainingSafe = state.remainingSafe - 1
  const totalUnrevealed = state.remainingSafe + DIFFICULTY_MINES[state.difficulty]
  const nextMultiplier = Number(
    (state.multiplier * (totalUnrevealed / state.remainingSafe)).toFixed(2)
  )

  if (nextRemainingSafe === 0) {
    return {
      ...state,
      stage: 'settled',
      tiles: nextTiles,
      remainingSafe: 0,
      multiplier: nextMultiplier,
      outcome: 'win',
      message: `All safe tiles found! Cashed out at ${nextMultiplier.toFixed(2)}×.`,
    }
  }

  return {
    ...state,
    tiles: nextTiles,
    remainingSafe: nextRemainingSafe,
    multiplier: nextMultiplier,
    message: `${nextRemainingSafe} safe squares left.`,
  }
}

export function cashOutMines(state: MinesState): MinesState {
  if (state.stage !== 'inProgress') return state
  return {
    ...state,
    stage: 'settled',
    outcome: 'win',
    message: `Cashed out at ${state.multiplier.toFixed(2)}×.`,
  }
}

export function getMinesPayout(state: MinesState) {
  return state.outcome === 'win' ? Math.round(state.betAmount * state.multiplier) : 0
}

/** Randomly place exactly difficulty-many mines among the unrevealed tiles. */
function redistributeMines(tiles: MineTile[], difficulty: MinesState['difficulty']): MineTile[] {
  const mineCount = DIFFICULTY_MINES[difficulty]
  const unrevealed = tiles.filter((t) => !t.revealed)
  const shuffled = [...unrevealed].sort(() => Math.random() - 0.5)
  const mineIds = new Set(shuffled.slice(0, Math.min(mineCount, unrevealed.length)).map((t) => t.id))
  return tiles.map((t) => (t.revealed ? t : { ...t, hasMine: mineIds.has(t.id) }))
}

/**
 * Blessed reveal: clears all mines from unrevealed tiles on every call so no
 * future click can ever lose. Auto-cashes out when the last safe slot is used.
 */
export function winGame(state: MinesState, tileId: number): MinesState {
  if (state.stage !== 'inProgress') return state
  const tile = state.tiles.find((t) => t.id === tileId)
  if (!tile || tile.revealed) return state

  // Only force this specific tile safe — other tiles keep their mine state
  // so unrevealed mines are shown correctly at settlement
  const nextTiles = state.tiles.map((t) =>
    t.id === tileId ? { ...t, hasMine: false, revealed: true } : t
  )

  const nextRemainingSafe = state.remainingSafe - 1
  const totalUnrevealed = state.remainingSafe + DIFFICULTY_MINES[state.difficulty]
  const nextMultiplier = Number(
    (state.multiplier * (totalUnrevealed / state.remainingSafe)).toFixed(2)
  )

  if (nextRemainingSafe === 0) {
    return {
      ...state,
      stage: 'settled',
      tiles: redistributeMines(nextTiles, state.difficulty),
      remainingSafe: 0,
      multiplier: nextMultiplier,
      outcome: 'win',
      message: `All safe tiles found! Cashed out at ${nextMultiplier.toFixed(2)}×.`,
    }
  }

  return {
    ...state,
    tiles: nextTiles,
    remainingSafe: nextRemainingSafe,
    multiplier: nextMultiplier,
    message: `${nextRemainingSafe} safe squares left.`,
  }
}

/** Blessed manual cash-out: redistributes exactly difficulty-many mines among unrevealed tiles. */
export function blessedCashOutMines(state: MinesState): MinesState {
  if (state.stage !== 'inProgress') return state
  return {
    ...state,
    stage: 'settled',
    tiles: redistributeMines(state.tiles, state.difficulty),
    outcome: 'win',
    message: `Cashed out at ${state.multiplier.toFixed(2)}×.`,
  }
}

/** Cursed reveal: the clicked tile is always a mine, regardless of placement. */
export function loseGame(state: MinesState, tileId: number): MinesState {
  if (state.stage !== 'inProgress') return state
  const tile = state.tiles.find((t) => t.id === tileId)
  if (!tile || tile.revealed) return state
  return {
    ...state,
    stage: 'settled',
    tiles: state.tiles.map((t) =>
      t.id === tileId ? { ...t, hasMine: true, revealed: true } : t,
    ),
    multiplier: 0,
    outcome: 'loss',
    message: 'Boom! You hit a mine.',
  }
}

export function findFirstSafeMineTile(tiles: { id: number; hasMine: boolean; revealed: boolean }[]): number | null {
  const safe = tiles.find((t) => !t.hasMine && !t.revealed)
  return safe?.id ?? null
}
