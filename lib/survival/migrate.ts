import type { Difficulty, PurchasedUpgrade } from '@/store/types'
import { SURVIVAL_GAME_POOL, calcQuotaTarget } from './balance'
import { generateFloor } from './floor-generator'
import { missionOfferedKeysFromMissions } from './missions'
import { lobbyGamesOfferedFromFloor } from './lobby-ticket'
import { offeredIdsFromSlots, rollInitialShopOffers } from './shop-offers'
import { getCatalogItem, normalizeUpgradeId } from './upgrades-catalog'

function migratePurchasedUpgradeIds(raw: unknown): PurchasedUpgrade[] {
  if (!Array.isArray(raw)) return []
  const byFamily = new Map<string, PurchasedUpgrade>()
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    const id = typeof rec.id === 'string' ? normalizeUpgradeId(rec.id) : null
    if (!id) continue
    const purchasedAt =
      typeof rec.purchasedAt === 'string' ? rec.purchasedAt : new Date().toISOString()
    const item = getCatalogItem(id)
    const familyId = item?.familyId ?? id
    const existing = byFamily.get(familyId)
    if (!existing) {
      byFamily.set(familyId, { id, purchasedAt })
      continue
    }
    const existingItem = getCatalogItem(existing.id)
    if ((item?.level ?? 0) >= (existingItem?.level ?? 0)) {
      byFamily.set(familyId, { id, purchasedAt })
    }
  }
  return Array.from(byFamily.values())
}

/**
 * Zustand persist migration callback for the floored-survival key.
 */
