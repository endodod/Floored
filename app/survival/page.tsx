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
import { SectionTitle } from '@/components/ui/terminal'
import { calcShopPrice } from '@/lib/survival/balance'
import { getLobbyTicketCount, LOBBY_REROLL_TICKET } from '@/lib/survival/lobby-ticket'

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
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      <FloorPanel />
      <FloorCompletePanel />
      <SurvivalDefeatPanel />

      {showHubPanels && (
        <div className="flex gap-6 border-b border-line sm:hidden" role="tablist">
          {(['games', 'shop'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab}
              data-active={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={`mark-line h-10 text-[13px] font-medium capitalize ${mobileTab === tab ? 'text-ink' : 'text-dim'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {showHubPanels && (
        <section className={`${mobileTab === 'games' ? 'flex' : 'hidden'} flex-col gap-4 sm:flex`} aria-labelledby="floor-games">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle suit={0}>
              <span id="floor-games">This floor&apos;s games</span>
            </SectionTitle>
            <div className="flex items-center gap-3">
              <p className="text-[13px] text-dim">
                <span className="num text-ink">{ticketCount}</span> reroll ticket{ticketCount === 1 ? '' : 's'}
              </p>
              <Button size="sm" variant="outline" disabled={!canBuyTicket} onClick={() => purchaseLobbyRerollTicket()}>
                Buy one for <span className="num text-gold">{ticketPrice}</span> sparks
              </Button>
            </div>
          </div>
          <Lobby mode="survival" />
        </section>
      )}

      {showHubPanels && (
        <div className={`${mobileTab === 'shop' ? 'grid' : 'hidden'} grid-cols-1 items-start gap-3 sm:grid lg:grid-cols-3 rise [--d:500ms]`}>
          <div className="lg:col-span-2">
            <SurvivalShop />
          </div>
          <div className="lg:col-span-1">
            <MissionPanel />
          </div>
        </div>
      )}
    </div>
  )
}
