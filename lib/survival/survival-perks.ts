import type { GameName, PurchasedUpgrade } from '@/store/types'
import { getCatalogItem, normalizeUpgradeId } from './upgrades-catalog'
import { RAW_PAYOUT_MULT_CAP } from './balance'
import {
  COIN_BIAS_CHANCE_BY_LEVEL,
  CRASH_CUSHION_BY_LEVEL,
  OPENING_TICKET_CAP_BY_LEVEL,
} from './upgrade-levels'
import { getMaxOwnedLevelForEffect } from './upgrades-catalog'

export function hasEffect(purchasedUpgrades: PurchasedUpgrade[], effectKey: string, game?: GameName): boolean {
  if (game) {
    return (
      getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { game, scope: 'game' }) > 0 ||
      getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { scope: 'run' }) > 0
    )
  }
  return getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { scope: 'run' }) > 0
}

export function hasGamePerk(purchasedUpgrades: PurchasedUpgrade[], game: GameName, effectKey: string): boolean {
  return getPerkLevel(purchasedUpgrades, game, effectKey) > 0
}

export function getPerkLevel(
  purchasedUpgrades: PurchasedUpgrade[],
  game: GameName,
  effectKey: string,
): number {
  return getMaxOwnedLevelForEffect(purchasedUpgrades, effectKey, { game, scope: 'game' })
}

function parsePayoutMultFromEffectKey(effectKey: string): number | null {
  const m = effectKey.match(/^payout_mult_([\d.]+)$/)
  if (!m) return null
  const v = parseFloat(m[1]!)
  return Number.isFinite(v) && v > 0 ? v : null
}

function payoutMultForItem(item: NonNullable<ReturnType<typeof getCatalogItem>>): number | null {
  if (item.payoutMult != null) return item.payoutMult
  return parsePayoutMultFromEffectKey(item.effectKey)
}

/** Combined payout multiplier from run-wide and game-specific boosts. */
export function computePayoutMultiplier(purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  let mult = 1
  for (const pu of purchasedUpgrades) {
    const item = getCatalogItem(normalizeUpgradeId(pu.id))
    if (!item) continue
    const parsed = payoutMultForItem(item)
    if (parsed == null) continue
    if (item.scope === 'run' || (item.scope === 'game' && item.game === game)) {
      mult *= parsed
    }
  }
  return Math.min(RAW_PAYOUT_MULT_CAP, mult)
}

export function applyPayoutBoost(amount: number, purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  if (amount <= 0) return amount
  return Math.floor(amount * computePayoutMultiplier(purchasedUpgrades, game))
}

export function hasFreeFirstBet(purchasedUpgrades: PurchasedUpgrade[]): boolean {
  return (
    getMaxOwnedLevelForEffect(purchasedUpgrades, 'first_bet_free', { scope: 'run' }) > 0 ||
    hasEffect(purchasedUpgrades, 'first_bet_refund')
  )
}

export function getOpeningTicketCapMultiplier(purchasedUpgrades: PurchasedUpgrade[]): number {
  const level = getMaxOwnedLevelForEffect(purchasedUpgrades, 'first_bet_free', { scope: 'run' })
  if (level <= 0) return 10
  return OPENING_TICKET_CAP_BY_LEVEL[level - 1] ?? 10
}

export function isOpeningBetFreeAvailable(state: {
  currentFloor: number
  history: { floor: number }[]
  firstBetInsuranceUsed: boolean
  purchasedUpgrades: PurchasedUpgrade[]
  runActive: boolean
}): boolean {
  if (!state.runActive) return false
  const isFirstBetThisFloor = state.history.filter((h) => h.floor === state.currentFloor).length === 0
  return (
    isFirstBetThisFloor &&
    !state.firstBetInsuranceUsed &&
    hasFreeFirstBet(state.purchasedUpgrades)
  )
}

export function survivalWagerCap(
  bankroll: number,
  openingBetFree: boolean,
  openingTicketFreeCap: number,
): number {
  if (!openingBetFree) return bankroll
  return Math.max(bankroll, openingTicketFreeCap)
}

export function getCoinBiasChance(purchasedUpgrades: PurchasedUpgrade[], game: GameName): number {
  const level = getPerkLevel(purchasedUpgrades, game, 'perk_coin_bias')
  if (level <= 0) return 0.5
  return COIN_BIAS_CHANCE_BY_LEVEL[level] ?? 0.55
}

/** Returns the fraction of the bet recovered when crash happens below 3×. */
export function getCrashCushion(level = 1): number {
  return CRASH_CUSHION_BY_LEVEL[Math.max(1, Math.min(5, level)) - 1] ?? 0.25
}
