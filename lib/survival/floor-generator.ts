import { createRng, seedFromString } from '@/utils/rng'
import { getFloorMinBet } from '@/utils/math'
import { calcQuotaTarget, sparkFloorMult, FLOOR_MAX_APPEARANCES, FLOOR_OWNED_WEIGHT, FLOOR_REPEAT_WEIGHT, FLOOR_UNSEEN_WEIGHT } from './balance'
import { generateMissionsForFloor } from './missions'
import type { GenerateFloorInput, GeneratedFloor } from './types'
import type { GameName } from '@/store/types'

const GAMES_PER_FLOOR = 6

export function pickWeightedGame(
  candidates: GameName[],
  previousFloors: GameName[][],
  ownedGames: GameName[],
  rng: () => number,
): GameName | null {
  if (!candidates.length) return null
  const history = previousFloors.slice(-10)
  const seen = new Set(history.flat())
  const previous = new Set(history[history.length - 1] ?? [])
  const counts = new Map<GameName, number>()
  for (const game of history.flat()) counts.set(game, (counts.get(game) ?? 0) + 1)
  const owned = new Set(ownedGames)
  const weights = candidates.map((game) => {
    if ((counts.get(game) ?? 0) >= FLOOR_MAX_APPEARANCES) return 0
    return (seen.has(game) ? 1 : FLOOR_UNSEEN_WEIGHT)
      * (owned.has(game) ? FLOOR_OWNED_WEIGHT : 1)
      * (previous.has(game) ? FLOOR_REPEAT_WEIGHT : 1)
  })
  let total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) {
    weights.fill(1)
    total = weights.length
  }
  let roll = rng() * total
  const index = weights.findIndex((weight) => (roll -= weight) < 0)
  return candidates[index < 0 ? candidates.length - 1 : index]!
}

function weightedFloorGames(input: GenerateFloorInput): GameName[] {
  const { runSeed, floor, survivalGamePool } = input
  const remaining = [...survivalGamePool]
  const result: GameName[] = []
  const rng = createRng(seedFromString(`${runSeed}:floor:${floor}`))
  while (result.length < GAMES_PER_FLOOR && remaining.length) {
    const chosen = pickWeightedGame(remaining, input.previousFloors ?? [], input.ownedGames ?? [], rng)
    if (!chosen) break
    result.push(chosen)
    remaining.splice(remaining.indexOf(chosen), 1)
  }
  return result
}

/**
 * Pure, seeded floor generator. Given the same runSeed, floor, history and upgrades,
 * always produces the same result. No React or Zustand imports.
 */
export function generateFloor(input: GenerateFloorInput): GeneratedFloor {
  const { runSeed, floor, difficulty } = input
  const floorGames = weightedFloorGames(input)

  return {
    quotaTarget: calcQuotaTarget(floor, difficulty),
    floorGames,
    missions: generateMissionsForFloor(runSeed, floor, difficulty, floorGames, getFloorMinBet(floor)),
    rewardScaling: { sparkFloorMult: sparkFloorMult(floor) },
  }
}
