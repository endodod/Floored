import type { HiLoCard } from '@/games/hilo/types'

export type AndarBaharSide = 'andar' | 'bahar'
export interface AndarBaharState {
  stage: 'betting' | 'dealing' | 'settled'
  joker: HiLoCard | null
  andar: HiLoCard[]
  bahar: HiLoCard[]
  matchCard: HiLoCard | null
  winner: AndarBaharSide | null
  betSide: AndarBaharSide | null
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | null
  message: string
  deal: { side: AndarBaharSide; card: HiLoCard }[]
}
