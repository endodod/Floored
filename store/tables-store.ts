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

type TableKey = 'blackjack-showdown'|'liars-dice'|'holdem'
export interface TableGameRecord { played:number; wins:number; bestFinish:number|null; net:number }
type TableGameRecords = Record<TableKey,TableGameRecord>
const emptyRecords = ():TableGameRecords => ({
  'blackjack-showdown':{played:0,wins:0,bestFinish:null,net:0},
  'liars-dice':{played:0,wins:0,bestFinish:null,net:0},
  holdem:{played:0,wins:0,bestFinish:null,net:0},
})
function recordResult(records:TableGameRecords,game:TableKey,buyIn:number,payout:number,place:number):TableGameRecords {
  const previous=records[game]
  return {...records,[game]:{played:previous.played+1,wins:previous.wins+(place===1?1:0),bestFinish:previous.bestFinish===null?place:Math.min(previous.bestFinish,place),net:previous.net+payout-buyIn}}
}

interface TablesStore {
  wallet: number
  peakWallet:number
  walletResetCount:number
  gameStats:TableGameRecords
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
  settleMini: (game: 'liars-dice'|'holdem', payout: number, place:number) => void
  setHoldemTable: (table:HoldemState|null)=>void
  setLiarsTable: (table:LiarsState)=>void
}

export const useTablesStore = create<TablesStore>()(persist((set, get) => ({
  wallet: 10_000, peakWallet:10_000, walletResetCount:0, gameStats:emptyRecords(), table: null, buyIn: 100, played: 0, won: 0, activeGame: null, holdemTable:null, liarsTable:null,
  refill: () => set(s => ({ wallet: 10_000, peakWallet:Math.max(s.peakWallet,10_000), walletResetCount:s.walletResetCount+1 })),
  start: (buyIn) => {
    const wallet = get().wallet
    if (buyIn > wallet || get().activeGame) return
    const table = createBlackjackShowdown(createRng(Date.now() >>> 0))
    set({ wallet: wallet - buyIn, table, buyIn, activeGame: 'blackjack-showdown' })
  },
  setTable: (table) => set({ table }),
  finish: (table) => {
    if (table.phase !== 'finished') return
    const won = table.winner === 0
    set((s) => {
      if(s.table?.phase==='finished')return {}
      const payout=won?s.buyIn*4:0,place=1+table.players.filter((p,i)=>i!==0&&p.chips>table.players[0]!.chips).length,wallet=s.wallet+payout
      return {table,activeGame:null,wallet,peakWallet:Math.max(s.peakWallet,wallet),played:s.played+1,won:s.won+(won?1:0),gameStats:recordResult(s.gameStats,'blackjack-showdown',s.buyIn,payout,place)}
    })
  },
  leave: () => set(s => {
    if (!s.activeGame) return { table: null, activeGame: null, holdemTable:null, liarsTable:null }
    const place=s.activeGame==='holdem'?6:4
    return { table: null, activeGame: null, holdemTable:null, liarsTable:null, played:s.played+1, gameStats:recordResult(s.gameStats,s.activeGame,s.buyIn,0,place) }
  }),
  reserve: (game, buyIn) => { const s=get(); if(s.wallet<buyIn||s.activeGame)return false; const rng=createRng(Date.now()>>>0); set({wallet:s.wallet-buyIn,buyIn,activeGame:game,...(game==='holdem'?{holdemTable:startHand(createTable(),rng)}:{liarsTable:startGame(rng)})}); return true },
  settleMini: (game,payout,place) => set(s=>s.activeGame!==game?{}:(()=>{const wallet=s.wallet+payout;return {activeGame:null,wallet,peakWallet:Math.max(s.peakWallet,wallet),played:s.played+1,won:s.won+(place===1?1:0),gameStats:recordResult(s.gameStats,game,s.buyIn,payout,place)}})()),
  setHoldemTable: (holdemTable)=>set({holdemTable}),
  setLiarsTable: (liarsTable)=>set({liarsTable}),
}), { name: 'floored-tables', partialize: (s) => ({ wallet: s.wallet, peakWallet:s.peakWallet,walletResetCount:s.walletResetCount,gameStats:s.gameStats,table: s.table, buyIn: s.buyIn, played: s.played, won: s.won, activeGame:s.activeGame,holdemTable:s.holdemTable,liarsTable:s.liarsTable }) }))
