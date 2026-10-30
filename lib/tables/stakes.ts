import type { CashStakeId, Standings, TableGameName, TableTier } from './types'

/** Tables wallet: its own play money, refilled to the start amount when it can't cover the smallest buy-in. */
export const TABLES_START_WALLET = 10_000

export interface TierEntry {
  id: TableTier
  label: string
  symbol: string
  buyIn: number
}

/** Buy-in tiers are independent of each bot's randomized skill. */
export const TABLE_TIERS: TierEntry[] = [
  { id: 'rookie', label: 'Low stakes', symbol: '🪙', buyIn: 100 },
  { id: 'regular', label: 'Mid stakes', symbol: '💰', buyIn: 1_000 },
  { id: 'shark', label: 'High stakes', symbol: '💎', buyIn: 10_000 },
]

export const TIER_BY_ID = new Map(TABLE_TIERS.map((t) => [t.id, t]))
export const MIN_BUY_IN = Math.min(...TABLE_TIERS.map((t) => t.buyIn))

export interface CashStake {
  id: CashStakeId
  label: string
  limits: { blinds?: [number, number]; ante?: number; bets?: [number, number | null] }
}

export const CASH_STAKES: Record<TableGameName, CashStake[]> = {
  holdem: [
    { id: 'low', label: 'Low stakes', limits: { blinds: [5, 10] } },
    { id: 'mid', label: 'Mid stakes', limits: { blinds: [50, 100] } },
    { id: 'high', label: 'High stakes', limits: { blinds: [500, 1000] } },
  ],
  'liars-dice': [
    { id: 'low', label: 'Low stakes', limits: { ante: 50 } },
    { id: 'mid', label: 'Mid stakes', limits: { ante: 500 } },
    { id: 'high', label: 'High stakes', limits: { ante: 5000 } },
  ],
  'blackjack-showdown': [
    { id: 'low', label: 'Low stakes', limits: { bets: [10, 500] } },
    { id: 'mid', label: 'Mid stakes', limits: { bets: [100, 5000] } },
    { id: 'high', label: 'High stakes', limits: { bets: [1000, null] } },
  ],
}

export function cashStakeFor(game: TableGameName, id: CashStakeId): CashStake {
  return CASH_STAKES[game].find((stake) => stake.id === id) ?? CASH_STAKES[game][0]!
}

export function limitsLabel(game: TableGameName, stake: CashStake): string {
  if (stake.limits.blinds) return `${stake.limits.blinds[0]} / ${stake.limits.blinds[1]}`
  if (stake.limits.ante) return `Ante ${stake.limits.ante}`
  const [min, max] = stake.limits.bets ?? [0, null]
  return max == null ? `Bets from ${min}` : `Bets ${min}–${max}`
}

export const BOT_SIT_RANGE = { holdem: [40, 200], 'liars-dice': [5, 25], 'blackjack-showdown': [20, 100] } as const
export const CHURN = { leaveWhenUp: 0.06, leaveWhenUpGame: 0.15, leaveAny: 0.01, leaveAnyGame: 0.03, topUp: 0.5, refillAfter: [1, 3] as [number, number] }

/** Share of the prize pool for 1st, 2nd, … (no rake: the pool is every buy-in). */
export function payoutSplits(seats: number, game?: TableGameName): number[] {
  if (game === 'blackjack-showdown' || game === 'liars-dice') return [1]
  return seats >= 6 ? [0.65, 0.35] : [0.7, 0.3]
}

export function prizePool(buyIn: number, seats: number): number {
  return buyIn * seats
}

/** Prize for each paid place, rounded down to whole chips. */
export function prizes(buyIn: number, seats: number, game?: TableGameName): number[] {
  const pool = prizePool(buyIn, seats)
  return payoutSplits(seats, game).map((s) => Math.floor(pool * s))
}

/**
 * What each seat wins. Seats tied for a place share the prizes of every place
 * the tie covers.
 */
export function payoutsFor(standings: Standings, buyIn: number, seats: number, game?: TableGameName): number[] {
  const table = prizes(buyIn, seats, game)
  const out = new Array<number>(seats).fill(0)
  let place = 0
  for (const group of standings) {
    const covered = table.slice(place, place + group.length).reduce((a, b) => a + b, 0)
    const share = Math.floor(covered / group.length)
    for (const seat of group) out[seat] = share
    place += group.length
  }
  return out
}

/** Place names: 1st, 2nd, 3rd, 4th… */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