export function migratePersistedState(raw: unknown, fromVersion: number): unknown {
  if (fromVersion >= 5) return raw

  const s =
    raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  let base: Record<string, unknown> = { ...s }

  if (fromVersion < 3) {
    const floor = typeof s.currentFloor === 'number' ? s.currentFloor : 1
    const difficulty = (s.difficulty as Difficulty | null) ?? null
    const runSeed = typeof s.runSeed === 'string' ? s.runSeed : null
    const startBankroll = typeof s.bankroll === 'number' ? s.bankroll : 1000

    let quotaTarget = calcQuotaTarget(floor, difficulty ?? 'normal')
    let floorGames = SURVIVAL_GAME_POOL.slice(0, 6)
    let missions: unknown[] = []

    if (runSeed && difficulty) {
      try {
        const generated = generateFloor({
          runSeed,
          floor,
          difficulty,
          survivalGamePool: SURVIVAL_GAME_POOL,
          previousFloors: [],
          ownedGames: [],
        })
        quotaTarget = generated.quotaTarget
        floorGames = generated.floorGames
        missions = generated.missions
      } catch {
        // fall through to defaults
      }
    }

    const bankroll = typeof s.bankroll === 'number' ? s.bankroll : startBankroll
    const quotaTargetVal = typeof s.quotaTarget === 'number' ? s.quotaTarget : quotaTarget
    const hadStaleQuotaComplete = fromVersion < 3 && s.floorComplete === true

    base = {
      ...s,
      floorComplete: hadStaleQuotaComplete ? false : s.floorComplete === true,
      quotaTarget: quotaTargetVal,
      floorStartBankroll:
        typeof s.floorStartBankroll === 'number' ? s.floorStartBankroll : startBankroll,
      floorGames: Array.isArray(s.floorGames) && s.floorGames.length > 0 ? s.floorGames : floorGames,
      missions: Array.isArray(s.missions) && s.missions.length > 0 ? s.missions : missions,
      completedMissionIds: Array.isArray(s.completedMissionIds) ? s.completedMissionIds : [],
      inventory: Array.isArray(s.inventory) ? s.inventory : [],
      floorHistory: Array.isArray(s.floorHistory) ? s.floorHistory : [],
      firstBetInsuranceUsed:
        typeof s.firstBetInsuranceUsed === 'boolean' ? s.firstBetInsuranceUsed : false,
      shopRerollCount: typeof s.shopRerollCount === 'number' ? s.shopRerollCount : 0,
      missionRerollCount: typeof s.missionRerollCount === 'number' ? s.missionRerollCount : 0,
      lobbyRerollCount: typeof s.lobbyRerollCount === 'number' ? s.lobbyRerollCount : 0,
      shopSlotItemIds:
        Array.isArray(s.shopSlotItemIds) && s.shopSlotItemIds.length > 0
          ? s.shopSlotItemIds
          : [null, null, null, null],
      shopOfferedIds:
        s.shopOfferedIds != null &&
        typeof s.shopOfferedIds === 'object' &&
        Array.isArray((s.shopOfferedIds as { game?: unknown }).game)
          ? (s.shopOfferedIds as { game: string[]; run: string[]; active: string[] })
          : { game: [], run: [], active: [] },
      shopTicketRollSeq: typeof s.shopTicketRollSeq === 'number' ? s.shopTicketRollSeq : 0,
      missionOfferedKeys:
        Array.isArray((s as { missionOfferedKeys?: unknown }).missionOfferedKeys)
          ? ((s as { missionOfferedKeys: string[] }).missionOfferedKeys)
          : [],
      missionTicketRerolledSlots: Array.isArray(
        (s as { missionTicketRerolledSlots?: unknown }).missionTicketRerolledSlots,
      )
        ? ((s as { missionTicketRerolledSlots: number[] }).missionTicketRerolledSlots)
        : [],
      lobbyGamesOffered: Array.isArray((s as { lobbyGamesOffered?: unknown }).lobbyGamesOffered)
        ? ((s as { lobbyGamesOffered: import('@/store/types').GameName[] }).lobbyGamesOffered)
        : [],
      runDefeated: typeof s.runDefeated === 'boolean' ? s.runDefeated : false,
      defeatReason:
        s.defeatReason === 'bust' || s.defeatReason === 'quota' ? s.defeatReason : null,
      pendingDefeatReason:
        s.pendingDefeatReason === 'bust' || s.pendingDefeatReason === 'quota'
          ? s.pendingDefeatReason
          : null,
      endlessMode: typeof s.endlessMode === 'boolean' ? s.endlessMode : false,
      quotaMet: typeof s.quotaMet === 'boolean' ? s.quotaMet : bankroll >= quotaTargetVal,
      floorBetsPlaced: 0,
    }
  }

  const runActive = base.runActive === true
  const runSeed = typeof base.runSeed === 'string' ? base.runSeed : null
  const floor = typeof base.currentFloor === 'number' ? base.currentFloor : 1
  const floorGames = Array.isArray(base.floorGames) ? (base.floorGames as string[]) : []
  const purchasedUpgrades = migratePurchasedUpgradeIds(base.purchasedUpgrades)
  const shopRerollCount = typeof base.shopRerollCount === 'number' ? base.shopRerollCount : 0

  let shopSlotItemIds: (string | null)[] =
    Array.isArray(base.shopSlotItemIds) && base.shopSlotItemIds.length > 0
      ? (base.shopSlotItemIds as (string | null)[])
      : [null, null, null, null]

  if (
    runActive &&
    runSeed &&
    floorGames.length > 0 &&
    shopSlotItemIds.every((id) => id == null)
  ) {
    const rolled = rollInitialShopOffers({
      runSeed,
      floor,
      rerollCount: shopRerollCount,
      floorGames: floorGames as import('@/store/types').GameName[],
      ownedUpgradeIds: purchasedUpgrades.map((u) => u.id),
    })
    shopSlotItemIds = rolled.slotItemIds
  }

  let shopOfferedIds =
    base.shopOfferedIds != null &&
    typeof base.shopOfferedIds === 'object' &&
    Array.isArray((base.shopOfferedIds as { game?: unknown }).game)
      ? (base.shopOfferedIds as { game: string[]; run: string[]; active: string[] })
      : offeredIdsFromSlots(shopSlotItemIds)

  const missions = Array.isArray(base.missions) ? (base.missions as import('@/store/types').FloorMission[]) : []
  const floorGamesArr = Array.isArray(base.floorGames)
    ? (base.floorGames as import('@/store/types').GameName[])
    : []

  const missionOfferedKeys =
    Array.isArray(base.missionOfferedKeys) && base.missionOfferedKeys.length > 0
      ? (base.missionOfferedKeys as string[])
      : missionOfferedKeysFromMissions(missions)

  const lobbyGamesOffered =
    Array.isArray(base.lobbyGamesOffered) && base.lobbyGamesOffered.length > 0
      ? (base.lobbyGamesOffered as import('@/store/types').GameName[])
      : lobbyGamesOfferedFromFloor(floorGamesArr)

  const { shopOfferTicketRerolls: _t, shopOfferOverrides: _o, shopOfferSeenIds: _s, ...rest } =
    base

  return {
    ...rest,
    version: 5,
    purchasedUpgrades,
    shopSlotItemIds,
    shopOfferedIds,
    shopTicketRollSeq: typeof base.shopTicketRollSeq === 'number' ? base.shopTicketRollSeq : 0,
    missionOfferedKeys,
    missionTicketRerolledSlots: Array.isArray(base.missionTicketRerolledSlots)
      ? (base.missionTicketRerolledSlots as number[])
      : [],
    lobbyGamesOffered,
    floorBetsPlaced: typeof base.floorBetsPlaced === 'number' ? base.floorBetsPlaced : 0,
  }
}
