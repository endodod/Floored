'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { CITY_BY_ID } from '@/lib/story/cities'
import { gamesFor } from '@/lib/story/rotation'
import { useStoryStore, VENUE_NAMES } from '@/store/story-store'
import { VENUE_MAX_M } from '@/lib/story/economy'
import { useStoryGameBankroll } from '@/hooks/use-game-bankroll'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'

const PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

function StoryGame({ game }: { game: GameName }) {
  const { bankroll, wagerCap, betsLeft, handleBet, handleResolve } = useStoryGameBankroll(game)
  const minBet = useStoryStore((s) => s.minBet())
  const venue = useStoryStore((s) => s.tonight?.venue ?? 0)
  const GameComponent = GAME_REGISTRY[game]
  const entry = GAME_BY_NAME.get(game)
  const maxM = VENUE_MAX_M[venue]

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2" title={`${entry?.label ?? game} · ${VENUE_NAMES[venue]}`}>
          <div className={PILL}>
            <span className="text-[9px] font-normal text-zinc-500 mr-1">Min bet</span>
            {formatChips(minBet)}
          </div>
          <div className={PILL}>
            <span className="text-[9px] font-normal text-zinc-500 mr-1">Table max</span>
            {maxM == null ? 'None' : formatChips(maxM * minBet)}
          </div>
          <div className={PILL}>
            <span className="text-[9px] font-normal text-zinc-500 mr-1">Bets left</span>
            {betsLeft}
          </div>
          <div className={PILL}>
            <span className="text-[9px] font-normal text-zinc-500 mr-1">Money</span>
            {formatChips(bankroll)}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <GameComponent mode="story" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
      </div>
    </div>
  )
}

export default function StoryGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params)
  const router = useRouter()
  const hydrated = useHydrated()
  const cityId = useStoryStore((s) => s.city)
  const venue = useStoryStore((s) => s.tonight?.venue ?? null)
  const nightNo = useStoryStore((s) => s.night)
  const seen = useStoryStore((s) => s.seenGames)
  const tonight = useStoryStore((s) => s.tonight)

  // Only tonight's games in the room you sat down in. The dive also deals any game an
  // open errand names (`openErrandGames`), and a game already being played stays put
  // even if the job that pinned it finished mid-night.
  const city = CITY_BY_ID.get(cityId)
  const must = useStoryStore.getState().openErrandGames()
  const played = !!tonight && (tonight.openRound?.game === game || tonight.rounds.some((r) => r.game === game))
  const allowed = !!city && venue != null && (gamesFor(city, nightNo, venue, seen, must).includes(game as GameName) || played)

  useEffect(() => {
    if (hydrated && !allowed) router.replace('/story')
  }, [hydrated, allowed, router])

  if (!hydrated || !allowed) return null
  return <StoryGame key={game} game={game as GameName} />
}
