import type { KenoState } from './types'

export const BOARD_SIZE = 25
export const DRAW_COUNT = 5
export const MIN_PICKS = 1
export const MAX_PICKS = 5

/** Payout multiplier by total hits (1–5). */
/** Payout multiplier by total hits (0–5). */
export const HIT_MULTIPLIERS: Record<number, number> = {
  0: 0,
  1: 0.5,
  2: 2,
  3: 5,
  4: 15,
  5: 100,
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}

function drawNumbers(): number[] {
  const pool = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1)
  return shuffle(pool).slice(0, DRAW_COUNT)
}

export function getKenoMultiplier(hits: number): number {
  return HIT_MULTIPLIERS[hits] ?? 0
}

export function computeKenoStats(picks: number[], revealedDrawn: number[]) {
  const hits = picks.filter((p) => revealedDrawn.includes(p)).length
  const multiplier = getKenoMultiplier(hits)
  return { hits, multiplier }
}

export function initKeno(): KenoState {
  return {
    stage: 'betting',
    betAmount: 0,
    picks: [],
    drawn: [],
    revealedDrawn: [],
    hits: 0,
    multiplier: 0,
    outcome: null,
    message: 'Pick 1–5 numbers, then place your bet.',
  }
}

export function toggleKenoPick(state: KenoState, num: number): KenoState {
  if (state.stage !== 'betting') return state
  if (num < 1 || num > BOARD_SIZE) return state

  const has = state.picks.includes(num)
  if (has) {
    const picks = state.picks.filter((n) => n !== num)
    return {
      ...state,
      picks,
      message: picks.length
        ? `${picks.length} number${picks.length === 1 ? '' : 's'} selected.`
        : 'Pick 1–5 numbers, then place your bet.',
    }
  }

  if (state.picks.length >= MAX_PICKS) return state
  const picks = [...state.picks, num].sort((a, b) => a - b)
  return {
    ...state,
    picks,
    message: `${picks.length} number${picks.length === 1 ? '' : 's'} selected.`,
  }
}

export function clearKenoPicks(state: KenoState): KenoState {
  if (state.stage !== 'betting') return state
  return {
    ...state,
    picks: [],
    message: 'Pick 1–5 numbers, then place your bet.',
  }
}

export function quickPickKeno(state: KenoState, count = 5): KenoState {
  if (state.stage !== 'betting') return state
  const n = Math.max(MIN_PICKS, Math.min(MAX_PICKS, count))
  const pool = shuffle(Array.from({ length: BOARD_SIZE }, (_, i) => i + 1))
  const picks = pool.slice(0, n).sort((a, b) => a - b)
  return {
    ...state,
    picks,
    message: `${picks.length} numbers quick-picked.`,
  }
}

export function startKenoRound(amount: number, picks: number[]): KenoState {
  const drawn = drawNumbers()
  return {
    stage: 'drawing',
    betAmount: amount,
    picks,
    drawn,
    revealedDrawn: [],
    hits: 0,
    multiplier: 0,
    outcome: null,
    message: 'Drawing numbers…',
  }
}

function applyRevealStats(state: KenoState, revealedDrawn: number[]): KenoState {
  const { hits, multiplier } = computeKenoStats(state.picks, revealedDrawn)
  return { ...state, revealedDrawn, hits, multiplier }
}

function settleDrawing(state: KenoState): KenoState {
  const settled = applyRevealStats(state, state.drawn)
  const payout = getKenoPayout(settled)
  const outcome: KenoState['outcome'] = payout > settled.betAmount ? 'win' : 'loss'
  const multLabel = settled.multiplier.toFixed(settled.multiplier >= 10 ? 0 : 1)
  return {
    ...settled,
    stage: 'settled',
    outcome,
    message:
      payout > 0
        ? `${settled.hits} hit${settled.hits === 1 ? '' : 's'} · ${multLabel}×`
        : `${settled.hits} hit${settled.hits === 1 ? '' : 's'} — no payout.`,
  }
}

export function revealNextKenoDraw(state: KenoState): KenoState {
  if (state.stage !== 'drawing') return state
  const nextIndex = state.revealedDrawn.length
  if (nextIndex >= state.drawn.length) return settleDrawing(state)

  const revealedDrawn = [...state.revealedDrawn, state.drawn[nextIndex]!]
  const next = applyRevealStats(
    { ...state, message: `Ball ${revealedDrawn.length} of ${DRAW_COUNT}` },
    revealedDrawn,
  )
  if (revealedDrawn.length >= state.drawn.length) return settleDrawing(next)
  return next
}

export function revealAllKenoDraws(state: KenoState): KenoState {
  if (state.stage !== 'drawing') return state
  return settleDrawing({ ...state, revealedDrawn: state.drawn })
}

/** Blessed draw: all player picks are drawn — maximum hits guaranteed. */
export function winGame(amount: number, picks: number[]): KenoState {
  const nonPicks = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).filter(
    (n) => !picks.includes(n),
  )
  const extra = shuffle(nonPicks).slice(0, DRAW_COUNT - picks.length)
  const drawn = shuffle([...picks, ...extra])
  return {
    stage: 'drawing',
    betAmount: amount,
    picks,
    drawn,
    revealedDrawn: [],
    hits: 0,
    multiplier: 0,
    outcome: null,
    message: 'Drawing numbers…',
  }
}

/** Cursed draw: all 5 balls land outside the player's picks — guaranteed 0 hits. */
export function loseGame(amount: number, picks: number[]): KenoState {
  const pickSet = new Set(picks)
  const pool = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).filter((n) => !pickSet.has(n))
  const drawn = shuffle(pool).slice(0, DRAW_COUNT)
  return {
    stage: 'drawing',
    betAmount: amount,
    picks,
    drawn,
    revealedDrawn: [],
    hits: 0,
    multiplier: 0,
    outcome: null,
    message: 'Drawing numbers…',
  }
}

export function getKenoPayout(state: KenoState) {
  if (state.revealedDrawn.length === 0) return 0
  return Math.round(state.betAmount * state.multiplier)
}

export function kenoHeatNumbers(draw: number[], count = 2): number[] {
  return draw.slice(0, count)
}
