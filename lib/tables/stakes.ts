import type { Standings, TableGameName, TableTier } from './types'

/** Tables wallet: its own play money, refilled to the start amount when it can't cover the smallest buy-in. */
export const TABLES_START_WALLET = 10_000

export interface TierEntry {
  id: TableTier
  label: string
  buyIn: number
  /** The bots' skill at this tier. */
  botLabel: string
}

/** Stakes: the buy-in picks the bots' skill too (Rookie → Regular → Shark). */
export const TABLE_TIERS: TierEntry[] = [
  { id: 'rookie', label: 'Low stakes', buyIn: 100, botLabel: 'Rookie bots' },
  { id: 'regular', label: 'Mid stakes', buyIn: 500, botLabel: 'Regular bots' },
  { id: 'shark', label: 'High stakes', buyIn: 2_000, botLabel: 'Shark bots' },
]

export const TIER_BY_ID = new Map(TABLE_TIERS.map((t) => [t.id, t]))
export const MIN_BUY_IN = Math.min(...TABLE_TIERS.map((t) => t.buyIn))

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
