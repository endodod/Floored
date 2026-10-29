import { calculateHandValue } from '../blackjack/engine'
import type { BlackjackCard, Rank, Suit } from '../blackjack/types'
import type { Action, Player, PlayerView, Seat, ShowdownState } from './types'

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const SEAT_COUNT = 4
const MIN_BET = 10
const MAX_BET = 500
const HANDS = 12

function makeShoe(rng: () => number): BlackjackCard[] {
  const cards = Array.from({ length: 6 }, () => SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank } as BlackjackCard)))).flat()
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cards[i], cards[j]] = [cards[j]!, cards[i]!] }
  return cards
}
const blackjack = (cards: BlackjackCard[]) => cards.length === 2 && calculateHandValue(cards) === 21

function beginHand(state: ShowdownState): ShowdownState {
  const players: Player[] = state.players.map(p => ({ ...p, hand: [], stood: false, busted: false, blackjack: false }))
  let shoe = [...state.shoe], dealer: BlackjackCard[] = []
  const draw = () => { const c = shoe.shift(); if (!c) throw new Error('Shoe exhausted'); return c }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < SEAT_COUNT; i++) if (!players[i]!.out) players[i]!.hand.push(draw())
    dealer.push(draw())
  }
  for (const p of players) { p.blackjack = blackjack(p.hand); p.stood = p.blackjack; p.busted = false }
  const currentSeat = players.findIndex(p => !p.out && !p.stood)
  if (currentSeat < 0) return settleHand({ ...state, players, dealer, shoe, phase: 'playing', currentSeat: null })
  return { ...state, players, dealer, shoe, phase: 'playing', currentSeat: currentSeat as Seat, message: 'Cards dealt.' }
}

export function createBlackjackShowdown(rng: () => number, names = ['You', 'Mara', 'Jax', 'Sage']): ShowdownState {
  return { phase: 'betting', handNumber: 1, dealer: [], players: names.slice(0, 4).map(name => ({ name, chips: 1000, bet: 0, hand: [], stood: false, busted: false, blackjack: false, out: false })), shoe: makeShoe(rng), currentSeat: 0, hiddenBets: false, message: 'Place your bets.', winner: null }
}

export function viewFor(state: ShowdownState, seat: Seat): PlayerView {
  const secret = state.handNumber === HANDS && state.phase === 'betting'
  const { shoe, ...publicState } = state
  return { ...publicState, shoeCount: shoe.length, self: seat, players: state.players.map((p, i) => ({ ...p, hand: [...p.hand], hiddenBet: secret && i !== seat && p.bet > 0, bet: secret && i !== seat ? 0 : p.bet })), dealer: state.phase === 'playing' && state.currentSeat !== null ? [state.dealer[0]!] : [...state.dealer] }
}

export function legalActions(state: ShowdownState, seat: Seat): Action[] {
  if (state.currentSeat !== seat) return []
  const p = state.players[seat]!
  if (state.phase === 'betting') return Array.from({ length: (MAX_BET - MIN_BET) / 10 + 1 }, (_, i) => ({ type: 'bet' as const, amount: MIN_BET + i * 10 })).filter(a => a.amount <= p.chips)
  if (state.phase === 'playing') return [{ type: 'hit' }, { type: 'stand' }, ...(p.hand.length === 2 && p.chips >= p.bet ? [{ type: 'double' as const }] : [])]
  if (state.phase === 'settled') return [{ type: 'next-hand' }]
  return []
}

function settleHand(state: ShowdownState): ShowdownState {
  let shoe = [...state.shoe], dealer = [...state.dealer]
  const draw = () => { const c = shoe.shift(); if (!c) return null; dealer.push(c); return c }
  while (calculateHandValue(dealer) < 17 && shoe.length) draw()
  const dealerBust = calculateHandValue(dealer) > 21, dealerValue = calculateHandValue(dealer), dealerBlackjack = blackjack(dealer)
  const players = state.players.map(p => {
    if (p.out) return { ...p, bet: 0 }
    if (p.busted) return { ...p, bet: 0, out: p.chips < MIN_BET }
    const value = calculateHandValue(p.hand)
    const win = p.blackjack ? !dealerBlackjack : !dealerBlackjack && (dealerBust || value > dealerValue)
    const push = (p.blackjack && dealerBlackjack) || (!p.blackjack && !dealerBlackjack && !dealerBust && value === dealerValue)
    const chips = p.chips + (win ? p.bet * (p.blackjack ? 2.5 : 2) : push ? p.bet : 0)
    return { ...p, chips, bet: 0, out: chips < MIN_BET }
  })
  const ended = state.handNumber >= HANDS || players.filter(p => !p.out).length <= 1
  const max = Math.max(...players.map(p => p.chips)), winner = ended ? (players.findIndex(p => p.chips === max) as Seat) : null
  const nextSeat = players.findIndex(p => !p.out)
  return { ...state, players, shoe, dealer, phase: ended ? 'finished' : 'settled', currentSeat: ended ? null : nextSeat as Seat, winner, message: ended ? `${players[winner!]?.name ?? 'A player'} wins the table.` : 'Hand complete.' }
}

export function apply(state: ShowdownState, seat: Seat, action: Action): ShowdownState {
  if (!legalActions(state, seat).some(a => a.type === action.type && ('amount' in a ? 'amount' in action && a.amount === action.amount : true))) throw new Error('Illegal action')
  if (action.type === 'bet') {
    const players = state.players.map((p, i) => i === seat ? { ...p, chips: p.chips - action.amount, bet: action.amount } : p)
    const next = players.findIndex((p, i) => i > seat && !p.out && !p.bet)
    const partial = { ...state, players, currentSeat: next >= 0 ? next as Seat : null, hiddenBets: state.handNumber === HANDS }
    return next >= 0 ? partial : beginHand(partial)
  }
  if (action.type === 'next-hand') {
    const players: Player[] = state.players.map(p => ({ ...p, hand: [], stood: false, busted: false, blackjack: false }))
    return { ...state, players, dealer: [], handNumber: state.handNumber + 1, phase: 'betting', currentSeat: players.findIndex(p => !p.out) as Seat, hiddenBets: false, message: 'Place your bets.' }
  }
  const players = state.players.map(p => ({ ...p, hand: [...p.hand] }))
  const player = players[seat]!
  if (action.type === 'hit' || action.type === 'double') {
    const card = state.shoe[0]
    if (!card) throw new Error('Shoe exhausted')
    player.hand.push(card)
    if (action.type === 'double') { player.chips -= player.bet; player.bet *= 2; player.stood = true }
    player.busted = calculateHandValue(player.hand) > 21
    if (player.busted || calculateHandValue(player.hand) === 21) player.stood = true
  } else player.stood = true
  const shoe = (action.type === 'hit' || action.type === 'double') ? state.shoe.slice(1) : state.shoe
  const next = players.findIndex((p, i) => i > seat && !p.out && !p.stood && !p.busted)
  if (next >= 0) return { ...state, players, shoe, currentSeat: next as Seat, message: `${players[seat]!.name} acted.` }
  return settleHand({ ...state, players, shoe })
}

export const blackjackShowdownRules = { minBet: MIN_BET, maxBet: MAX_BET, hands: HANDS, seats: SEAT_COUNT, buyIns: [100, 500, 2000] as const, prize: 'winner-takes-all' as const }
