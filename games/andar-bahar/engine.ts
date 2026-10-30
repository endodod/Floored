import type { HiLoCard } from '@/games/hilo/types'
import type { AndarBaharSide, AndarBaharState } from './types'
type AndarBaharBets = Partial<Record<AndarBaharSide, number>>

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
const VALUES: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 }
const CARDS: HiLoCard[] = SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank, value: VALUES[rank]! })))

function shuffledDeck(): HiLoCard[] {
  const deck = [...CARDS]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j]!, deck[i]!]
  }
  return deck
}

export function initAndarBahar(): AndarBaharState {
  return { stage: 'betting', joker: null, andar: [], bahar: [], matchCard: null, winner: null, betSide: null, betAmount: 0, payout: 0, outcome: null, message: 'Choose a pile and place your bet.', deal: [] }
}

export function dealAndarBahar(bets: AndarBaharBets): AndarBaharState {
  const betSide = (Object.keys(bets)[0] ?? 'andar') as AndarBaharSide
  const betAmount = Object.values(bets).reduce((sum, amount) => sum + (amount ?? 0), 0)
  const deck = shuffledDeck()
  const joker = deck.pop()!
  const andar: HiLoCard[] = []
  const bahar: HiLoCard[] = []
  const deal: AndarBaharState['deal'] = []
  let winner: AndarBaharSide | null = null
  let matchCard: HiLoCard | null = null
  while (deck.length && !winner) {
    const side: AndarBaharSide = (andar.length + bahar.length) % 2 === 0 ? 'andar' : 'bahar'
    const card = deck.pop()!
    deal.push({ side, card })
    if (card.rank === joker.rank) {
      winner = side
      matchCard = card
      ;(side === 'andar' ? andar : bahar).push(card)
    } else {
      ;(side === 'andar' ? andar : bahar).push(card)
    }
  }
  const payout = Math.floor((bets[winner ?? 'andar'] ?? 0) * 1.95)
  return { stage: 'settled', joker, andar, bahar, matchCard, winner, betSide, betAmount, payout, outcome: payout > betAmount ? 'win' : 'loss', message: `${winner === 'andar' ? 'Andar' : 'Bahar'} matched the Joker.`, deal }
}

export function winGame(bets: AndarBaharBets): AndarBaharState {
  for (let i = 0; i < 500; i++) {
    const result = dealAndarBahar(bets)
    if ((result.winner && (bets[result.winner] ?? 0) > 0)) return result
  }
  return dealAndarBahar(bets)
}

export function loseGame(bets: AndarBaharBets): AndarBaharState {
  for (let i = 0; i < 500; i++) {
    const result = dealAndarBahar(bets)
    if (!result.winner || (bets[result.winner] ?? 0) <= 0) return result
  }
  return dealAndarBahar(bets)
}
