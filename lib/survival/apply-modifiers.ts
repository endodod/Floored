import type { GameResolvePayload } from '@/hooks/use-game-bankroll'
import {
  applyPayoutBoost,
  computePayoutMultiplier,
} from './survival-perks'
import type { Difficulty, GameName, PurchasedUpgrade } from '@/store/types'

export interface ResolveModifierResult {
  payout: number
  multiplier?: number
  payoutBoostMult: number
  firstBetWasFree: boolean
}

export function applyResolveModifiers(
  payload: GameResolvePayload & { game: GameName },
  state: {
    purchasedUpgrades: PurchasedUpgrade[]
    difficulty: Difficulty | null
    wasFreeBet: boolean
  },
): ResolveModifierResult {
  const payoutBoostMult = computePayoutMultiplier(state.purchasedUpgrades, payload.game)
  let payout = payload.payout
  let firstBetWasFree = false

  if (payload.outcome === 'win' && payout > 0) {
    payout = applyPayoutBoost(payout, state.purchasedUpgrades, payload.game)
  }

  if (state.wasFreeBet) {
    firstBetWasFree = true
    // Free bet pays profit only — stake was never deducted. So a push, and a loss that
    // returns part of the stake (Crash Cushion, a Roulette partial, a sub-1× Plinko
    // bucket), nets nothing rather than paying out.
    payout = Math.max(0, payout - payload.betAmount)
  }

  let multiplier = payload.multiplier
  if (multiplier != null && payoutBoostMult > 1 && payload.outcome === 'win' && !state.wasFreeBet) {
    multiplier = parseFloat((multiplier * payoutBoostMult).toFixed(2))
  } else if (
    multiplier != null &&
    payoutBoostMult > 1 &&
    payload.outcome === 'win' &&
    state.wasFreeBet &&
    payout > 0
  ) {
    const profitMult = payload.betAmount > 0 ? payout / payload.betAmount : multiplier
    multiplier = parseFloat(profitMult.toFixed(2))
  }

  return { payout, multiplier, payoutBoostMult, firstBetWasFree }
}
