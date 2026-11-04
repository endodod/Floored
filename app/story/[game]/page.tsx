'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StoryHud } from '@/components/story/hud'
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

const PLAQUE =
  'flex h-6 sm:h-8 items-center gap-1.5 rounded-[5px] bg-black/45 px-2.5 shadow-[inset_0_0_0_1px_rgba(217,164,65,0.3)]'

/** One of the table's limits on a dark brass-ruled plaque, like the HUD's. */
function Limit({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={className ? `${PLAQUE} ${className}` : PLAQUE}>
      <span className="felt-print !text-[9px] !tracking-[0.14em]">{label}</span>
      <span className="num text-[13px] font-bold text-ink">{value}</span>
    </div>
  )
}

/** "5 / 100", or "5 / None" in a room without a table max. */
const tableLimits = (minBet: number, maxM: number | null) => `${formatChips(minBet)} / ${maxM == null ? 'None' : formatChips(maxM * minBet)}`

/**
 * A house game played at the location: the story frame (wood HUD, back to the
 * city) around a lamp-lit room, the same as the boss table and the minigames,
 * so a night at the tables still feels like being in the city.
 */
function StoryGame({ game }: { game: GameName }) {
  const { wagerCap, betsLeft, handleBet, handleResolve } = useStoryGameBankroll(game)
  const minBet = useStoryStore((s) => s.minBet())
  const venue = useStoryStore((s) => s.tonight?.venue ?? 0)
  const GameComponent = GAME_REGISTRY[game]
  const entry = GAME_BY_NAME.get(game)
  const maxM = VENUE_MAX_M[venue]

  return (
    <div className="st-screen st-game flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
      <StoryHud back title={entry?.label ?? game} table={{ min: minBet, max: maxM == null ? null : maxM * minBet }} />
      <div className="st-room flex min-h-0 flex-1 flex-col gap-1 pt-1 sm:gap-3 sm:p-3">
        {/* Phones: the HUD has no room for the limits and bets left, so they sit under it. */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 px-2 sm:hidden" aria-label={`${VENUE_NAMES[venue]} limits`} role="group">
          <Limit label="Table min / max" value={tableLimits(minBet, maxM)} />
          <Limit label="Bets left" value={betsLeft} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <GameComponent mode="story" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
        </div>
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
  // open job names (`openJobGames`), and a game already being played stays put
  // even if the job that pinned it finished mid-night.
  const city = CITY_BY_ID.get(cityId)
  const must = useStoryStore.getState().openJobGames()
  const played = !!tonight && (tonight.openRound?.game === game || tonight.rounds.some((r) => r.game === game))
  const allowed = !!city && venue != null && (gamesFor(city, nightNo, venue, seen, must).includes(game as GameName) || played)

  useEffect(() => {
    if (hydrated && !allowed) router.replace('/story')
  }, [hydrated, allowed, router])

  if (!hydrated || !allowed) return null
  return <StoryGame key={game} game={game as GameName} />
}
