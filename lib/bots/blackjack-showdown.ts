import { calculateHandValue } from '@/games/blackjack/engine'
import type { Action, PlayerView, Seat } from '@/games/blackjack-showdown/types'
import type { BotProfile } from './core'

export const BLACKJACK_BOTS: BotProfile[] = [
  { name: 'Mara', tier: 'Rookie', risk: 0.3, tightness: 0.3, aggression: 0.7, bluffRate: 0.1 },
  { name: 'Jax', tier: 'Regular', risk: 0.18, tightness: 0.55, aggression: 0.5, bluffRate: 0.08 },
  { name: 'Sage', tier: 'Shark', risk: 0.08, tightness: 0.75, aggression: 0.65, bluffRate: 0.04 },
]

/** Policy sees only the per-seat view; rng adds skill-scaled variation to bets. */
export function decideBlackjack(view: PlayerView, seat: Seat, profile: BotProfile, rng: () => number): Action {
  const self = view.players[seat]!
  if (view.phase === 'betting') {
    const leader = Math.max(...view.players.map(p => p.chips))
    const behind = self.chips < leader
    const base = view.handNumber === 12 ? (behind ? Math.min(500, Math.max(100, leader - self.chips)) : 10) : (behind ? 40 : 20)
    const skillNoise = profile.tier === 'Rookie' ? 1 : profile.tier === 'Regular' ? 0.5 : 0.15
    const noise = Math.round((rng() - 0.5) * profile.risk * 100 * skillNoise)
    const affordable = Math.floor(Math.min(500, self.chips) / 10) * 10
    return { type: 'bet', amount: Math.max(10, Math.min(affordable, Math.round((base + noise) / 10) * 10)) }
  }
  const value = calculateHandValue(self.hand)
  const hardValue = self.hand.reduce((sum, card) => sum + (card.rank === 'A' ? 1 : ['K', 'Q', 'J'].includes(card.rank) ? 10 : Number(card.rank)), 0)
  const soft = self.hand.some(card => card.rank === 'A') && hardValue + 10 <= 21
  const dealerUp = view.dealer[0]
  const dealerValue = dealerUp?.rank === 'A' ? 11 : ['K', 'Q', 'J'].includes(dealerUp?.rank ?? '') ? 10 : Number(dealerUp?.rank ?? 10)
  const canDouble = self.hand.length === 2 && self.chips >= self.bet
  if (canDouble && ((!soft && value === 9 && dealerValue >= 3 && dealerValue <= 6) || (!soft && value === 10 && dealerValue <= 9) || (!soft && value === 11 && dealerValue <= 10))) return { type: 'double' }
  if (soft) {
    if (value >= 19 || value === 18 && (dealerValue === 2 || dealerValue >= 7 && dealerValue <= 8)) return { type: 'stand' }
    if (value === 18 && dealerValue >= 3 && dealerValue <= 6) return canDouble ? { type: 'double' } : { type: 'stand' }
    const softDouble = value <= 14 ? dealerValue >= 5 && dealerValue <= 6 : value <= 16 ? dealerValue >= 4 && dealerValue <= 6 : dealerValue >= 3 && dealerValue <= 6
    if (canDouble && value <= 17 && softDouble) return { type: 'double' }
    return { type: 'hit' }
  }
  if (value < 12) return { type: 'hit' }
  if (value >= 17 || value >= 13 && dealerValue <= 6 || value === 12 && dealerValue >= 4 && dealerValue <= 6) return { type: 'stand' }
  return { type: 'hit' }
}
