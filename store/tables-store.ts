'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MIN_BUY_IN, TABLES_START_WALLET, TIER_BY_ID } from '@/lib/tables/stakes'
import type { TableDifficulty, TableGameName, TableTier } from '@/lib/tables/types'

/** The table you bought into. Leaving it before your place is decided forfeits the buy-in. */
export interface OpenTable {
  id: string
  game: TableGameName
  tier: TableTier
  botSkill: TableDifficulty
  buyIn: number
  seats: number
  seed: number
  startedAt: string
  /** Set once the table page has dealt it — a second visit means the table was left. */
  seated: boolean
}

export interface TableRecord {
  id: string
  game: TableGameName
  tier: TableTier
  botSkill?: TableDifficulty
  buyIn: number
  seats: number
  place: number
  prize: number
  forfeited: boolean
  endedAt: string
}

export interface TableGameStats {
  played: number
  won: number
  /** Finished in a paid place. */
  cashes: number
  bestFinish: number | null
  /** Prizes minus buy-ins. */
  net: number
}

const emptyStats = (): TableGameStats => ({ played: 0, won: 0, cashes: 0, bestFinish: null, net: 0 })

interface TablesStore {
  wallet: number
  peakWallet: number
  refills: number
  open: OpenTable | null
  stats: Record<TableGameName, TableGameStats>
  /** Finished tables, newest first. */
  history: TableRecord[]
  /** The last table's result, shown once on the hub. */
  lastResult: TableRecord | null

  /** Pays the buy-in and opens a table; false if the wallet can't cover it or a table is open. */
  sitDown: (game: TableGameName, tier: TableTier, botSkill: TableDifficulty, seats: number) => boolean
  markSeated: () => void
  /** Your place is decided: pays the prize and closes the table. */
  finish: (place: number, prize: number) => void
  /** Leaving before your place is decided: last place, no prize. */
  forfeit: () => void
  /** A table bought into but never dealt (the page didn't open): the buy-in comes back. */
  cancelUnseated: () => void
  /** Back to the start amount, only when the wallet can't cover the smallest buy-in. */
  refill: () => boolean
  dismissResult: () => void
}

const HISTORY_LIMIT = 40

export const useTablesStore = create<TablesStore>()(
  persist(
    (set, get) => {
      const close = (place: number, prize: number, forfeited: boolean) => {
        const open = get().open
        if (!open) return
        const record: TableRecord = {
          id: open.id,
          game: open.game,
          tier: open.tier,
          botSkill: open.botSkill,
          buyIn: open.buyIn,
          seats: open.seats,
          place,
          prize,
          forfeited,
          endedAt: new Date().toISOString(),
        }
        set((s) => {
          const prev = s.stats[open.game] ?? emptyStats()
          return {
            open: null,
            wallet: s.wallet + prize,
            peakWallet: Math.max(s.peakWallet, s.wallet + prize),
            lastResult: record,
            history: [record, ...s.history].slice(0, HISTORY_LIMIT),
            stats: {
              ...s.stats,
              [open.game]: {
                played: prev.played + 1,
                won: prev.won + (place === 1 ? 1 : 0),
                cashes: prev.cashes + (prize > 0 ? 1 : 0),
                bestFinish: prev.bestFinish == null ? place : Math.min(prev.bestFinish, place),
                net: prev.net + prize - open.buyIn,
              },
            },
          }
        })
      }

      return {
        wallet: TABLES_START_WALLET,
        peakWallet: TABLES_START_WALLET,
        refills: 0,
        open: null,
        stats: { holdem: emptyStats(), 'liars-dice': emptyStats(), 'blackjack-showdown': emptyStats() },
        history: [],
        lastResult: null,

        sitDown: (game, tier, botSkill, seats) => {
          const s = get()
          const buyIn = TIER_BY_ID.get(tier)!.buyIn
          if (s.open || s.wallet < buyIn) return false
          set({
            wallet: s.wallet - buyIn,
            lastResult: null,
            open: {
              id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
              game,
              tier,
              botSkill,
              buyIn,
              seats,
              seed: Math.floor(Math.random() * 2 ** 31),
              startedAt: new Date().toISOString(),
              seated: false,
            },
          })
          return true
        },
        markSeated: () => set((s) => (s.open ? { open: { ...s.open, seated: true } } : {})),
        finish: (place, prize) => close(place, prize, false),
        forfeit: () => {
          const open = get().open
          if (open) close(open.seats, 0, true)
        },
        cancelUnseated: () =>
          set((s) => (s.open && !s.open.seated ? { open: null, wallet: s.wallet + s.open.buyIn } : {})),
        refill: () => {
          const s = get()
          if (s.open || s.wallet >= MIN_BUY_IN) return false
          set({ wallet: TABLES_START_WALLET, peakWallet: Math.max(s.peakWallet, TABLES_START_WALLET), refills: s.refills + 1 })
          return true
        },
        dismissResult: () => set({ lastResult: null }),
      }
    },
    {
      name: 'floored-tables',
      merge: (persisted, current) => {
        const restored = { ...current, ...(persisted as Partial<TablesStore>) }
        return { ...restored, peakWallet: Math.max(restored.peakWallet, restored.wallet) }
      },
    },
  ),
)
