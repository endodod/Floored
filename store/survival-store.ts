'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSettingsStore } from './settings-store'
import type {
  SurvivalStore,
  Difficulty,
  GameName,
  GameResult,
  FloorRecord,
  DefeatReason,
} from './types'
import { getFloorMinBet } from '@/utils/math'
import { generateRunDiceConfig } from '@/games/run-dice/engine'
import { generateFloor } from '@/lib/survival/floor-generator'
import {
  MAX_FLOORS,
  FLOOR_BET_LIMIT,
  SURVIVAL_GAME_POOL,
  calcShopRerollCost,
  calcMissionRerollCost,
  calcShopPrice,
  GRANT_ALL_UPGRADES,
  STARTING_BANKROLL,
  STARTING_SPARKS,
  STARTING_REROLL_TICKETS,
  REROLL_TICKETS_PER_FLOOR,
} from '@/lib/survival/balance'
import { calcFloorSparksEarned } from '@/lib/survival/sparks-economy'
import { migratePersistedState } from '@/lib/survival/migrate'
import { allPurchasedUpgradesForDev, getCatalogItem } from '@/lib/survival/upgrades-catalog'
import {
  LOBBY_REROLL_TICKET,
  LOBBY_REROLL_TICKET_ID,
  applyLobbyGameReroll,
  canRerollLobbyGameWithTicket,
  lobbyGamesOfferedFromFloor,
  pickLobbyGameReroll,
} from '@/lib/survival/lobby-ticket'
import { canRerollMissionWithTicket } from '@/lib/survival/mission-reroll'
import {
  generateMissionsForFloor,
  missionOfferKey,
  missionOfferedKeysFromMissions,
  pickMissionRerollForSlot,
  type MissionType,
} from '@/lib/survival/missions'
import { canPurchaseUpgrade, normalizeUpgradeId } from '@/lib/survival/upgrades-catalog'
import { canRerollMission, canRerollMissions } from '@/lib/survival/mission-reroll'
import {
  EMPTY_SHOP_OFFERED_IDS,
  EMPTY_SHOP_SLOT_ITEM_IDS,
  addOfferedId,
  getShopPools,
  pickRerollForShopSlot,
  rollInitialShopOffers,
  shopPoolKindForSlot,
} from '@/lib/survival/shop-offers'

function generateSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function initialFloorBetState() {
  return {
    floorBetsPlaced: 0,
    quotaMet: false,
  }
}

const RUN_PERSIST_KEYS = [
  'version',
  'bankroll',
  'sparks',
  'runActive',
  'runSeed',
  'gamesPlayed',
  'streak',
  'currentFloor',
  'floorMinBet',
  'diceConfig',
  'difficulty',
  'modifiers',
  'history',
  'peakBankroll',
  'survivalHighscore',
  'survivalWinCount',
  'lastRun',
  'runStartedAt',
  'lastSyncedRunAt',
  'quotaTarget',
  'floorStartBankroll',
  'floorGames',
  'missions',
  'completedMissionIds',
  'purchasedUpgrades',
  'inventory',
  'floorHistory',
  'floorComplete',
  'floorCompleteReason',
  'runDefeated',
  'defeatReason',
  'pendingDefeatReason',
  'quotaMet',
  'floorBetsPlaced',
  'firstBetInsuranceUsed',
  'shopRerollCount',
  'shopPurchaseCount',
  'shopPurchasedSlotIndices',
  'missionRerollCount',
  'lobbyRerollCount',
  'shopSlotItemIds',
  'shopOfferedIds',
  'shopTicketRollSeq',
  'missionOfferedKeys',
  'missionTicketRerolledSlots',
  'lobbyGamesOffered',
  'endlessMode',
  'cursed',
  'blessed',
] as const

