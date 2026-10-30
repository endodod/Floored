import type { HiLoCard } from '@/games/hilo/types'
import type { DragonTigerBet, DragonTigerBets, DragonTigerState } from './types'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
const VALUES: Record<string, number> = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 }
const CARDS: HiLoCard[] = SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank, value: VALUES[rank]! })))

export function cardValue(card: HiLoCard): number { return VALUES[card.rank]! }
export function drawCard(): HiLoCard { return CARDS[Math.floor(Math.random() * CARDS.length)]! }
export function initDragonTiger(): DragonTigerState {
  return { stage: 'betting', dragon: null, tiger: null, winner: null, bet: null, bets: {}, betAmount: 0, payout: 0, outcome: null, message: 'Choose Dragon, Tiger or Tie.' }
}
export function settleDragonTiger(bets: DragonTigerBets, dragon: HiLoCard, tiger: HiLoCard): DragonTigerState {
  const winner: DragonTigerBet = dragon.value === tiger.value ? 'tie' : dragon.value > tiger.value ? 'dragon' : 'tiger'
  const multiplier = winner === 'tie' ? 12 : 2
  const betAmount = Object.values(bets).reduce((sum, amount) => sum + (amount ?? 0), 0)
  const payout = Math.floor((bets[winner] ?? 0) * multiplier)
  return { stage: 'settled', dragon, tiger, winner, bet: winner, bets, betAmount, payout, outcome: payout > betAmount ? 'win' : 'loss', message: `${winner[0]!.toUpperCase()}${winner.slice(1)} wins.` }
}
export function dealDragonTiger(bets: DragonTigerBets, firstDragon?: HiLoCard): DragonTigerState {
  return settleDragonTiger(bets, firstDragon ?? drawCard(), drawCard())
}
export function winGame(bets: DragonTigerBets): DragonTigerState {
  for (let i = 0; i < 500; i++) { const result = dealDragonTiger(bets); if (result.winner && (bets[result.winner] ?? 0) > 0) return result }
  return dealDragonTiger(bets)
}
export function loseGame(bets: DragonTigerBets): DragonTigerState {
  for (let i = 0; i < 500; i++) { const result = dealDragonTiger(bets); if (!result.winner || (bets[result.winner] ?? 0) <= 0) return result }
  return dealDragonTiger(bets)
}
