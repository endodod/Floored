import type { GameName } from '@/store/types'
import { createRng, seedFromString } from '@/utils/rng'

/**
 * The jobs board: two hustles a night, each a condition met by playing that
 * night at the casino. Met hustles pay HUSTLE_PAY_M each when the night ends.
 * Seeded by city and night, so a reload shows the same board.
 */

/** One settled round at the casino tonight. */
export interface NightRound {
  game: GameName
  bet: number
  payout: number
}

export interface Hustle {
  id: string
  text: string
  met: (rounds: NightRound[]) => boolean
}

const wins = (rs: NightRound[]) => rs.filter((r) => r.payout > r.bet)

const POOL: Hustle[] = [
  { id: 'win-3', text: 'Win 3 rounds tonight', met: (rs) => wins(rs).length >= 3 },
  { id: 'two-games', text: 'Win at 2 different games tonight', met: (rs) => new Set(wins(rs).map((r) => r.game)).size >= 2 },
  { id: 'big-2.5', text: 'Win 2.5× or more on one bet', met: (rs) => rs.some((r) => r.bet > 0 && r.payout >= 2.5 * r.bet) },
  {
    id: 'streak-2',
    text: 'Win 2 rounds in a row',
    met: (rs) => rs.some((r, i) => i > 0 && r.payout > r.bet && rs[i - 1]!.payout > rs[i - 1]!.bet),
  },
  { id: 'three-games', text: 'Play 3 different games tonight', met: (rs) => new Set(rs.map((r) => r.game)).size >= 3 },
  { id: 'up', text: 'End the night up', met: (rs) => rs.length > 0 && rs.reduce((s, r) => s + r.payout - r.bet, 0) > 0 },
]

export const HUSTLE_BY_ID = new Map(POOL.map((h) => [h.id, h]))

/** Tonight's two hustles. */
export function hustlesFor(city: string, night: number, count = 2): Hustle[] {
  const rng = createRng(seedFromString(`hustles:${city}:${night}`))
  const pool = [...POOL]
  const out: Hustle[] = []
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!)
  return out
}
