import { createRng, seedFromString } from '@/utils/rng'
import type { Difficulty, FloorMission, GameName } from '@/store/types'

export type MissionType =
  | 'win_streak'
  | 'play_game'
  | 'min_multiplier'
  | 'games_played'
  | 'flawless'
  | 'win_count'
  | 'big_win'

export const HIGH_VARIANCE_GAME_IDS: GameName[] = [
  'crash',
  'mines',
  'chicken-road',
  'dragon-tower',
  'chicken-race',
  'keno',
  'street-cups',
  'deck-countdown',
  'tower-of-cards',
]

export const LOW_VARIANCE_GAME_IDS: GameName[] = [
  'baccarat',
  'blackjack',
  'roulette',
  'plinko',
  'over-under',
  'run-dice',
  'wheel',
  'slots',
  'hilo',
  'coin-flip',
  'poker-1p',
  'case-battles',
]

export const MISSION_DEFINITIONS: Array<{
  type: MissionType
  target: number
  minBetMult: number
  baseReward: number
}> = [
  // win_streak
  { type: 'win_streak', target: 2, minBetMult: 1, baseReward: 4 },
  { type: 'win_streak', target: 2, minBetMult: 2, baseReward: 5 },
  { type: 'win_streak', target: 2, minBetMult: 5, baseReward: 8 },
  { type: 'win_streak', target: 3, minBetMult: 1, baseReward: 6 },
  { type: 'win_streak', target: 3, minBetMult: 2, baseReward: 7 },
  { type: 'win_streak', target: 3, minBetMult: 5, baseReward: 10 },
  { type: 'win_streak', target: 4, minBetMult: 1, baseReward: 8 },
  { type: 'win_streak', target: 4, minBetMult: 2, baseReward: 9 },
  { type: 'win_streak', target: 5, minBetMult: 1, baseReward: 10 },
  { type: 'win_streak', target: 5, minBetMult: 2, baseReward: 11 },
  // play_game
  { type: 'play_game', target: 1, minBetMult: 1, baseReward: 3 },
  { type: 'play_game', target: 1, minBetMult: 2, baseReward: 4 },
  { type: 'play_game', target: 1, minBetMult: 5, baseReward: 7 },
  { type: 'play_game', target: 1, minBetMult: 10, baseReward: 10 },
  { type: 'play_game', target: 2, minBetMult: 1, baseReward: 4 },
  { type: 'play_game', target: 2, minBetMult: 2, baseReward: 5 },
  { type: 'play_game', target: 2, minBetMult: 5, baseReward: 8 },
  { type: 'play_game', target: 3, minBetMult: 1, baseReward: 5 },
  { type: 'play_game', target: 3, minBetMult: 2, baseReward: 6 },
  { type: 'play_game', target: 3, minBetMult: 5, baseReward: 9 },
  { type: 'play_game', target: 4, minBetMult: 1, baseReward: 6 },
  { type: 'play_game', target: 4, minBetMult: 2, baseReward: 7 },
  { type: 'play_game', target: 4, minBetMult: 3, baseReward: 8 },
  { type: 'play_game', target: 6, minBetMult: 1, baseReward: 8 },
  { type: 'play_game', target: 6, minBetMult: 2, baseReward: 9 },
  // min_multiplier
  { type: 'min_multiplier', target: 2, minBetMult: 1, baseReward: 5 },
  { type: 'min_multiplier', target: 2, minBetMult: 2, baseReward: 6 },
  { type: 'min_multiplier', target: 2, minBetMult: 5, baseReward: 9 },
  { type: 'min_multiplier', target: 3, minBetMult: 1, baseReward: 8 },
  { type: 'min_multiplier', target: 3, minBetMult: 2, baseReward: 9 },
  { type: 'min_multiplier', target: 3, minBetMult: 5, baseReward: 12 },
  // games_played
  { type: 'games_played', target: 3, minBetMult: 1, baseReward: 3 },
  { type: 'games_played', target: 3, minBetMult: 2, baseReward: 4 },
  { type: 'games_played', target: 5, minBetMult: 1, baseReward: 5 },
  { type: 'games_played', target: 5, minBetMult: 2, baseReward: 6 },
  { type: 'games_played', target: 5, minBetMult: 5, baseReward: 9 },
  { type: 'games_played', target: 8, minBetMult: 1, baseReward: 7 },
  { type: 'games_played', target: 8, minBetMult: 2, baseReward: 8 },
  // flawless
  { type: 'flawless', target: 1, minBetMult: 1, baseReward: 8 },
  { type: 'flawless', target: 1, minBetMult: 2, baseReward: 9 },
  { type: 'flawless', target: 1, minBetMult: 3, baseReward: 10 },
  // win_count
  { type: 'win_count', target: 2, minBetMult: 1, baseReward: 4 },
  { type: 'win_count', target: 2, minBetMult: 2, baseReward: 5 },
  { type: 'win_count', target: 2, minBetMult: 5, baseReward: 8 },
  { type: 'win_count', target: 4, minBetMult: 1, baseReward: 6 },
  { type: 'win_count', target: 4, minBetMult: 2, baseReward: 7 },
  { type: 'win_count', target: 4, minBetMult: 5, baseReward: 10 },
  // big_win (10× net profit only)
  { type: 'big_win', target: 10, minBetMult: 1, baseReward: 5 },
  { type: 'big_win', target: 10, minBetMult: 2, baseReward: 6 },
  { type: 'big_win', target: 10, minBetMult: 3, baseReward: 7 },
]

