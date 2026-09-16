'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { useOpeningTicketActive } from '@/hooks/use-opening-ticket'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import type { GameName } from '@/store/types'
import { FloorCompleteModal } from '@/components/survival/floor-complete-modal'
import { SurvivalDefeatModal } from '@/components/survival/survival-defeat-modal'
import { MissionPanel } from '@/components/survival/mission-panel'
import { OwnedUpgradesList } from '@/components/survival/survival-shop'
import { ActiveItemsPanel } from '@/components/survival/active-items-panel'

function gameLabel(name: GameName): string {
  return name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const GAME_STYLES: Partial<Record<GameName, { symbol: string; bg: string; border: string; text: string }>> = {
  blackjack:      { symbol: '♠',  bg: 'bg-red-950',     border: 'border-red-800',     text: 'text-red-300'     },
  crash:          { symbol: '🚀', bg: 'bg-teal-950',    border: 'border-teal-800',    text: 'text-teal-300'    },
  plinko:         { symbol: '⚪', bg: 'bg-amber-950',   border: 'border-amber-800',   text: 'text-amber-300'   },
  'over-under':   { symbol: '⇅',  bg: 'bg-indigo-950',  border: 'border-indigo-800',  text: 'text-indigo-300'  },
  wheel:          { symbol: '◎',  bg: 'bg-lime-950',    border: 'border-lime-800',    text: 'text-lime-300'    },
  'run-dice':     { symbol: '⚅',  bg: 'bg-violet-950',  border: 'border-violet-800',  text: 'text-violet-300'  },
  mines:          { symbol: '💣', bg: 'bg-orange-950',  border: 'border-orange-800',  text: 'text-orange-300'  },
  'chicken-road': { symbol: '🐔', bg: 'bg-sky-950',     border: 'border-sky-800',     text: 'text-sky-300'     },
  slots:          { symbol: '🎰', bg: 'bg-rose-950',    border: 'border-rose-800',    text: 'text-rose-300'    },
  roulette:       { symbol: '🎡', bg: 'bg-emerald-950', border: 'border-emerald-800', text: 'text-emerald-300' },
  'dragon-tower': { symbol: '🐉', bg: 'bg-fuchsia-950', border: 'border-fuchsia-800', text: 'text-fuchsia-300' },
  'chicken-race': { symbol: '🏁', bg: 'bg-slate-950',   border: 'border-slate-700',   text: 'text-slate-300'   },
  'street-cups':  { symbol: '👑', bg: 'bg-stone-950',   border: 'border-stone-700',   text: 'text-stone-300'   },
  'case-battles': { symbol: '🎁', bg: 'bg-cyan-950',    border: 'border-cyan-800',    text: 'text-cyan-300'    },
  'poker-1p':     { symbol: '🃏', bg: 'bg-green-950',   border: 'border-green-800',   text: 'text-green-300'   },
  hilo:           { symbol: '↕',  bg: 'bg-purple-950',  border: 'border-purple-800',  text: 'text-purple-300'  },
  keno:           { symbol: '🎱', bg: 'bg-pink-950',    border: 'border-pink-800',    text: 'text-pink-300'    },
  'coin-flip':    { symbol: '🪙', bg: 'bg-yellow-950',  border: 'border-yellow-800',  text: 'text-yellow-300'  },
}

function GameNavLink({
  game,
  isCurrent,
}: {
  game: GameName
  isCurrent: boolean
}) {
  const style = GAME_STYLES[game]
  const baseClass =
    'rounded-lg border px-2.5 py-1.5 text-sm flex items-center gap-2 min-h-[2.25rem]'
  const content = (
    <>
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none">
        {style?.symbol ?? '·'}
      </span>
      <span className="truncate leading-tight">{gameLabel(game)}</span>
    </>
  )

  if (isCurrent) {
    return (
      <div
        aria-current="page"
        className={[
          baseClass,
          'font-semibold ring-1 ring-white/20',
          style
            ? `${style.bg} ${style.border} ${style.text}`
            : 'border-zinc-600 bg-zinc-800 text-white',
        ].join(' ')}
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      href={`/survival/${game}`}
      className={[
        baseClass,
        'font-medium transition-colors',
        style
          ? `${style.bg} ${style.border} ${style.text} hover:brightness-125`
          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-white',
      ].join(' ')}
    >
      {content}
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
      <FloorCompleteModal />
      <SurvivalDefeatModal />
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
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 shrink-0">
            {/* Top row: Floor | Min Bet */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Floor</p>
                <p className="text-2xl font-black leading-tight">
                  {currentFloor}
                  <span className="text-sm font-normal text-muted-foreground">
                    {endlessMode ? ' ∞' : ' / 10'}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Min Bet</p>
                <p className="text-sm font-semibold text-muted-foreground leading-tight">{formatChips(floorMinBet)}</p>
              </div>
            </div>
            {openingBetFree && (
              <p className="text-[10px] font-semibold text-emerald-400/90 leading-tight">Opening Ticket ready</p>
            )}
            {/* Bankroll / Quota */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Bankroll</p>
              <p className="text-lg font-black tabular-nums leading-tight">
                <span className={bankroll >= quotaTarget ? 'text-foreground' : 'text-red-400'}>
                  {formatChips(bankroll)}
                </span>
                <span className="text-sm font-normal text-muted-foreground"> / {formatChips(quotaTarget)}</span>
              </p>
            </div>
            {/* Bet counter */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Bets</p>
              <p className="text-2xl font-black tabular-nums leading-tight">
                {floorBetsPlaced}
                <span className="text-sm font-normal text-muted-foreground">/{FLOOR_BET_LIMIT}</span>
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <MissionPanel compact />
          </div>

          {floorGames.length > 0 && (
            <div className="flex flex-col gap-1 shrink-0">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider px-1">Floor games</p>
              {floorGames.map((g) => (
                <GameNavLink key={g} game={g} isCurrent={g === currentGame} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
