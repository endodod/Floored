import type { GameName, Difficulty, FloorMission } from '@/store/types'

/** Input to the floor generator — pure data, no store or React dependency. */
export interface GenerateFloorInput {
  runSeed: string
  floor: number
  difficulty: Difficulty
  survivalGamePool: GameName[]
  previousFloors?: GameName[][]
  ownedGames?: GameName[]
}

/** Output of the floor generator. */
export interface GeneratedFloor {
  quotaTarget: number
  floorGames: GameName[]
  missions: FloorMission[]
  rewardScaling: { sparkFloorMult: number }
}