const MISSION_POOL: Array<{
  type: MissionType
  target: number
  minBetMult: number
  baseReward: number
}> = [...MISSION_DEFINITIONS]

function rewardForFloor(base: number, floor: number, difficulty: Difficulty): number {
  const mult = difficulty === 'nightmare' ? 1.4 : difficulty === 'hard' ? 1.2 : 1
  return Math.max(1, Math.floor(base * (1 + (floor - 1) * 0.1) * mult))
}

const EXCLUSIVE_TYPES: MissionType[] = [
  'win_streak',
  'play_game',
  'min_multiplier',
  'games_played',
  'flawless',
  'win_count',
  'big_win',
]

function missionPoolForFloor(floorGames: GameName[]): typeof MISSION_POOL {
  const lowVarianceCount = floorGames.filter((g) => LOW_VARIANCE_GAME_IDS.includes(g)).length
  const flawlessAllowed = lowVarianceCount >= 3
  if (flawlessAllowed) return MISSION_POOL
  return MISSION_POOL.filter((p) => p.type !== 'flawless')
}

function removePickedFromPool(
  pool: typeof MISSION_POOL,
  picked: (typeof MISSION_POOL)[number],
): typeof MISSION_POOL {
  if ((EXCLUSIVE_TYPES as string[]).includes(picked.type)) {
    return pool.filter((p) => p.type !== picked.type)
  }
  return pool.filter(
    (p) =>
      p.type !== picked.type ||
      p.target !== picked.target ||
      p.minBetMult !== picked.minBetMult,
  )
}

/** Seeded mission count per floor. */
export const MISSIONS_PER_FLOOR = 3