function initShopSlotState(input: {
  runSeed: string
  floor: number
  rerollCount?: number
  floorGames: GameName[]
  ownedUpgradeIds: string[]
}) {
  const { slotItemIds, offeredIds } = rollInitialShopOffers(input)
  return {
    shopSlotItemIds: slotItemIds,
    shopOfferedIds: offeredIds,
    shopTicketRollSeq: 0,
  }
}

function initFloorTicketRerollState(input: {
  runSeed: string
  floor: number
  rerollCount?: number
  floorGames: GameName[]
  ownedUpgradeIds: string[]
  missions: import('./types').FloorMission[]
}) {
  return {
    ...initShopSlotState(input),
    missionOfferedKeys: missionOfferedKeysFromMissions(input.missions),
    missionTicketRerolledSlots: [] as number[],
    lobbyGamesOffered: lobbyGamesOfferedFromFloor(input.floorGames),
  }
}

export const useSurvivalStore = create<SurvivalStore>()(
  persist(
    (set, get) => ({
      version: 5,
      bankroll: STARTING_BANKROLL,
      setBankroll: (n) => set({ bankroll: n }),

      sparks: STARTING_SPARKS,
      addSparks: (n) => set((s) => ({ sparks: s.sparks + n })),
      spendSparks: (n) => set((s) => ({ sparks: Math.max(0, s.sparks - n) })),
      setSparks: (n) => set({ sparks: Math.max(0, n) }),
      devSetPurchasedUpgrades: (upgrades) => set({ purchasedUpgrades: upgrades }),

      runActive: false,
      runSeed: null,
      gamesPlayed: 0,
      streak: 0,

      currentFloor: 1,
      slotsUsed: 0,
      floorMinBet: getFloorMinBet(1),

      diceConfig: { win: [], loss: [], neutral: [] },
      difficulty: null,
      modifiers: [],
      history: [],
      peakBankroll: STARTING_BANKROLL,
      survivalHighscore: 0,
      survivalWinCount: 0,
      lastRun: null,
      runStartedAt: null,
      lastSyncedRunAt: null,
      markRunSynced: (endedAt) => set({ lastSyncedRunAt: endedAt }),

      quotaTarget: 0,
      floorStartBankroll: STARTING_BANKROLL,
      floorGames: [],
      missions: [],
      completedMissionIds: [],
      purchasedUpgrades: [],
      inventory: [],
      floorHistory: [],
      floorComplete: false,
      floorCompleteReason: null,
      runDefeated: false,
      defeatReason: null,
      pendingDefeatReason: null,
      firstBetInsuranceUsed: false,
      shopRerollCount: 0,
      shopPurchaseCount: 0,
      shopPurchasedSlotIndices: [] as number[],
      missionRerollCount: 0,
      lobbyRerollCount: 0,
      shopSlotItemIds: [...EMPTY_SHOP_SLOT_ITEM_IDS],
      shopOfferedIds: { game: [], run: [], active: [] },
      shopTicketRollSeq: 0,
      missionOfferedKeys: [],
      missionTicketRerolledSlots: [],
      lobbyGamesOffered: [],
      endlessMode: false,
      cursed: false,
      blessed: false,
      runEndedByExit: false,
      ...initialFloorBetState(),

      startRun: (difficulty: Difficulty) => {
        const runSeed = generateSeed()
        const floor1 = generateFloor({
          runSeed,
          floor: 1,
          difficulty,
          survivalGamePool: SURVIVAL_GAME_POOL,
        })
        set({
          version: 5,
          bankroll: STARTING_BANKROLL,
          sparks: STARTING_SPARKS,
          runActive: true,
          runSeed,
          gamesPlayed: 0,
          streak: 0,
          currentFloor: 1,
          slotsUsed: 0,
          floorMinBet: getFloorMinBet(1),
          diceConfig: generateRunDiceConfig(),
          difficulty,
          modifiers: [],
          history: [],
          peakBankroll: STARTING_BANKROLL,
          lastRun: null,
          runStartedAt: new Date().toISOString(),
          quotaTarget: floor1.quotaTarget,
          floorStartBankroll: STARTING_BANKROLL,
          floorGames: floor1.floorGames,
          missions: floor1.missions,
          completedMissionIds: [],
          purchasedUpgrades: GRANT_ALL_UPGRADES ? allPurchasedUpgradesForDev() : [],
          inventory: GRANT_ALL_UPGRADES
            ? [{ id: LOBBY_REROLL_TICKET_ID, count: 99 }]
            : STARTING_REROLL_TICKETS > 0
            ? [{ id: LOBBY_REROLL_TICKET_ID, count: STARTING_REROLL_TICKETS }]
            : [],
          floorHistory: [],
          floorComplete: false,
          floorCompleteReason: null,
          runDefeated: false,
          defeatReason: null,
          pendingDefeatReason: null,
          runEndedByExit: false,
          firstBetInsuranceUsed: false,
          shopRerollCount: 0,
          shopPurchaseCount: 0,
          shopPurchasedSlotIndices: [],
          missionRerollCount: 0,
          lobbyRerollCount: 0,
          ...initFloorTicketRerollState({
            runSeed,
            floor: 1,
            floorGames: floor1.floorGames,
            ownedUpgradeIds: GRANT_ALL_UPGRADES
              ? allPurchasedUpgradesForDev().map((u) => u.id)
              : [],
            missions: floor1.missions,
          }),
          endlessMode: false,
          cursed: false,
          blessed: false,
          ...initialFloorBetState(),
        })
      },

      endRun: (opts) =>
        set((s) => {
          const floorSparkIncome = (opts?.victory ?? false) && s.difficulty != null
            ? calcFloorSparksEarned({
                floor: s.currentFloor,
                bankroll: s.bankroll,
                floorStartBankroll: s.floorStartBankroll,
                quotaTarget: s.quotaTarget,
                difficulty: s.difficulty,
              }) + s.missions.filter((m) => m.completed).reduce((sum, m) => sum + m.rewardSparks, 0)
            : 0
          const totalSparks = s.sparks + floorSparkIncome
          const floorsReached = opts?.victory ? MAX_FLOORS : s.currentFloor
          return {
            runActive: false,
            runSeed: null,
            floorComplete: false,
            floorCompleteReason: null,
            runDefeated: false,
            defeatReason: null,
            pendingDefeatReason: null,
            runEndedByExit: opts?.exiting ?? false,
            sparks: totalSparks,
            survivalHighscore: Math.max(s.survivalHighscore, floorsReached),
            survivalWinCount: s.survivalWinCount + (opts?.victory ? 1 : 0),
            lastRun: {
              endedAt: new Date().toISOString(),
              endBankroll: s.bankroll,
              floorsReached,
              gamesPlayed: s.gamesPlayed,
              peakBankroll: s.peakBankroll,
              sparksEarned: totalSparks,
              difficulty: s.difficulty,
              victory: opts?.victory ?? false,
              endlessMode: s.endlessMode,
              seed: s.runSeed,
              startedAt: s.runStartedAt,
              results: s.history,
            },
            endlessMode: false,
          }
        }),

      advanceFloor: () =>
        set((s) => {
          if (s.currentFloor >= MAX_FLOORS && !s.endlessMode) return s

          const floorSparkIncome = s.difficulty != null
            ? calcFloorSparksEarned({
                floor: s.currentFloor,
                bankroll: s.bankroll,
                floorStartBankroll: s.floorStartBankroll,
                quotaTarget: s.quotaTarget,
                difficulty: s.difficulty,
              }) + s.missions.filter((m) => m.completed).reduce((sum, m) => sum + m.rewardSparks, 0)
            : 0

          const nextFloor = s.currentFloor + 1
          const nextFloorData =
            s.runSeed && s.difficulty
              ? generateFloor({
                  runSeed: s.runSeed,
                  floor: nextFloor,
                  difficulty: s.difficulty,
                  survivalGamePool: SURVIVAL_GAME_POOL,
                })
              : { quotaTarget: s.quotaTarget, floorGames: s.floorGames, missions: s.missions }

          return {
            sparks: s.sparks + floorSparkIncome,
            currentFloor: nextFloor,
            slotsUsed: 0,
            floorMinBet: getFloorMinBet(nextFloor),
            quotaTarget: nextFloorData.quotaTarget,
            floorStartBankroll: s.bankroll,
            floorGames: nextFloorData.floorGames,
            missions: nextFloorData.missions,
            floorComplete: false,
            floorCompleteReason: null,
            firstBetInsuranceUsed: false,
            shopRerollCount: 0,
            shopPurchaseCount: 0,
            shopPurchasedSlotIndices: [],
            missionRerollCount: 0,
            lobbyRerollCount: 0,
            ...(s.runSeed
              ? initFloorTicketRerollState({
                  runSeed: s.runSeed,
                  floor: nextFloor,
                  floorGames: nextFloorData.floorGames,
                  ownedUpgradeIds: s.purchasedUpgrades.map((u) => u.id),
                  missions: nextFloorData.missions,
                })
              : {
                  shopSlotItemIds: [...EMPTY_SHOP_SLOT_ITEM_IDS],
                  shopOfferedIds: { game: [], run: [], active: [] },
                  shopTicketRollSeq: 0,
                  missionOfferedKeys: [],
                  missionTicketRerolledSlots: [],
                  lobbyGamesOffered: [],
                }),
            // grant per-floor reroll tickets
            inventory: (() => {
              const existing = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
              if (!existing) return [...s.inventory, { id: LOBBY_REROLL_TICKET_ID, count: REROLL_TICKETS_PER_FLOOR }]
              return s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count + REROLL_TICKETS_PER_FLOOR } : i,
              )
            })(),
            ...initialFloorBetState(),
            quotaMet: s.bankroll >= nextFloorData.quotaTarget,
          }
        }),

      continueToEndless: () =>
        set((s) => {
          if (s.currentFloor !== MAX_FLOORS || s.endlessMode) return s

          const floorSparkIncome = s.difficulty != null
            ? calcFloorSparksEarned({
                floor: s.currentFloor,
                bankroll: s.bankroll,
                floorStartBankroll: s.floorStartBankroll,
                quotaTarget: s.quotaTarget,
                difficulty: s.difficulty,
              }) + s.missions.filter((m) => m.completed).reduce((sum, m) => sum + m.rewardSparks, 0)
            : 0

          const nextFloor = s.currentFloor + 1
          const nextFloorData =
            s.runSeed && s.difficulty
              ? generateFloor({
                  runSeed: s.runSeed,
                  floor: nextFloor,
                  difficulty: s.difficulty,
                  survivalGamePool: SURVIVAL_GAME_POOL,
                })
              : { quotaTarget: s.quotaTarget, floorGames: s.floorGames, missions: s.missions }

          return {
            sparks: s.sparks + floorSparkIncome,
            endlessMode: true,
            currentFloor: nextFloor,
            slotsUsed: 0,
            floorMinBet: getFloorMinBet(nextFloor),
            quotaTarget: nextFloorData.quotaTarget,
            floorStartBankroll: s.bankroll,
            floorGames: nextFloorData.floorGames,
            missions: nextFloorData.missions,
            floorComplete: false,
            floorCompleteReason: null,
            firstBetInsuranceUsed: false,
            shopRerollCount: 0,
            shopPurchaseCount: 0,
            shopPurchasedSlotIndices: [],
            missionRerollCount: 0,
            lobbyRerollCount: 0,
            ...(s.runSeed
              ? initFloorTicketRerollState({
                  runSeed: s.runSeed,
                  floor: nextFloor,
                  floorGames: nextFloorData.floorGames,
                  ownedUpgradeIds: s.purchasedUpgrades.map((u) => u.id),
                  missions: nextFloorData.missions,
                })
              : {
                  shopSlotItemIds: [...EMPTY_SHOP_SLOT_ITEM_IDS],
                  shopOfferedIds: { game: [], run: [], active: [] },
                  shopTicketRollSeq: 0,
                  missionOfferedKeys: [],
                  missionTicketRerolledSlots: [],
                  lobbyGamesOffered: [],
                }),
            // grant per-floor reroll tickets
            inventory: (() => {
              const existing = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
              if (!existing) return [...s.inventory, { id: LOBBY_REROLL_TICKET_ID, count: REROLL_TICKETS_PER_FLOOR }]
              return s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count + REROLL_TICKETS_PER_FLOOR } : i,
              )
            })(),
            ...initialFloorBetState(),
            quotaMet: s.bankroll >= nextFloorData.quotaTarget,
          }
        }),

      dismissFloorComplete: () => set({
        floorComplete: false,
        floorCompleteReason: null,
      }),

      finishQuotaEarly: () =>
        set((s) => {
          if (s.floorComplete || s.runDefeated || s.bankroll < s.quotaTarget) return s
          return {
            floorComplete: true,
            floorCompleteReason: 'early' as const,
          }
        }),

      queueDefeat: (reason: DefeatReason) =>
        set({ pendingDefeatReason: reason }),

      confirmPendingDefeat: () =>
        set((s) => {
          if (!s.pendingDefeatReason) return s
          return {
            runDefeated: true,
            defeatReason: s.pendingDefeatReason,
            pendingDefeatReason: null,
          }
        }),

      setRunDefeated: (reason: DefeatReason) =>
        set({
          runDefeated: true,
          defeatReason: reason,
          pendingDefeatReason: null,
        }),

      confirmDefeat: () => {
        get().endRun({ victory: false, exiting: true })
      },

      clearLastRun: () => set({ lastRun: null }),

      setMissions: (missions) => set({ missions }),

      applyMissionResults: (updatedMissions) =>
        set((s) => {
          const newlyCompleted = updatedMissions.filter(
            (m) => m.completed && !s.missions.find((prev) => prev.id === m.id)?.completed,
          )
          return {
            missions: updatedMissions,
            completedMissionIds: [
              ...s.completedMissionIds,
              ...newlyCompleted.map((m) => m.id),
            ],
          }
        }),

      purchaseUpgrade: (id, price, slotIndex) => {
        const s = get()
        if (s.sparks < price) return false
        const item = getCatalogItem(id)
        if (!item || item.scope === 'consumable') return false
        if (!canPurchaseUpgrade(id, s.purchasedUpgrades)) return false

        const withoutFamily =
          item.familyId != null
            ? s.purchasedUpgrades.filter((u) => {
                const existing = getCatalogItem(normalizeUpgradeId(u.id))
                return existing?.familyId !== item.familyId
              })
            : s.purchasedUpgrades.filter((u) => normalizeUpgradeId(u.id) !== id)

        set({
          sparks: s.sparks - price,
          shopPurchaseCount: s.shopPurchaseCount + 1,
          shopPurchasedSlotIndices: [...s.shopPurchasedSlotIndices, slotIndex],
          purchasedUpgrades: [
            ...withoutFamily,
            { id, purchasedAt: new Date().toISOString() },
          ],
        })
        return true
      },

      purchaseLobbyRerollTicket: () => {
        const s = get()
        if (!s.runActive || !s.difficulty) return false
        const price = calcShopPrice(LOBBY_REROLL_TICKET.baseCost, s.difficulty)
        if (s.sparks < price) return false
        const existing = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
        set({
          sparks: s.sparks - price,
          inventory: existing
            ? s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count + 1 } : i,
              )
            : [...s.inventory, { id: LOBBY_REROLL_TICKET_ID, count: 1 }],
        })
        return true
      },

      rerollLobbyGame: (slotIndex) => {
        const s = get()
        if (!s.runActive || !s.runSeed) return false
        const stack = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
        if (!stack || stack.count <= 0) return false
        const nextRollSeq = s.shopTicketRollSeq + 1
        const replacement = pickLobbyGameReroll({
          runSeed: s.runSeed,
          floor: s.currentFloor,
          slotIndex,
          rollSeq: nextRollSeq,
          floorGames: s.floorGames,
          pool: SURVIVAL_GAME_POOL,
          offeredGames: s.lobbyGamesOffered,
        })
        if (!replacement) return false

        const nextGames = applyLobbyGameReroll(s.floorGames, slotIndex, replacement)
        const nextOffered = [...new Set([...s.lobbyGamesOffered, replacement])]

        const nextInventory =
          stack.count <= 1
            ? s.inventory.filter((i) => i.id !== LOBBY_REROLL_TICKET_ID)
            : s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count - 1 } : i,
              )

        set({
          floorGames: nextGames,
          inventory: nextInventory,
          lobbyGamesOffered: nextOffered,
          shopTicketRollSeq: nextRollSeq,
        })
        return true
      },

      rerollShopOfferWithTicket: (slotIndex) => {
        const s = get()
        if (!s.runActive || !s.runSeed || !s.difficulty) return false
        const stack = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
        if (!stack || stack.count <= 0) return false
        if (slotIndex < 0 || slotIndex >= EMPTY_SHOP_SLOT_ITEM_IDS.length) return false
        if (s.shopPurchasedSlotIndices.includes(slotIndex)) return false

        const ownedIds = s.purchasedUpgrades.map((u) => u.id)
        const pools = getShopPools(s.floorGames, ownedIds)
        const slotItemIds = [...s.shopSlotItemIds]
        while (slotItemIds.length < EMPTY_SHOP_SLOT_ITEM_IDS.length) slotItemIds.push(null)

        const nextRollSeq = s.shopTicketRollSeq + 1
        const pickedId = pickRerollForShopSlot({
          runSeed: s.runSeed,
          floor: s.currentFloor,
          slotIndex,
          rollSeq: nextRollSeq,
          slotItemIds,
          pools,
          offeredIds: s.shopOfferedIds,
        })
        if (!pickedId) return false

        slotItemIds[slotIndex] = pickedId
        const kind = shopPoolKindForSlot(slotIndex)
        const nextOfferedIds = addOfferedId(s.shopOfferedIds, kind, pickedId)

        const nextInventory =
          stack.count <= 1
            ? s.inventory.filter((i) => i.id !== LOBBY_REROLL_TICKET_ID)
            : s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count - 1 } : i,
              )

        set({
          inventory: nextInventory,
          shopSlotItemIds: slotItemIds,
          shopOfferedIds: nextOfferedIds,
          shopTicketRollSeq: nextRollSeq,
        })
        return true
      },

      rerollShop: () => {
        const s = get()
        if (!s.runActive || !s.difficulty || !s.runSeed) return false
        const cost = calcShopRerollCost(s.shopRerollCount, s.difficulty)
        if (s.sparks < cost) return false
        const nextRerollCount = s.shopRerollCount + 1
        set({
          sparks: s.sparks - cost,
          shopRerollCount: nextRerollCount,
          ...initFloorTicketRerollState({
            runSeed: s.runSeed,
            floor: s.currentFloor,
            rerollCount: nextRerollCount,
            floorGames: s.floorGames,
            ownedUpgradeIds: s.purchasedUpgrades.map((u) => u.id),
            missions: s.missions,
          }),
        })
        return true
      },

      rerollMissions: () => {
        const s = get()
        if (!s.runActive || !s.runSeed || !s.difficulty) return false
        if (!canRerollMissions(s.missions)) return false
        const cost = calcMissionRerollCost(s.missionRerollCount, s.difficulty)
        if (s.sparks < cost) return false
        const nextCount = s.missionRerollCount + 1
        const missions = generateMissionsForFloor(
          s.runSeed,
          s.currentFloor,
          s.difficulty,
          s.floorGames,
          s.floorMinBet,
          nextCount,
        )
        set({
          sparks: s.sparks - cost,
          missionRerollCount: nextCount,
          missions,
          missionOfferedKeys: missionOfferedKeysFromMissions(missions),
          missionTicketRerolledSlots: [],
        })
        return true
      },

      rerollMissionsWithTicket: () => {
        const s = get()
        if (!s.runActive || !s.runSeed || !s.difficulty) return false
        const stack = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
        if (!stack || stack.count <= 0) return false
        if (!canRerollMissions(s.missions)) return false

        const nextInventory =
          stack.count <= 1
            ? s.inventory.filter((i) => i.id !== LOBBY_REROLL_TICKET_ID)
            : s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count - 1 } : i,
              )

        const nextCount = s.missionRerollCount + 1
        const missions = generateMissionsForFloor(
          s.runSeed,
          s.currentFloor,
          s.difficulty,
          s.floorGames,
          s.floorMinBet,
          nextCount,
        )

        set({
          inventory: nextInventory,
          missionRerollCount: nextCount,
          missions,
          missionOfferedKeys: missionOfferedKeysFromMissions(missions),
          missionTicketRerolledSlots: [],
        })
        return true
      },

      // Reroll a single mission by replacing only the indexed mission with the next seeded set's slot.
      rerollMission: (index: number) => {
        const s = get()
        if (!s.runActive || !s.runSeed || !s.difficulty) return false
        if (index < 0 || index >= s.missions.length) return false
        const m = s.missions[index]
        if (!m || !canRerollMission(m)) return false
        const cost = calcMissionRerollCost(s.missionRerollCount, s.difficulty)
        if (s.sparks < cost) return false
        const nextCount = s.missionRerollCount + 1
        const newSet = generateMissionsForFloor(
          s.runSeed,
          s.currentFloor,
          s.difficulty,
          s.floorGames,
          s.floorMinBet,
          nextCount,
          { index, type: m.type as MissionType, target: m.target },
        )
        const nextMissions = [...s.missions]
        const replacement = newSet[index]
        if (replacement) nextMissions[index] = replacement
        const nextOfferedKeys = replacement
          ? [...new Set([...s.missionOfferedKeys, missionOfferKey(replacement)])]
          : s.missionOfferedKeys
        set({
          sparks: s.sparks - cost,
          missionRerollCount: nextCount,
          missions: nextMissions,
          missionOfferedKeys: nextOfferedKeys,
        })
        return true
      },

      rerollMissionWithTicket: (index: number) => {
        const s = get()
        if (!s.runActive || !s.runSeed || !s.difficulty) return false
        const stack = s.inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)
        if (!stack || stack.count <= 0) return false
        if (index < 0 || index >= s.missions.length) return false
        if (s.missionTicketRerolledSlots.includes(index)) return false
        const m = s.missions[index]
        if (!m || !canRerollMission(m)) return false

        const nextRollSeq = s.shopTicketRollSeq + 1
        const replacement = pickMissionRerollForSlot({
          runSeed: s.runSeed,
          floor: s.currentFloor,
          slotIndex: index,
          rollSeq: nextRollSeq,
          difficulty: s.difficulty,
          floorGames: s.floorGames,
          floorMinBet: s.floorMinBet,
          offeredKeys: s.missionOfferedKeys,
        })
        if (!replacement) return false

        const nextMissions = [...s.missions]
        nextMissions[index] = replacement
        const nextOfferedKeys = [...new Set([...s.missionOfferedKeys, missionOfferKey(replacement)])]

        const nextInventory =
          stack.count <= 1
            ? s.inventory.filter((i) => i.id !== LOBBY_REROLL_TICKET_ID)
            : s.inventory.map((i) =>
                i.id === LOBBY_REROLL_TICKET_ID ? { ...i, count: i.count - 1 } : i,
              )

        set({
          inventory: nextInventory,
          missions: nextMissions,
          missionOfferedKeys: nextOfferedKeys,
          missionTicketRerolledSlots: [...s.missionTicketRerolledSlots, index],
          shopTicketRollSeq: nextRollSeq,
        })
        return true
      },

      appendFloorHistory: (record: FloorRecord) =>
        set((s) => ({ floorHistory: [...s.floorHistory, record] })),

      recordResult: (result: GameResult) =>
        set((s) => {
          if (s.floorComplete || s.runDefeated || s.pendingDefeatReason) return s
          const newBankroll = s.bankroll - result.betAmount + result.payout
          const quotaMet = s.quotaMet || newBankroll >= s.quotaTarget
          const nextBetsPlaced = s.floorBetsPlaced + 1
          const base = {
            gamesPlayed: s.gamesPlayed + 1,
            streak: result.outcome === 'win' ? s.streak + 1 : 0,
            history: [...s.history, result],
            bankroll: newBankroll,
            peakBankroll: Math.max(s.peakBankroll, newBankroll),
            quotaMet,
            floorBetsPlaced: nextBetsPlaced,
          }
          if (!useSettingsStore.getState().devInfiniteBets && nextBetsPlaced >= FLOOR_BET_LIMIT) {
            if (newBankroll >= s.quotaTarget) {
              return { ...base, floorComplete: true, floorCompleteReason: 'bet-limit' as const }
            }
            return { ...base, pendingDefeatReason: 'quota' as DefeatReason }
          }
          return base
        }),

      recordResultPayout: (result: GameResult, options?: { settleFloorBet?: boolean; bankrollDelta?: number }) =>
        set((s) => {
          if (s.floorComplete || s.runDefeated || s.pendingDefeatReason) return s
          const settleFloorBet = options?.settleFloorBet !== false
          const credit = options?.bankrollDelta ?? result.payout
          const newBankroll = s.bankroll + credit
          const quotaMet = s.quotaMet || newBankroll >= s.quotaTarget
          const streak = settleFloorBet
            ? result.outcome === 'win'
              ? s.streak + 1
              : result.outcome === 'loss'
                ? 0
                : s.streak
            : s.streak
          const nextBetsPlaced = settleFloorBet ? s.floorBetsPlaced + 1 : s.floorBetsPlaced
          const base = {
            gamesPlayed: settleFloorBet ? s.gamesPlayed + 1 : s.gamesPlayed,
            streak,
            history: settleFloorBet ? [...s.history, result] : s.history,
            bankroll: newBankroll,
            peakBankroll: Math.max(s.peakBankroll, newBankroll),
            quotaMet,
            floorBetsPlaced: nextBetsPlaced,
          }
          if (settleFloorBet && nextBetsPlaced >= FLOOR_BET_LIMIT) {
            if (newBankroll >= s.quotaTarget) {
              return { ...base, floorComplete: true, floorCompleteReason: 'bet-limit' as const }
            }
            return { ...base, pendingDefeatReason: 'quota' as DefeatReason }
          }
          return base
        }),

      deductBet: (amount: number) =>
        set((s) => ({ bankroll: s.bankroll - amount })),

      setCursed: (val: boolean) => set({ cursed: val }),
      setBlessed: (val: boolean) => set({ blessed: val }),
    }),
    {
      name: 'floored-survival',
      version: 5,
      migrate: (persistedState: unknown, fromVersion: number): unknown =>
        migratePersistedState(persistedState, fromVersion),
      partialize: (state) => {
        const partial: Record<string, unknown> = {}
        for (const key of RUN_PERSIST_KEYS) {
          partial[key] = state[key as keyof typeof state]
        }
        return partial
      },
    },
  ),
)
