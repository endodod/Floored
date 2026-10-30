'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { MIN_BUY_IN, TABLES_START_WALLET, TIER_BY_ID } from '@/lib/tables/stakes'
import type { CashStakeId, TableFormat, TableGameName, TableTier } from '@/lib/tables/types'

/** The table you bought into. Leaving it before your place is decided forfeits the buy-in. */
export interface OpenTable {
  id: string
  game: TableGameName
  tier: TableTier
  buyIn: number
  seats: number
  seed: number
  startedAt: string
  /** Set once the table page has dealt it — a second visit means the table was left. */
  seated: boolean
  format: TableFormat
  /** Cash-only fields; tournament tables leave these undefined. */
  stake?: CashStakeId
  broughtIn?: number
  stack?: number
  hands?: number
}

export interface TableRecord {
  id: string
  game: TableGameName
  tier: TableTier
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

export interface CashSessionRecord {
  id: string
  game: TableGameName
  stake: CashStakeId
  broughtIn: number
  cashedOut: number
  hands: number
  endedAt: string
}
export interface CashGameStats {
  sessions: number
  hands: number
  net: number
  bestSession: number | null
  worstSession: number | null
}

const emptyStats = (): TableGameStats => ({ played: 0, won: 0, cashes: 0, bestFinish: null, net: 0 })
const emptyCashStats = (): CashGameStats => ({ sessions: 0, hands: 0, net: 0, bestSession: null, worstSession: null })

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
  cashStats: Record<TableGameName, CashGameStats>
  cashHistory: CashSessionRecord[]
  lastCashResult: CashSessionRecord | null

  /** Pays the buy-in and opens a table; false if the wallet can't cover it or a table is open. */
  sitDown: (game: TableGameName, tier: TableTier, seats: number) => boolean
  sitDownCash: (game: TableGameName, stake: CashStakeId, amount: number, seats: number) => boolean
  syncCashStack: (stack: number, hands: number) => void
  topUp: (amount: number) => boolean
  cashOut: () => void
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
  dismissCashResult: () => void
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
        cashStats: { holdem: emptyCashStats(), 'liars-dice': emptyCashStats(), 'blackjack-showdown': emptyCashStats() },
        cashHistory: [],
        lastCashResult: null,

        sitDown: (game, tier, seats) => {
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
              buyIn,
              seats,
              seed: Math.floor(Math.random() * 2 ** 31),
              startedAt: new Date().toISOString(),
              seated: false,
              format: 'tournament',
            },
          })
          return true
        },
        sitDownCash: (game, stake, amount, seats) => {
          const s = get()
          const buyIn = Math.floor(amount)
          if (s.open || buyIn < 1 || buyIn > s.wallet) return false
          set({
            wallet: s.wallet - buyIn,
            lastCashResult: null,
            open: {
              id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
              game, tier: 'rookie', buyIn: 0, seats, seed: Math.floor(Math.random() * 2 ** 31), startedAt: new Date().toISOString(), seated: false,
              format: 'cash', stake, broughtIn: buyIn, stack: buyIn, hands: 0,
            },
          })
          return true
        },
        syncCashStack: (stack, hands) => set((s) => s.open?.format === 'cash' ? { open: { ...s.open, stack: Math.max(0, Math.floor(stack)), hands: Math.max(0, Math.floor(hands)) } } : {}),
        topUp: (amount) => {
          const s = get(), open = s.open, chips = Math.floor(amount)
          if (!open || open.format !== 'cash' || chips < 1 || chips > s.wallet) return false
          set({ wallet: s.wallet - chips, open: { ...open, broughtIn: (open.broughtIn ?? 0) + chips, stack: (open.stack ?? 0) + chips } })
          return true
        },
        cashOut: () => {
          const open = get().open
          if (!open || open.format !== 'cash') return
          const cashedOut = Math.max(0, open.stack ?? 0), broughtIn = open.broughtIn ?? 0
          const record: CashSessionRecord = { id: open.id, game: open.game, stake: open.stake ?? 'low', broughtIn, cashedOut, hands: open.hands ?? 0, endedAt: new Date().toISOString() }
          set((s) => {
            const stats = s.cashStats[open.game] ?? emptyCashStats(), net = cashedOut - broughtIn
            return { open: null, wallet: s.wallet + cashedOut, peakWallet: Math.max(s.peakWallet, s.wallet + cashedOut), lastCashResult: record, cashHistory: [record, ...s.cashHistory].slice(0, HISTORY_LIMIT), cashStats: { ...s.cashStats, [open.game]: { sessions: stats.sessions + 1, hands: stats.hands + record.hands, net: stats.net + net, bestSession: stats.bestSession == null ? net : Math.max(stats.bestSession, net), worstSession: stats.worstSession == null ? net : Math.min(stats.worstSession, net) } } }
          })
        },
        markSeated: () => set((s) => (s.open ? { open: { ...s.open, seated: true } } : {})),
        finish: (place, prize) => close(place, prize, false),
        forfeit: () => {
          const open = get().open
          if (open) close(open.seats, 0, true)
        },
        cancelUnseated: () =>
          set((s) => s.open && !s.open.seated ? s.open.format === 'cash' ? { open: null, wallet: s.wallet + (s.open.stack ?? 0) } : { open: null, wallet: s.wallet + s.open.buyIn } : {}),
        refill: () => {
          const s = get()
          if (s.open || s.wallet >= MIN_BUY_IN) return false
          set({ wallet: TABLES_START_WALLET, peakWallet: Math.max(s.peakWallet, TABLES_START_WALLET), refills: s.refills + 1 })
          return true
        },
        dismissResult: () => set({ lastResult: null }),
        dismissCashResult: () => set({ lastCashResult: null }),
      }
    },
    {
      name: 'floored-tables',
      merge: (persisted, current) => {
        const saved = persisted as Partial<TablesStore>
        const restored = { ...current, ...saved, open: saved.open ? { ...saved.open, format: saved.open.format ?? 'tournament' } : null }
        return { ...restored, cashStats: saved.cashStats ?? current.cashStats, cashHistory: saved.cashHistory ?? [], lastCashResult: saved.lastCashResult ?? null, peakWallet: Math.max(restored.peakWallet, restored.wallet) }
      },
    },
  ),
)
