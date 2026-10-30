import type { HiLoCard } from '@/games/hilo/types'

export type TowerStage = 'betting' | 'playing' | 'riding' | 'settled'
export type TowerCall =
  | { step: 1; pick: 'red' | 'black' }
  | { step: 2; pick: 'higher' | 'lower' }
  | { step: 3; pick: 'inside' | 'outside' }
  | { step: 4; pick: '♠' | '♥' | '♦' | '♣' }
export interface TowerState {
  stage: TowerStage
  deck: HiLoCard[]
  cards: HiLoCard[]
  stepMultipliers: number[]
  step: 1 | 2 | 3 | 4
  betAmount: number
  multiplier: number
  outcome: 'win' | 'loss' | 'push' | null
  lastCall: TowerCall | null
  message: string
}
export type TowerOption = { pick: TowerCall['pick']; mult: number | null }
