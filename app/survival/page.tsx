'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'
import { RunSummary } from '@/components/run-summary'
import { FloorCompleteModal } from '@/components/survival/floor-complete-modal'
import { SurvivalDefeatModal } from '@/components/survival/survival-defeat-modal'
import { MissionPanel } from '@/components/survival/mission-panel'
import { SurvivalShop } from '@/components/survival/survival-shop'
import { DifficultyDialog } from '@/components/difficulty-dialog'
import { Button } from '@/components/ui/button'
import { calcShopPrice } from '@/lib/survival/balance'
import {
  getLobbyTicketCount,
  LOBBY_REROLL_TICKET,
} from '@/lib/survival/lobby-ticket'

export default function SurvivalPage() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const runEndedByExit = useSurvivalStore((s) => s.runEndedByExit)
  const lastRun = useSurvivalStore((s) => s.lastRun)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)
  const sparks = useSurvivalStore((s) => s.sparks)
  const difficulty = useSurvivalStore((s) => s.difficulty)
  const inventory = useSurvivalStore((s) => s.inventory)
  const purchaseLobbyRerollTicket = useSurvivalStore((s) => s.purchaseLobbyRerollTicket)

  const [difficultyOpen, setDifficultyOpen] = useState(!runActive)
  const [mobileTab, setMobileTab] = useState<'games' | 'shop'>('games')

  function handleDifficultyClose() {
    setDifficultyOpen(false)
    if (!useSurvivalStore.getState().runActive) router.replace('/')
  }

  if (!runActive) {
    // Defeat/abandon route straight home — don't flash the difficulty picker or
    // run summary here while that navigation is in flight.
    if (runEndedByExit) return null
    return (
      <>
        <DifficultyDialog open={difficultyOpen} onClose={handleDifficultyClose} />
        {lastRun && <RunSummary lastRun={lastRun} />}
      </>
    )
  }

  const ticketCount = getLobbyTicketCount(inventory)
  const ticketPrice = difficulty ? calcShopPrice(LOBBY_REROLL_TICKET.baseCost, difficulty) : 0
  const canBuyTicket = difficulty != null && sparks >= ticketPrice
  const showHubPanels = !floorComplete && !runDefeated

  return (
    <>
      <FloorCompleteModal />
      <SurvivalDefeatModal />
      <div className="flex flex-col gap-3">
        <FloorPanel />

        {showHubPanels && (
          <div className="sm:hidden flex gap-1 rounded-xl bg-zinc-900/60 border border-zinc-800 p-1">
            <button
              type="button"
              onClick={() => setMobileTab('games')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                mobileTab === 'games' ? 'bg-amber-900/40 text-amber-300' : 'text-white/50 hover:text-white/80'
              }`}
            >
              Games
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('shop')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                mobileTab === 'shop' ? 'bg-amber-900/40 text-amber-300' : 'text-white/50 hover:text-white/80'
              }`}
            >
              Shop
            </button>
          </div>
        )}

        <div className={showHubPanels ? `${mobileTab === 'games' ? 'block' : 'hidden'} sm:block` : ''}>
          <Lobby mode="survival" />
        </div>

        {showHubPanels && (
          <div className={`${mobileTab === 'shop' ? 'flex' : 'hidden'} sm:flex flex-col gap-3`}>
            {/* Lobby reroll ticket buy — above the shop */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span aria-hidden className="text-sm leading-none shrink-0">🎟️</span>
                  <p className="text-sm font-bold text-zinc-200 tabular-nums truncate">
                    Lobby Reroll Tickets: {ticketCount}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canBuyTicket}
                  className="h-8 border-zinc-700 text-xs shrink-0"
                  onClick={() => purchaseLobbyRerollTicket()}
                >
                  Buy ticket
                  <span className="ml-1 font-bold text-amber-400 tabular-nums">✦ {ticketPrice}</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2">
                <SurvivalShop />
              </div>
              <div className="lg:col-span-1">
                <MissionPanel />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
