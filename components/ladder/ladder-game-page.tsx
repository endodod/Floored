'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { useStore } from 'zustand'
import { useActiveLadderStore, useLadderHub } from '@/lib/ladder/active'
import { useLadderGameBankroll } from '@/hooks/use-game-bankroll'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_LIVES, LADDER_RUNGS, livesActive } from '@/lib/ladder/rules'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'

/** One figure in the strip above the game: grey label, mono value (the survival sidebar's style). */
function Figure({ label, children, tone }: { label: string; children: ReactNode; tone?: 'loss' }) {
  return (
    <div className="flex items-baseline gap-1.5 bg-surface px-2 py-1 sm:px-3 sm:py-1.5">
      <span className="text-[11px] text-dim sm:text-xs">{label}</span>
      <span className={`num text-[13px] sm:text-[14px] ${tone === 'loss' ? 'text-loss' : 'text-ink'}`}>{children}</span>
    </div>
  )
}

function LadderGame({ game }: { game: GameName }) {
  const { wagerCap, handleBet, handleResolve } = useLadderGameBankroll(game)
  const ladder = useActiveLadderStore()
  const rung = useStore(ladder, (s) => s.rung)
  const pot = useStore(ladder, (s) => s.pot)
  const lives = useStore(ladder, (s) => s.lives)
  const hasLives = useStore(ladder, (s) => livesActive(s.checkpointRung))
  const openRound = useStore(ladder, (s) => s.openRound)
  const lastResult = useStore(ladder, (s) => s.lastResult)
  const GameComponent = GAME_REGISTRY[game]

  // Rung and stake in play — frozen while a round is open so the pills don't jump on settle.
  const [shown, setShown] = useState({ rung, stake: pot })
  useEffect(() => {
    if (!openRound && !lastResult) setShown({ rung, stake: pot })
  }, [openRound, lastResult, rung, pot])

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex shrink-0 justify-end">
        <div className="flex flex-wrap gap-px overflow-hidden rounded-md bg-line">
          <Figure label="Rung">
            {shown.rung + 1}
            <span className="text-dim">/{LADDER_RUNGS}</span>
          </Figure>
          <Figure label="All-in">{formatChips(shown.stake)}</Figure>
          <Figure label="To win">{formatChips(shown.stake)}</Figure>
          <Figure label="Lives" tone={hasLives && lives === 1 ? 'loss' : undefined}>
            {hasLives ? (
              <>
                {lives}
                <span className="text-dim">/{LADDER_LIVES}</span>
              </>
            ) : (
              '—'
            )}
          </Figure>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <GameComponent mode="ladder" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
      </div>
    </div>
  )
}

/** A ladder rung's game, for both the endless ladder and the daily one (the store is picked by route). */
export function LadderGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params)
  const ladder = useActiveLadderStore()
  const hub = useLadderHub()
  const router = useRouter()
  const hydrated = useHydrated()
  const [valid, setValid] = useState<boolean | null>(null)

  useEffect(() => {
    if (!hydrated) return
    const s = ladder.getState()
    s.syncToday()
    // A round left mid-way on a previous visit counts as a fall.
    s.abandonOpenRound()
    const now = ladder.getState()
    const ok = game in GAME_REGISTRY && now.status === 'climbing' && now.currentGame === game
    // Checked once on entry: after the round settles the pick is cleared, but the result stays on screen.
    if (ok) now.dismissResult()
    setValid(ok)
  }, [hydrated, game, ladder])

  useEffect(() => {
    if (valid === false) router.replace(hub)
  }, [valid, router, hub])

  if (!valid) return null
  return <LadderGame key={game} game={game as GameName} />
}
