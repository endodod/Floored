export interface Bid { count: number; face: 1 | 2 | 3 | 4 | 5 | 6; seat: number }
export interface State { dice: number[][]; active: boolean[]; bid: Bid | null; history: Bid[]; seat: number; reveal: boolean; winner: number | null }
export type Action = { type: 'bid'; count: number; face: Bid['face'] } | { type: 'liar' }
export interface View extends Omit<State, 'dice'> { ownDice: number[]; diceCounts: number[] }
