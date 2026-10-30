import type { HiLoCard } from '@/games/hilo/types'

export type BaccaratSpot = 'player' | 'banker' | 'tie' | 'player-pair' | 'banker-pair'
export type BaccaratBets = Partial<Record<BaccaratSpot, number>>
export interface BaccaratState {
  stage: 'betting' | 'settled'
  player: HiLoCard[]
  banker: HiLoCard[]
  playerTotal: number
  bankerTotal: number
  winner: 'player' | 'banker' | 'tie' | null
  deal: { hand: 'player' | 'banker'; card: HiLoCard }[]
  totalBetAmount: number
  totalPayout: number
  outcome: 'win' | 'loss' | 'push' | null
  message: string
}
