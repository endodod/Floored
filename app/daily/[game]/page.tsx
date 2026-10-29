'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { dailyDateKey, generateDailyChallenge } from '@/lib/daily/challenge'
import { useDailyStore } from '@/store/daily-store'
import { useDailyGameBankroll } from '@/hooks/use-game-bankroll'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'

const PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

function DailyGame({ game, bets, minBet }: { game: GameName; bets: number; minBet: number }) {
  const { wagerCap, betsRemaining, handleBet, handleResolve } = useDailyGameBankroll(game, bets)
  const GameComponent = GAME_REGISTRY[game]
  const entry = GAME_BY_NAME.get(game)

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <div className={PILL}>
            <span className="text-[9px] font-normal text-zinc-500 mr-1">Min bet</span>
            {formatChips(minBet)}
          </div>
          <div className={PILL}>
            <span className="text-[9px] font-normal text-zinc-500 mr-1">{entry?.label ?? game} bets</span>
            {betsRemaining}
            <span className="text-zinc-500">/{bets}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <GameComponent mode="daily" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
      </div>
    </div>
  )
}

export default function DailyGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params)
  const router = useRouter()
  const hydrated = useHydrated()
  const syncToday = useDailyStore((s) => s.syncToday)
  const abandonOpenRound = useDailyStore((s) => s.abandonOpenRound)
  const date = useDailyStore((s) => s.date)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    syncToday()
    // A round left mid-way on a previous visit is forfeited.
    abandonOpenRound()
    setReady(true)
  }, [syncToday, abandonOpenRound])

  const challenge = useMemo(() => generateDailyChallenge(date ?? dailyDateKey()), [date])
  const slot = challenge.games.find((g) => g.game === game)

  const invalid = hydrated && ready && !slot
  useEffect(() => {
    if (invalid) router.replace('/daily')
  }, [invalid, router])

  if (!hydrated || !ready || !slot) return null
  return <DailyGame key={`${date}-${game}`} game={slot.game} bets={slot.bets} minBet={challenge.minBet} />
}
