import type { GameName } from '@/store/types'
import { PICKS_PER_RUNG } from '@/lib/ladder/rules'

/** A game that hasn't been offered on an earlier rung is this much likelier to turn up next. */
export const UNSEEN_GAME_WEIGHT = 4

/**
 * Draws one rung's picker: `count` distinct games from the ones still available this run.
 * Games that have not appeared in an earlier picker carry `UNSEEN_GAME_WEIGHT`; games already
 * offered on a rung you didn't play are still possible, just less likely.
 */
export function pickRungOffers(
  available: readonly GameName[],
  seen: ReadonlySet<GameName>,
  count: number = PICKS_PER_RUNG,
): GameName[] {
  const pool = available.map((name) => ({ name, weight: seen.has(name) ? 1 : UNSEEN_GAME_WEIGHT }))
  const picks: GameName[] = []
  const target = Math.min(count, pool.length)

  while (picks.length < target) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
    let roll = Math.random() * total
    let index = pool.findIndex((entry) => (roll -= entry.weight) < 0)
    if (index === -1) index = pool.length - 1
    const [picked] = pool.splice(index, 1)
    if (!picked) break
    picks.push(picked.name)
  }

  return picks
}
