'use client'

import { useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { FloorPanel } from '@/components/floor-panel'
import { Lobby } from '@/components/lobby'
import { RunSummary } from '@/components/run-summary'
import { FloorCompletePanel } from '@/components/survival/floor-complete-panel'
import { SurvivalDefeatPanel } from '@/components/survival/survival-defeat-panel'
import { MissionPanel } from '@/components/survival/mission-panel'
import { SurvivalShop } from '@/components/survival/survival-shop'
import { Button } from '@/components/ui/button'
import { PageTitle, SectionTitle } from '@/components/ui/terminal'
import { ModeTutorial, useTutorial, type TutorialStep } from '@/components/mode-tutorial'
import {
  calcQuotaTarget,
  calcShopPrice,
  FLOOR_BET_LIMIT,
  MAX_FLOORS,
  STARTING_BANKROLL,
  STARTING_REROLL_TICKETS,
  STARTING_SPARKS,
  SURVIVAL_GAME_POOL,
} from '@/lib/survival/balance'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { PayoutCaption } from '@/components/game-payout'
import { HowItWorks, ModeColumns, Rail, StartPanel } from '@/components/mode-intro'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { formatChips } from '@/utils/format'
import { getLobbyTicketCount, LOBBY_REROLL_TICKET } from '@/lib/survival/lobby-ticket'

const TUTORIAL: TutorialStep[] = [
  {
    title: `Clear ${MAX_FLOORS} floors`,
    body: (
      <>
        You start with {formatChips(STARTING_BANKROLL)}. Each floor sets a bankroll quota — floor 1 asks for{' '}
        {formatChips(calcQuotaTarget(1, 'normal'))}, floor {MAX_FLOORS} for {formatChips(calcQuotaTarget(MAX_FLOORS, 'normal'))}.
      </>
    ),
  },
  {
    title: `${FLOOR_BET_LIMIT} bets per floor`,
    body: 'Hit the quota before your bets run out. Once you reach it you can finish the floor early or keep betting to build a cushion.',
  },
  {
    title: 'A fresh lobby each floor',
    body: "Every floor offers a handful of games. Spend a lobby reroll ticket to swap one you don't like.",
  },
  {
    title: 'Sparks and the shop',
    body: 'Clearing floors, beating the quota and completing missions earn sparks. Spend them in the shop on run upgrades, game perks and items.',
  },
  {
    title: 'Missions',
    body: 'Each floor comes with missions like winning streaks or big multipliers — finish them for bonus sparks.',
  },
  {
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
  // The intro screen lays the rules out, so the dialog only opens from "How to play".
  const tutorial = useTutorial('survival', { auto: false })
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const endlessMode = useSurvivalStore((s) => s.endlessMode)
  const isMobile = useIsMobile()
  // Set once a run was live on this visit: a defeat or abandon then routes home, and the
  // intro must not flash up while that navigation is in flight.
  const wasActive = useRef(false)
  if (runActive) wasActive.current = true

  const modal = (
    <ModeTutorial
      id="survival"
      title="Survival"
      intro="A roguelike run across the casino floors — hit every quota to survive."
      steps={TUTORIAL}
      open={tutorial.open}
      onOpenChange={tutorial.setOpen}
    />
  )

  if (!runActive) {
    if (runEndedByExit && wasActive.current) return null
    if (lastRun) return <RunSummary lastRun={lastRun} />
    return (
      <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
        <PageTitle
          title="Survival"
          sub="A roguelike run across the casino floors — hit every quota to survive."
        />
        <ModeColumns
          rail={
            <Rail title="The floors" note="Normal" footer="Quotas are the bankroll you need to clear each floor.">
              <SurvivalFloors current={1} preview />
            </Rail>
          }
        >
          <StartPanel
            figures={[
              { label: 'Starting bankroll', value: formatChips(STARTING_BANKROLL) },
              { label: 'Floors', value: MAX_FLOORS },
              { label: 'Bets a floor', value: FLOOR_BET_LIMIT },
              { label: 'Sparks', value: STARTING_SPARKS },
              { label: 'Reroll tickets', value: STARTING_REROLL_TICKETS },
            ]}
            action={
              <Button size="lg" disabled={isMobile} onClick={() => startRun('normal')}>
                {isMobile ? 'Desktop only' : 'Start run'}
              </Button>
            }
          />
          <HowItWorks steps={TUTORIAL} />
          <section className="rise flex flex-col gap-3 [--d:220ms]" aria-labelledby="survival-pool">
            <SectionTitle suit={2} note="Each floor deals a handful of them">
              <span id="survival-pool">The game pool</span>
            </SectionTitle>
            <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
              {SURVIVAL_GAME_POOL.map((g) => (
                <li key={g} className="flex items-baseline justify-between gap-4 border-t border-rule py-2.5">
                  <span className="text-[13px] text-ink">{GAME_BY_NAME.get(g)?.label ?? g}</span>
                  <PayoutCaption game={g} />
                </li>
              ))}
            </ul>
          </section>
        </ModeColumns>
      </div>
    )
  }

  const ticketCount = getLobbyTicketCount(inventory)
  const ticketPrice = difficulty ? calcShopPrice(LOBBY_REROLL_TICKET.baseCost, difficulty) : 0
  const canBuyTicket = difficulty != null && sparks >= ticketPrice
  // Floor rewards and run-over panels take the place of the game picker and shop.
  const showHubPanels = !floorComplete && !runDefeated && pendingDefeatReason == null

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      {modal}
      <FloorPanel onHowToPlay={() => tutorial.setOpen(true)} />

      <ModeColumns
        rail={
          <>
            <Rail
              title="The floors"
              note={endlessMode ? 'Endless' : `Floor ${currentFloor} of ${MAX_FLOORS}`}
            >
              <SurvivalFloors current={currentFloor} />
            </Rail>
            {showHubPanels && (
              <div className="rise hidden sm:block [--d:240ms]">
                <MissionPanel />
              </div>
            )}
          </>
        }
      >
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
          <div className={`${mobileTab === 'shop' ? 'flex' : 'hidden'} rise flex-col gap-3 [--d:500ms] sm:flex`}>
            <SurvivalShop />
            <div className="sm:hidden">
              <MissionPanel />
            </div>
          </div>
        )}
      </ModeColumns>
    </div>
  )
}

