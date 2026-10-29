'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import type { GameName } from '@/store/types'
import { GAMES, type GameEntry } from '@/lib/game-catalog'
import { SURVIVAL_GAME_POOL } from '@/lib/survival/balance'
import { canRerollLobbyGameWithTicket, getLobbyTicketCount } from '@/lib/survival/lobby-ticket'
import { GameTile, TileCornerButton } from '@/components/game-tile'
import { PayoutCaption } from '@/components/game-payout'

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
    <ul className={mode === 'freeplay'
        ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'
        : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
      {displayGames.map((g, i) => {
        const available = isAvailable(g)
        const isLoading = pendingGame === g.name
        const slotIndex = floorGames.indexOf(g.name)
        const canReroll =
          mode === 'survival' &&
          !showAllGames &&
          ticketCount > 0 &&
          !pendingGame &&
          !!runSeed &&
          slotIndex >= 0 &&
          canRerollLobbyGameWithTicket(slotIndex, floorGames, SURVIVAL_GAME_POOL, lobbyGamesOffered)

        return (
          <li key={g.name}>
            <GameTile
              index={i}
              label={g.label}
              symbol={g.symbol}
              sub={g.sub}
              meta={<PayoutCaption game={g.name} />}
              action={available ? 'Play' : 'Coming soon'}
              disabled={!available || !!pendingGame}
              faded={!available || (!!pendingGame && !isLoading)}
              loading={isLoading}
              onClick={() => available && handlePick(g.name)}
              onMouseEnter={() => available && router.prefetch(`/${mode}/${g.name}`)}
              corner={
                canReroll ? (
                  <TileCornerButton
                    title={`Use a ticket to reroll ${g.label} (${ticketCount} left)`}
                    onClick={() => rerollLobbyGame(slotIndex)}
                  >
                    Reroll · 1 ticket
                  </TileCornerButton>
                ) : undefined
              }
            />
          </li>
        )
      })}
    </ul>
  )
}
