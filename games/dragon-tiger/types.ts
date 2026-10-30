import type { HiLoCard } from '@/games/hilo/types'

export type DragonTigerBet = 'dragon' | 'tiger' | 'tie'
export type DragonTigerBets = Partial<Record<DragonTigerBet, number>>
export interface DragonTigerState {
  stage: 'betting' | 'dealing' | 'settled'
  dragon: HiLoCard | null
  tiger: HiLoCard | null
  winner: DragonTigerBet | null
  bet: DragonTigerBet | null
  bets: DragonTigerBets
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | null
  message: string
}
