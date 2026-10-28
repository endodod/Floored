'use client'

import { useEffect, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'
import { RunSummary } from '@/components/run-summary'
import { FloorCompletePanel } from '@/components/survival/floor-complete-panel'
import { SurvivalDefeatPanel } from '@/components/survival/survival-defeat-panel'
import { MissionPanel } from '@/components/survival/mission-panel'
import { SurvivalShop } from '@/components/survival/survival-shop'
import { Button } from '@/components/ui/button'
import { ModeTutorial, useTutorial, type TutorialStep } from '@/components/mode-tutorial'
import {
  calcQuotaTarget,
  calcShopPrice,
  FLOOR_BET_LIMIT,
  MAX_FLOORS,
  STARTING_BANKROLL,
} from '@/lib/survival/balance'
import { formatChips } from '@/utils/format'
import {
  getLobbyTicketCount,
  LOBBY_REROLL_TICKET,
} from '@/lib/survival/lobby-ticket'

const TUTORIAL: TutorialStep[] = [
  {
    icon: '🏢',
    title: `Clear ${MAX_FLOORS} floors`,
    body: (
      <>
        You start with {formatChips(STARTING_BANKROLL)}. Each floor sets a bankroll quota — floor 1 asks for{' '}
        {formatChips(calcQuotaTarget(1, 'normal'))}, floor {MAX_FLOORS} for {formatChips(calcQuotaTarget(MAX_FLOORS, 'normal'))}.
      </>
    ),
  },
  {
    icon: '🎯',
    title: `${FLOOR_BET_LIMIT} bets per floor`,
    body: 'Hit the quota before your bets run out. Once you reach it you can finish the floor early or keep betting to build a cushion.',
  },
  {
    icon: '🎰',
    title: 'A fresh lobby each floor',
    body: 'Every floor offers a handful of games. Spend a lobby reroll ticket to swap one you don\'t like.',
  },
  {
    icon: '✦',
    title: 'Sparks & the shop',
    body: 'Clearing floors, beating the quota and completing missions earn sparks. Spend them in the shop on run upgrades, game perks and items.',
  },
  {
    icon: '📋',
    title: 'Missions',
    body: 'Each floor comes with missions like winning streaks or big multipliers — finish them for bonus sparks.',
  },
  {
    icon: '💀',
    title: 'Game over',
    body: 'Going bust or running out of bets below the quota ends the run. You can also abandon a run at any time.',
  },
]

export default function SurvivalPage() {
  const runActive = useSurvivalStore((s) => s.runActive)
  const runEndedByExit = useSurvivalStore((s) => s.runEndedByExit)
  const lastRun = useSurvivalStore((s) => s.lastRun)
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)
  const pendingDefeatReason = useSurvivalStore((s) => s.pendingDefeatReason)
  const sparks = useSurvivalStore((s) => s.sparks)
  const difficulty = useSurvivalStore((s) => s.difficulty)
  const inventory = useSurvivalStore((s) => s.inventory)
  const purchaseLobbyRerollTicket = useSurvivalStore((s) => s.purchaseLobbyRerollTicket)

  const startRun = useSurvivalStore((s) => s.startRun)
  const [mobileTab, setMobileTab] = useState<'games' | 'shop'>('games')
  const tutorial = useTutorial('survival')

  // Difficulty picker is disabled for now — landing here without a run (and
  // without a summary to show) starts a Normal run straight away.
  const shouldAutoStart = !runActive && !runEndedByExit && !lastRun
  useEffect(() => {
    if (shouldAutoStart) startRun('normal')
  }, [shouldAutoStart, startRun])

  if (!runActive) {
    // Defeat/abandon route straight home — don't flash the run summary here
    // while that navigation is in flight.
    if (runEndedByExit) return null
    return lastRun ? <RunSummary lastRun={lastRun} /> : null
  }

  const ticketCount = getLobbyTicketCount(inventory)
  const ticketPrice = difficulty ? calcShopPrice(LOBBY_REROLL_TICKET.baseCost, difficulty) : 0
  const canBuyTicket = difficulty != null && sparks >= ticketPrice
  // Floor rewards and run-over panels take the place of the game picker and shop.
  const showHubPanels = !floorComplete && !runDefeated && pendingDefeatReason == null

  return (
    <div className="flex flex-col gap-3">
      <ModeTutorial
        id="survival"
        title="Survival"
        intro="A roguelike run across the casino floors — hit every quota to survive."
        steps={TUTORIAL}
        open={tutorial.open}
        onOpenChange={tutorial.setOpen}
        accent="text-amber-400"
      />
      <button
        type="button"
        onClick={() => tutorial.setOpen(true)}
        className="self-end text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
      >
        How to play
      </button>
      <FloorPanel />
      <FloorCompletePanel />
      <SurvivalDefeatPanel />

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

      {showHubPanels && (
        <div className={`${mobileTab === 'games' ? 'block' : 'hidden'} sm:block`}>
          <Lobby mode="survival" />
        </div>
      )}

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
  )
}
