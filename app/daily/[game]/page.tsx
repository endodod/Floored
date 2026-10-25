'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

function DailyGame({ game, bets }: { game: GameName; bets: number }) {
  const { bankroll, wagerCap, betsRemaining, roundOpen, finished, handleBet, handleResolve } =
    useDailyGameBankroll(game, bets)
  const GameComponent = GAME_REGISTRY[game]
  const entry = GAME_BY_NAME.get(game)

  // Let the final round's result animation play before covering it.
  const outOfBets = (betsRemaining === 0 && !roundOpen) || finished
  const [showDone, setShowDone] = useState(false)
  useEffect(() => {
    if (!outOfBets) {
      setShowDone(false)
      return
    }
    const t = setTimeout(() => setShowDone(true), 1500)
    return () => clearTimeout(t)
  }, [outOfBets])

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <Link
          href="/daily"
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500 transition-colors"
        >
          ← Daily
        </Link>
        <div className="flex items-center gap-2">
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

      {showDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
            <h2 className="text-2xl font-black text-foreground mb-2">
              {finished ? 'Daily complete' : 'Out of bets'}
            </h2>
            <p className="text-zinc-500 text-sm mb-8">
              {finished
                ? `You finished today with ${formatChips(bankroll)}.`
                : `No bets left on ${entry?.label ?? game}. Bankroll: ${formatChips(bankroll)}.`}
            </p>
            <Link
              href="/daily"
              className="block w-full py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-xl text-sm transition-colors shadow-lg"
            >
              {finished ? 'See results' : 'Back to Daily'}
            </Link>
          </div>
        </div>
      )}
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

  const slot = useMemo(
    () => generateDailyChallenge(date ?? dailyDateKey()).games.find((g) => g.game === game),
    [date, game],
  )

  const invalid = hydrated && ready && !slot
  useEffect(() => {
    if (invalid) router.replace('/daily')
  }, [invalid, router])

  if (!hydrated || !ready || !slot) return null
  return <DailyGame key={`${date}-${game}`} game={slot.game} bets={slot.bets} />
}
