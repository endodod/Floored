'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createBlackjackShowdown } from '@/games/blackjack-showdown/engine'
import type { ShowdownState } from '@/games/blackjack-showdown/types'
import { createRng } from '@/utils/rng'
import { createTable, startHand } from '@/games/holdem/engine'
import type { State as HoldemState } from '@/games/holdem/types'
import { startGame } from '@/games/liars-dice/engine'
import type { State as LiarsState } from '@/games/liars-dice/types'

interface TablesStore {
  wallet: number
  table: ShowdownState | null
  buyIn: number
  played: number
  won: number
  activeGame: 'blackjack-showdown'|'liars-dice'|'holdem'|null
  holdemTable: HoldemState|null
  liarsTable: LiarsState|null
  refill: () => void
  start: (buyIn: number) => void
  setTable: (table: ShowdownState) => void
  finish: (table: ShowdownState) => void
  leave: () => void
  reserve: (game: 'liars-dice'|'holdem', buyIn: number) => boolean
  settleMini: (game: 'liars-dice'|'holdem', payout: number) => void
  setHoldemTable: (table:HoldemState|null)=>void
  setLiarsTable: (table:LiarsState)=>void
}

export const useTablesStore = create<TablesStore>()(persist((set, get) => ({
  wallet: 10_000, table: null, buyIn: 100, played: 0, won: 0, activeGame: null, holdemTable:null, liarsTable:null,
  refill: () => set({ wallet: 10_000 }),
  start: (buyIn) => {
    const wallet = get().wallet
    if (buyIn > wallet) return
    const table = createBlackjackShowdown(createRng(Date.now() >>> 0))
    set({ wallet: wallet - buyIn, table, buyIn, activeGame: 'blackjack-showdown' })
  },
  setTable: (table) => set({ table }),
  finish: (table) => {
    if (table.phase !== 'finished') return
    const won = table.winner === 0
    set((s) => s.table?.phase === 'finished' ? {} : ({ table, activeGame: null, wallet: s.wallet + (won ? s.buyIn * 4 : 0), played: s.played + 1, won: s.won + (won ? 1 : 0) }))
  },
  leave: () => set({ table: null, activeGame: null, holdemTable:null, liarsTable:null }),
  reserve: (game, buyIn) => { const s=get(); if(s.wallet<buyIn||s.activeGame)return false; const rng=createRng(Date.now()>>>0); set({wallet:s.wallet-buyIn,buyIn,activeGame:game,...(game==='holdem'?{holdemTable:startHand(createTable(),rng)}:{liarsTable:startGame(rng)})}); return true },
  settleMini: (game,payout) => set(s=>s.activeGame!==game?{}:({activeGame:null,wallet:s.wallet+payout,played:s.played+1,won:s.won+(payout>0?1:0)})),
  setHoldemTable: (holdemTable)=>set({holdemTable}),
  setLiarsTable: (liarsTable)=>set({liarsTable}),
}), { name: 'floored-tables', partialize: (s) => ({ wallet: s.wallet, table: s.table, buyIn: s.buyIn, played: s.played, won: s.won, activeGame:s.activeGame,holdemTable:s.holdemTable,liarsTable:s.liarsTable }) }))
