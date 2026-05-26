import { BET_LINE_SEP } from '@/lib/game-result-labels'
import type { BetMap, RouletteColor, RouletteBetType, RouletteState } from './types'

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export const STRAIGHT_UP_PAYOUT = 36

export function getNumberColor(n: number): RouletteColor {
  if (n === 0) return 'green'
  return RED_NUMBERS.has(n) ? 'red' : 'black'
}

export function isNumberCoveredByBet(n: number, bet: RouletteBetType): boolean {
  switch (bet) {
    case 'red':    return RED_NUMBERS.has(n)
    case 'black':  return n > 0 && !RED_NUMBERS.has(n)
    case 'green':  return n === 0
    case 'odd':    return n > 0 && n % 2 === 1
    case 'even':   return n > 0 && n % 2 === 0
    case 'low':    return n >= 1 && n <= 18
    case 'high':   return n >= 19 && n <= 36
    case 'dozen1': return n >= 1 && n <= 12
    case 'dozen2': return n >= 13 && n <= 24
    case 'dozen3': return n >= 25 && n <= 36
  }
}

// target is either a RouletteBetType string or a stringified number "0"–"36"
export function isNumberCoveredByTarget(n: number, target: string): boolean {
  const parsed = parseInt(target, 10)
  if (!isNaN(parsed)) return n === parsed
  return isNumberCoveredByBet(n, target as RouletteBetType)
}

export const BET_PAYOUTS: Record<RouletteBetType, number> = {
  red: 2,    black: 2,   green: 36,
  odd: 2,    even: 2,
  low: 2,    high: 2,
  dozen1: 3, dozen2: 3,  dozen3: 3,
}

export const BET_LABELS: Record<RouletteBetType, string> = {
  red: 'Red',   black: 'Black', green: 'Zero',
  odd: 'Odd',   even: 'Even',
  low: '1–18',  high: '19–36',
  dozen1: '1–12', dozen2: '13–24', dozen3: '25–36',
}

export function getPayoutForTarget(target: string): number {
  const parsed = parseInt(target, 10)
  if (!isNaN(parsed)) return STRAIGHT_UP_PAYOUT
  return BET_PAYOUTS[target as RouletteBetType] ?? 0
}

export function getLabelForTarget(target: string): string {
  const parsed = parseInt(target, 10)
  if (!isNaN(parsed)) return parsed === 0 ? 'Zero' : `No. ${parsed}`
  return BET_LABELS[target as RouletteBetType] ?? target
}

/** Bet spec after amount: `Red`, `Black 6`, `1–18`. */
export function getOutcomeLabelForTarget(target: string): string {
  const parsed = parseInt(target, 10)
  if (!isNaN(parsed)) {
    if (parsed === 0) return 'Zero'
    const color = getNumberColor(parsed)
    const colorName = color === 'red' ? 'Red' : 'Black'
    return `${colorName} ${parsed}`
  }
  return BET_LABELS[target as RouletteBetType] ?? target
}

/** Result column: `36 · Red`, `0 · Zero`. */
export function formatRouletteResultLabel(result: number, resultColor: RouletteColor): string {
  if (result === 0) return 'Zero'
  const colorName =
    resultColor === 'red' ? 'Red' : resultColor === 'black' ? 'Black' : 'Green'
  return `${result}${BET_LINE_SEP}${colorName}`
}

export function initRoulette(): RouletteState {
  return {
    stage: 'betting',
    result: null,
    resultColor: null,
    outcome: null,
    totalBetAmount: 0,
    totalPayout: 0,
    message: 'Place your bets and spin.',
  }
}

/** European single-zero wheel pockets, clockwise from 0 — authentic spin tick order. */
export const EUROPEAN_WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

/** One target, one stake per round (no split/stacked map in the UI). */
export function spinRoulette(target: string, amount: number): RouletteState {
  if (!target || amount <= 0) return spinRouletteMulti({})
  return spinRouletteMulti({ [target]: amount })
}

function settleRouletteSpin(bets: BetMap, result: number): RouletteState {
  const resultColor = getNumberColor(result)

  let totalBetAmount = 0
  let totalPayout = 0

  for (const [target, amount] of Object.entries(bets)) {
    if (amount <= 0) continue
    totalBetAmount += amount
    if (isNumberCoveredByTarget(result, target)) {
      totalPayout += amount * getPayoutForTarget(target)
    }
  }

  const net = totalPayout - totalBetAmount
  const resultLabel = result === 0 ? 'Zero' : `${result} ${resultColor}`
  const message = net > 0
    ? `${resultLabel} — Win!`
    : totalPayout > 0
      ? `${resultLabel} — Partial.`
      : `${resultLabel} — No win.`

  return {
    stage: 'settled',
    result,
    resultColor,
    outcome: net > 0 ? 'win' : net === 0 && totalBetAmount > 0 ? 'push' : 'loss',
    totalBetAmount,
    totalPayout,
    message,
  }
}

export function spinRouletteMulti(bets: BetMap): RouletteState {
  return settleRouletteSpin(bets, Math.floor(Math.random() * 37))
}

/** Same as spinRoulette but uses a pre-rolled pocket (survival Ball Tracker during betting). */
export function spinRouletteWithResult(target: string, amount: number, result: number): RouletteState {
  if (!target || amount <= 0) return settleRouletteSpin({}, result)
  return settleRouletteSpin({ [target]: amount }, result)
}

/** Blessed spin: always lands on a pocket covered by the player's bet. */
export function winGame(target: string, amount: number): RouletteState {
  const winners: number[] = []
  for (let n = 0; n <= 36; n++) {
    if (isNumberCoveredByTarget(n, target)) winners.push(n)
  }
  const result = winners[Math.floor(Math.random() * winners.length)] ?? 1
  return settleRouletteSpin({ [target]: amount }, result)
}

/** Cursed spin: always lands on a pocket not covered by the player's bet. */
export function loseGame(target: string, amount: number): RouletteState {
  const losers: number[] = []
  for (let n = 0; n <= 36; n++) {
    if (!isNumberCoveredByTarget(n, target)) losers.push(n)
  }
  const result = losers[Math.floor(Math.random() * losers.length)] ?? 1
  return settleRouletteSpin({ [target]: amount }, result)
}

export function rouletteEliminatedNumbers(winningNumber: number, count = 3): number[] {
  const pool: number[] = []
  for (let n = 0; n <= 36; n++) {
    if (n !== winningNumber) pool.push(n)
  }
  const out: number[] = []
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0]!)
  }
  return out
}
