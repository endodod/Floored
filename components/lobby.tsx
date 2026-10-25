'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import type { GameName } from '@/store/types'
import { GAMES, type GameEntry } from '@/lib/game-catalog'
import { SURVIVAL_GAME_POOL } from '@/lib/survival/balance'
import { canRerollLobbyGameWithTicket, getLobbyTicketCount } from '@/lib/survival/lobby-ticket'

interface Props {
  mode: 'survival' | 'freeplay'
}

export function Lobby({ mode }: Props) {
  const router = useRouter()
  const [pendingGame, setPendingGame] = useState<GameName | null>(null)
  const floorGames = useSurvivalStore((s) => s.floorGames)
  const runSeed = useSurvivalStore((s) => s.runSeed)
  const inventory = useSurvivalStore((s) => s.inventory)
  const lobbyGamesOffered = useSurvivalStore((s) => s.lobbyGamesOffered)
  const rerollLobbyGame = useSurvivalStore((s) => s.rerollLobbyGame)
  const { showAllGames } = useSettingsStore()

  const ticketCount = getLobbyTicketCount(inventory)

  const gameByName = new Map(GAMES.map((g) => [g.name, g]))

  const displayGames =
    mode === 'survival'
      ? showAllGames
        ? GAMES.filter((g) => g.availableSurvival)
        : floorGames
            .map((name) => gameByName.get(name))
            .filter((g): g is GameEntry => g != null)
      : GAMES

  useEffect(() => {
    if (mode === 'survival') {
      const toPreload = showAllGames ? GAMES.filter((g) => g.availableSurvival) : floorGames.map((name) => gameByName.get(name)).filter((g): g is GameEntry => g != null)
      toPreload.forEach((g) => router.prefetch(`/survival/${g.name}`))
    } else {
      GAMES.filter((g) => g.availableFreeplay).forEach((g) => router.prefetch(`/freeplay/${g.name}`))
    }
  }, [mode, floorGames, showAllGames, router])

  function isAvailable(g: GameEntry) {
    if (mode === 'freeplay') return g.availableFreeplay
    if (showAllGames) return g.availableSurvival
    return floorGames.includes(g.name)
  }

  function handlePick(game: GameName) {
    if (pendingGame) return
    setPendingGame(game)
    router.push(`/${mode}/${game}`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {displayGames.map((g, i) => {
        const available = isAvailable(g)
        const isLoading = pendingGame === g.name
        // last item spans full width on mobile if it would be orphaned (odd total, 2-col)
        const isOrphan = displayGames.length % 2 !== 0 && i === displayGames.length - 1

        return (
          <div
            key={g.name}
            className={[
              'relative',
              isOrphan ? 'col-span-2 sm:col-span-1' : 'col-span-1',
            ].join(' ')}
          >
            {mode === 'survival' &&
              !showAllGames &&
              ticketCount > 0 &&
              !pendingGame &&
              runSeed &&
              (() => {
                const slotIndex = floorGames.indexOf(g.name)
                if (slotIndex < 0) return null
                if (
                  !canRerollLobbyGameWithTicket(
                    slotIndex,
                    floorGames,
                    SURVIVAL_GAME_POOL,
                    lobbyGamesOffered,
                  )
                ) {
                  return null
                }
                return (
                  <button
                    type="button"
                    title="Use a ticket to reroll this lobby game"
                    onClick={() => rerollLobbyGame(slotIndex)}
                    className="absolute top-2 right-2 z-10 flex h-7 items-center gap-1 rounded-lg border border-white/20 bg-black/40 pl-1.5 pr-2 text-white/90 hover:bg-black/60 hover:border-white/40 transition-colors"
                  >
                    <span aria-hidden className="text-xs leading-none">↻:</span>
                    <span aria-hidden className="text-xs leading-none">🎟️</span>
                    <span className="text-[10px] font-bold tabular-nums leading-none">×1</span>
                  </button>
                )
              })()}
            <button
              type="button"
              onClick={() => available && handlePick(g.name)}
              onMouseEnter={() => available && router.prefetch(`/${mode}/${g.name}`)}
              disabled={!!pendingGame}
              className={[
                'relative overflow-hidden rounded-2xl border transition-all duration-200 text-left w-full',
                g.gradient ? `bg-gradient-to-br ${g.gradient}` : '',
                g.accent,
                available && !pendingGame
                  ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group'
                  : 'cursor-default',
                isLoading ? 'opacity-90' : pendingGame ? 'opacity-40' : '',
              ].join(' ')}
            >
            {/* Felt texture overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '6px 6px' }}
            />

            {/* Card content */}
            <div className={`relative p-5 flex flex-col ${isOrphan ? 'min-h-24 sm:min-h-32' : 'min-h-32'}`}>
              <div>
                <div className="flex items-start gap-2 min-h-[2.875rem] sm:min-h-[3.75rem]">
                  <span className="text-2xl leading-none select-none shrink-0">{g.symbol}</span>
                  <p className="text-white font-black text-lg sm:text-2xl leading-tight tracking-tight line-clamp-2 group-hover:scale-105 origin-left transition-transform duration-200">
                    {g.label}
                  </p>
                </div>
                <p className="text-white/40 text-xs mt-1 line-clamp-1">{g.sub}</p>
              </div>

              <div className="mt-auto pt-2">
              {available ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors shrink-0">
                    {isLoading ? (
                      <svg className="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 10 10" className="w-3 h-3 fill-white translate-x-px" aria-hidden>
                        <polygon points="2,1 9,5 2,9" />
                      </svg>
                    )}
                  </div>
                  <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                    {isLoading ? 'Loading…' : 'Play now'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-white/20 text-xs">
                  <svg viewBox="0 0 12 12" className="w-3 h-3 fill-white/20 shrink-0" aria-hidden>
                    <rect x="2" y="5" width="8" height="6" rx="1" />
                    <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                  Coming soon
                </div>
              )}
              </div>
            </div>
          </button>
          </div>
        )
      })}
      </div>

    </div>
  )
}
