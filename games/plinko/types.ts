export type PlinkoRisk = 'low' | 'medium' | 'high'

export type PlinkoOutcome = 'win' | 'loss' | 'push'

export interface PlinkoPath {
  /** One entry per row: true = ball goes right, false = left. */
  decisions: boolean[]
  /** Final slot index — equals the count of right decisions (0 = far left, ROWS = far right). */
  slotIndex: number
}

export interface PlinkoPayoutResult {
  multiplier: number
  payout: number
  outcome: PlinkoOutcome
}
