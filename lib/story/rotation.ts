import type { City } from '@/lib/story/cities'
import { GAMES_PER_ROOM } from '@/lib/story/economy'
import type { GameName } from '@/store/types'
import { createRng, seedFromString } from '@/utils/rng'

/**
 * Which games each room offers tonight. Every room (venue 0 dive, 1 main floor,
 * 2 high-roller) draws its own GAMES_PER_ROOM from the city's list. Night 0 is a
 * seeded spread (the rooms start with different lineups); each later night the
 * room swaps one or two games for ones it doesn't have, so a room always keeps
 * at least one game from the night before. Seeded by city, night and room, so a
 * reload never rerolls; the story's own seed (`StorySave.seed`, drawn on a new story) is
 * mixed in, so every story deals its own lineups. A city with GAMES_PER_ROOM games or
 * fewer offers them all.
 */
const cache = new Map<string, GameName[]>()

/** A seed string for this story: the story's seed in front, none for older saves. */
export const storySeed = (seed: string, key: string) => (seed ? `${seed}:${key}` : key)

function lineup(cityId: string, list: GameName[], night: number, venue: number, seed: string): GameName[] {
  const key = `${seed}|${cityId}:${list.join(',')}:${venue}:${night}`
  const hit = cache.get(key)
  if (hit) return hit
  let out: GameName[]
  if (night <= 0) {
    // Same shuffle for every room, then a different slice of it per room.
    const rng = createRng(seedFromString(storySeed(seed, `rooms:${cityId}`)))
    const order = [...list]
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j]!, order[i]!]
    }
    const start = Math.round((venue * order.length) / 3)
    out = Array.from({ length: GAMES_PER_ROOM }, (_, i) => order[(start + i) % order.length]!)
  } else {
    const prev = lineup(cityId, list, night - 1, venue, seed)
    const rng = createRng(seedFromString(storySeed(seed, `rooms:${cityId}:${night}:${venue}`)))
    const fresh = list.filter((g) => !prev.includes(g))
    const swaps = Math.min(rng() < 0.6 ? 1 : 2, fresh.length, GAMES_PER_ROOM - 1)
    out = [...prev]
    for (let k = 0; k < swaps; k++) {
      const at = Math.floor(rng() * out.length)
      out[at] = fresh.splice(Math.floor(rng() * fresh.length), 1)[0]!
    }
  }
  cache.set(key, out)
  return out
}

/**
 * Tonight's games in one room. `seen` is the games met so far (for the Summit's
 * 'all-seen' list); `seed` is the story's seed (empty for saves from before it).
 */
export function gamesFor(city: City, night: number, venue: number, seen: GameName[] = [], seed = ''): GameName[] {
  const list = city.games === 'all-seen' ? seen : city.games
  if (list.length <= GAMES_PER_ROOM) return [...list]
  return lineup(city.id, list, night, venue, seed)
}
