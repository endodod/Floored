'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { useOpeningTicketActive } from '@/hooks/use-opening-ticket'
import { FLOOR_BET_LIMIT, MAX_FLOORS } from '@/lib/survival/balance'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import type { GameName } from '@/store/types'
import { MissionPanel } from '@/components/survival/mission-panel'
import { OwnedUpgradesList } from '@/components/survival/survival-shop'
import { ActiveItemsPanel } from '@/components/survival/active-items-panel'

function gameLabel(name: GameName): string {
  return GAME_BY_NAME.get(name)?.label ?? name
}

function GameNavLink({
  game,
  isCurrent,
}: {
  game: GameName
  isCurrent: boolean
}) {
  return (
    <Link
      href={`/survival/${game}`}
      aria-current={isCurrent ? 'page' : undefined}
      className={`flex h-8 items-center text-[13px] transition-colors ${isCurrent ? 'text-ink' : 'text-dim hover:text-ink'}`}
    >
      <span className="mark-line truncate" data-active={isCurrent}>
        {gameLabel(game)}
      </span>
    </Link>
  )
}

export function SurvivalGameWrapper({
  currentGame,
  children,
}: {
  currentGame: GameName
  children: ReactNode
}) {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const lastRun = useSurvivalStore((s) => s.lastRun)
  const runEndedByExit = useSurvivalStore((s) => s.runEndedByExit)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorStartBankroll = useSurvivalStore((s) => s.floorStartBankroll)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const floorGames = useSurvivalStore((s) => s.floorGames)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)
  const openingBetFree = useOpeningTicketActive()
  const endlessMode = useSurvivalStore((s) => s.endlessMode)

  useEffect(() => {
    if (runActive) return
    // Defeat/abandon route straight home; only victory (which keeps lastRun without
    // exiting) sends the player back to the hub to see the run summary.
    router.replace(runEndedByExit ? '/' : lastRun ? '/survival' : '/')
  }, [runActive, lastRun, runEndedByExit, router])

  if (!runActive) return null

  return (
    <>
      <div className="flex flex-1 min-h-0 gap-3">
        {/* Left sidebar — active items + upgrades */}
        <div className="hidden lg:flex flex-col gap-2 w-44 shrink-0 min-h-0">
          <div className="flex flex-col gap-2 min-h-0 flex-1">
            <div className="flex-1 min-h-0 flex flex-col">
              <ActiveItemsPanel compact />
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <OwnedUpgradesList compact currentGame={currentGame} />
            </div>
          </div>
        </div>

        {/* Center — game */}
        <div className="flex flex-col flex-1 min-h-0">
          {children}
        </div>

        {/* Right sidebar — run info + missions + game switch */}
        <div className="hidden lg:flex flex-col gap-2 w-48 shrink-0 min-h-0">
          <dl className="flex shrink-0 flex-col gap-3 rounded-md bg-surface p-3">
            <div className="flex items-start justify-between">
              <div>
                <dt className="text-xs text-dim">Floor</dt>
                <dd className="num text-xl leading-7 text-ink">
                  {currentFloor}
                  <span className="ml-1 text-xs text-dim">{endlessMode ? '∞' : `/ ${MAX_FLOORS}`}</span>
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-dim">Min bet</dt>
                <dd className="num text-[14px] leading-7 text-soft">{formatChips(floorMinBet)}</dd>
              </div>
            </div>
            {openingBetFree && <p className="text-xs text-felt">Opening ticket ready</p>}
            <div>
              <dt className="text-xs text-dim">Bankroll</dt>
              <dd className="num text-[17px] leading-6">
                <span className={bankroll >= quotaTarget ? 'text-ink' : 'text-loss'}>{formatChips(bankroll)}</span>
                <span className="ml-1 text-xs text-dim">/ {formatChips(quotaTarget)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-dim">Bets</dt>
              <dd className="num text-xl leading-7 text-ink">
                {floorBetsPlaced}
                <span className="ml-1 text-xs text-dim">/ {FLOOR_BET_LIMIT}</span>
              </dd>
            </div>
          </dl>

          <div className="flex-1 min-h-0 flex flex-col">
            <MissionPanel compact />
          </div>

          {floorGames.length > 0 && (
            <nav className="flex shrink-0 flex-col rounded-md bg-surface px-3 py-2" aria-label="This floor's games">
              <p className="pb-1 text-[13px] font-semibold text-ink">Floor games</p>
              {floorGames.map((g) => (
                <GameNavLink key={g} game={g} isCurrent={g === currentGame} />
              ))}
            </nav>
          )}
        </div>
      </div>
    </>
  )
}
