import type { HiLoCard } from '@/games/hilo/types'
import type { BaccaratBets, BaccaratSpot, BaccaratState } from './types'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const VALUES: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 }
const CARDS: HiLoCard[] = SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank, value: VALUES[rank]! })))

export function cardValue(card: HiLoCard): number { return ['10', 'J', 'Q', 'K'].includes(card.rank) ? 0 : card.rank === 'A' ? 1 : Number(card.rank) }
export function handTotal(cards: HiLoCard[]): number { return cards.reduce((sum, card) => sum + cardValue(card), 0) % 10 }
export function bankerDraws(total: number, playerThirdValue: number | null): boolean {
  if (playerThirdValue == null) return total <= 5
  if (total <= 2) return true
  if (total === 3) return playerThirdValue !== 8
  if (total === 4) return playerThirdValue >= 2 && playerThirdValue <= 7
  if (total === 5) return playerThirdValue >= 4 && playerThirdValue <= 7
  if (total === 6) return playerThirdValue === 6 || playerThirdValue === 7
  return false
}
export function drawCard(): HiLoCard { return CARDS[Math.floor(Math.random() * CARDS.length)]! }
export function peekPlayerCard(): HiLoCard { return drawCard() }

function winnerFor(player: HiLoCard[], banker: HiLoCard[]) {
  const p = handTotal(player), b = handTotal(banker)
  return p > b ? 'player' as const : b > p ? 'banker' as const : 'tie' as const
}
export function settleBaccarat(bets: BaccaratBets, player: HiLoCard[], banker: HiLoCard[], deal?: BaccaratState['deal']): BaccaratState {
  const winner = winnerFor(player, banker)
  const totalBetAmount = Object.values(bets).reduce((sum, amount) => sum + Math.max(0, amount ?? 0), 0)
  const shell: BaccaratState = { stage: 'settled', player, banker, playerTotal: handTotal(player), bankerTotal: handTotal(banker), winner, deal: deal ?? [...player.map(card => ({ hand: 'player' as const, card })), ...banker.map(card => ({ hand: 'banker' as const, card }))], totalBetAmount, totalPayout: 0, outcome: null, message: `${winner === 'tie' ? 'Tie' : `${winner[0]!.toUpperCase()}${winner.slice(1)} wins`}.` }
  const totalPayout = payoutFor(bets, shell)
  return { ...shell, totalPayout, outcome: totalPayout > totalBetAmount ? 'win' : totalPayout === totalBetAmount ? 'push' : 'loss' }
}

export function payoutFor(bets: BaccaratBets, state: Pick<BaccaratState, 'player' | 'banker' | 'winner'>): number {
  let payout = 0
  for (const spot of Object.keys(bets) as BaccaratSpot[]) {
    const amount = Math.max(0, bets[spot] ?? 0)
    if (!amount) continue
    let returnMult = 0
    if (spot === 'player') returnMult = state.winner === 'tie' ? 1 : state.winner === 'player' ? 2 : 0
    else if (spot === 'banker') returnMult = state.winner === 'tie' ? 1 : state.winner === 'banker' ? 1.95 : 0
    else if (spot === 'tie') returnMult = state.winner === 'tie' ? 9 : 0
    else if (spot === 'player-pair') returnMult = state.player[0]?.rank === state.player[1]?.rank ? 12 : 0
    else if (spot === 'banker-pair') returnMult = state.banker[0]?.rank === state.banker[1]?.rank ? 12 : 0
    payout += Math.floor(amount * returnMult)
  }
  return payout
}

export function dealBaccarat(bets: BaccaratBets, firstPlayerCard?: HiLoCard): BaccaratState {
  const player: HiLoCard[] = [], banker: HiLoCard[] = [], deal: BaccaratState['deal'] = []
  const draw = (hand: 'player' | 'banker', card?: HiLoCard) => {
    const next = card ?? drawCard()
    ;(hand === 'player' ? player : banker).push(next)
    deal.push({ hand, card: next })
  }
  draw('player', firstPlayerCard); draw('banker'); draw('player'); draw('banker')
  const p2 = handTotal(player), b2 = handTotal(banker)
  if (p2 < 8 && b2 < 8) {
    let p3: HiLoCard | null = null
    if (p2 <= 5) { p3 = drawCard(); player.push(p3); deal.push({ hand: 'player', card: p3 }) }
    if (bankerDraws(b2, p3 ? cardValue(p3) : null)) draw('banker')
  }
  return settleBaccarat(bets, player, banker, deal)
}

export function winGame(bets: BaccaratBets): BaccaratState {
  let best: BaccaratState | null = null
  for (let i = 0; i < 500; i++) { const state = dealBaccarat(bets); if (!best || state.totalPayout > best.totalPayout) best = state; if (state.totalPayout > state.totalBetAmount) return state }
  return best ?? dealBaccarat(bets)
}
export function loseGame(bets: BaccaratBets): BaccaratState {
  let best: BaccaratState | null = null
  for (let i = 0; i < 500; i++) { const state = dealBaccarat(bets); if (!best || state.totalPayout < best.totalPayout) best = state; if (state.totalPayout === 0) return state }
  return best ?? dealBaccarat(bets)
}
