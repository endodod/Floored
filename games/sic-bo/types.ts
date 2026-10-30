export type SicBoTarget = 'small' | 'big' | 'any-triple' | `total-${4|5|6|7|8|9|10|11|12|13|14|15|16|17}` | `double-${1|2|3|4|5|6}` | `single-${1|2|3|4|5|6}`
export type SicBoBets = Partial<Record<SicBoTarget, number>>
export type SicBoRoll = [number, number, number]
export interface SicBoState {
  stage: 'betting' | 'settled'
  dice: SicBoRoll | null
  totalBetAmount: number
  totalPayout: number
  outcome: 'win' | 'loss' | 'push' | null
  message: string
}
