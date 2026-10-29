export type Suit = '♠'|'♥'|'♦'|'♣'
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'
export interface Card { suit: Suit; rank: Rank }
export type Street = 'preflop'|'flop'|'turn'|'river'|'showdown'|'finished'
export interface Player { name: string; stack: number; hole: Card[]; folded: boolean; allIn: boolean; bet: number; committed: number; lastAction: string }
export interface State { players: Player[]; deck: Card[]; board: Card[]; button: number; currentSeat: number|null; street: Street; handNumber: number; smallBlind: number; bigBlind: number; currentBet: number; minRaise: number; pot: number; message: string; payouts: number[]; acted: number[]; finishOrder:number[] }
export type Action = { type:'fold' }|{type:'check' }|{type:'call'}|{type:'raise'; to:number}
export interface View extends Omit<State,'deck'|'players'> { players: Array<Omit<Player,'hole'> & {hole: Card[]}>; self:number }