export function generateMissionsForFloor(
  runSeed: string,
  floor: number,
  difficulty: Difficulty,
  floorGames: GameName[],
  floorMinBet: number,
  rerollCount = 0,
  excludeAtIndex?: { index: number; type: MissionType; target: number },
): FloorMission[] {
  const rng = createRng(seedFromString(`${runSeed}:missions:${floor}:${rerollCount}`))
  const count = MISSIONS_PER_FLOOR
  let pool = [...missionPoolForFloor(floorGames)]
  const picked: FloorMission[] = []

  for (let i = 0; i < count && pool.length > 0; i++) {
    let slotPool = pool
    if (excludeAtIndex && i === excludeAtIndex.index) {
      const filtered = pool.filter(
        (p) => !(p.type === excludeAtIndex.type && p.target === excludeAtIndex.target),
      )
      if (filtered.length > 0) slotPool = filtered
    }
    const idx = Math.floor(rng() * slotPool.length)
    const def = slotPool[idx]!
    pool = removePickedFromPool(pool, def)
    const game =
      def.type === 'play_game'
        ? floorGames[Math.floor(rng() * floorGames.length)]
        : undefined
    const target = def.type === 'big_win' ? def.target * floorMinBet : def.target
    const minBet = floorMinBet * def.minBetMult
    picked.push({
      id: `${floor}-${def.type}-${target}-${def.minBetMult}-${i}-${game ?? 'any'}`,
      type: def.type,
      target,
      progress: 0,
      rewardSparks: rewardForFloor(def.baseReward, floor, difficulty),
      completed: false,
      minBet,
      ...(game ? { game } : {}),
    })
  }

  return picked
}

export function missionOfferKey(m: Pick<FloorMission, 'type' | 'target' | 'game'>): string {
  return `${m.type}:${m.target}:${m.game ?? ''}`
}

export function missionOfferedKeysFromMissions(missions: FloorMission[]): string[] {
  return [...new Set(missions.map(missionOfferKey))]
}

function resolvedTarget(
  def: (typeof MISSION_POOL)[number],
  floorMinBet: number,
): number {
  return def.type === 'big_win' ? def.target * floorMinBet : def.target
}

function isMissionDefAlreadyOffered(
  def: (typeof MISSION_POOL)[number],
  offeredKeys: Set<string>,
  floorMinBet: number,
): boolean {
  if ((EXCLUSIVE_TYPES as string[]).includes(def.type)) {
    return [...offeredKeys].some((k) => k.startsWith(`${def.type}:`))
  }
  const target = resolvedTarget(def, floorMinBet)
  return offeredKeys.has(`${def.type}:${target}:`)
}

function buildMissionFromDef(
  def: (typeof MISSION_POOL)[number],
  floor: number,
  slotIndex: number,
  difficulty: Difficulty,
  floorGames: GameName[],
  floorMinBet: number,
  game: GameName | undefined,
): FloorMission {
  const target = resolvedTarget(def, floorMinBet)
  const minBet = floorMinBet * def.minBetMult
  return {
    id: `${floor}-${def.type}-${target}-${def.minBetMult}-${slotIndex}-${game ?? 'any'}`,
    type: def.type,
    target,
    progress: 0,
    rewardSparks: rewardForFloor(def.baseReward, floor, difficulty),
    completed: false,
    minBet,
    ...(game ? { game } : {}),
  }
}

/** Pick a replacement mission for one slot (not in offeredKeys). */
export function pickMissionRerollForSlot(input: {
  runSeed: string
  floor: number
  slotIndex: number
  rollSeq: number
  difficulty: Difficulty
  floorGames: GameName[]
  floorMinBet: number
  offeredKeys: string[]
}): FloorMission | null {
  const offered = new Set(input.offeredKeys)
  const candidates = missionPoolForFloor(input.floorGames).filter(
    (def) => !isMissionDefAlreadyOffered(def, offered, input.floorMinBet),
  )
  if (candidates.length === 0) return null

  const rng = createRng(
    seedFromString(
      `${input.runSeed}:mission-ticket:${input.floor}:${input.slotIndex}:${input.rollSeq}`,
    ),
  )
  const def = candidates[Math.floor(rng() * candidates.length)]!
  const game =
    def.type === 'play_game'
      ? input.floorGames[Math.floor(rng() * input.floorGames.length)]
      : undefined
  return buildMissionFromDef(
    def,
    input.floor,
    input.slotIndex,
    input.difficulty,
    input.floorGames,
    input.floorMinBet,
    game,
  )
}
