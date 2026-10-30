import type { HiLoCard } from '@/games/hilo/types'

export type DeckCountdownStage = 'betting' | 'playing' | 'settled'
export interface DeckCountdownState {
  stage: DeckCountdownStage
  deck: HiLoCard[]
  flipped: HiLoCard[]
  bustCard: HiLoCard | null
  burnedCards: HiLoCard[]
  betAmount: number
  multiplier: number
  outcome: 'win' | 'loss' | null
  message: string
}