/** The run's floors, top floor first: each floor's quota, cleared floors marked, the current one lit. */
function SurvivalFloors({ current, preview = false }: { current: number; preview?: boolean }) {
  const rows = Array.from({ length: MAX_FLOORS }, (_, i) => MAX_FLOORS - i)
  return (
    <ol aria-label="Floors, top floor first">
      {rows.map((n) => {
        const isCurrent = n === current
        const cleared = n < current
        return (
          <li
            key={n}
            aria-current={isCurrent ? 'step' : undefined}
            className={`relative flex h-9 items-center gap-3 text-[13px] ${
              isCurrent ? '-mx-4 bg-felt-tint px-4 shadow-[inset_2px_0_0_var(--felt)]' : ''
            }`}
          >
            <span className={`num w-5 text-right text-xs ${isCurrent ? 'text-felt glow-felt' : cleared ? 'text-soft' : 'text-dim'}`}>
              {n}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {isCurrent ? (
                <span className="mark-line text-ink" data-active="true">
                  {preview ? 'You start here' : 'You are here'}
                </span>
              ) : cleared ? (
                <span className="text-soft">Cleared</span>
              ) : n === MAX_FLOORS ? (
                <span className="text-dim">Victory</span>
              ) : null}
            </span>
            <span className={`num text-xs ${cleared ? 'text-felt' : isCurrent ? 'text-ink' : 'text-dim'}`}>
              {formatChips(calcQuotaTarget(n, 'normal'))}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
