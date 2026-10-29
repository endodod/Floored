'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { useLadderStore } from '@/store/ladder-store'
import { useLadderGameBankroll } from '@/hooks/use-game-bankroll'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_LIVES, LADDER_RUNGS } from '@/lib/ladder/rules'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'

/** One figure in the strip above the game: grey label, mono value (the survival sidebar's style). */
function Figure({ label, children, tone }: { label: string; children: ReactNode; tone?: 'loss' }) {
  return (
    <div className="flex items-baseline gap-1.5 bg-surface px-3 py-1.5">
      <span className="text-xs text-dim">{label}</span>
      <span className={`num text-[14px] ${tone === 'loss' ? 'text-loss' : 'text-ink'}`}>{children}</span>
    </div>
  )
}

function LadderGame({ game }: { game: GameName }) {
  const { wagerCap, handleBet, handleResolve } = useLadderGameBankroll(game)
  const rung = useLadderStore((s) => s.rung)
  const pot = useLadderStore((s) => s.pot)
  const lives = useLadderStore((s) => s.lives)
  const openRound = useLadderStore((s) => s.openRound)
  const lastResult = useLadderStore((s) => s.lastResult)
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
          <Figure label="Win more than">{formatChips(shown.stake)}</Figure>
          <Figure label="Lives" tone={lives === 1 ? 'loss' : undefined}>
            {lives}
            <span className="text-dim">/{LADDER_LIVES}</span>
          </Figure>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <GameComponent mode="ladder" bankroll={wagerCap} onBet={handleBet} onResolve={handleResolve} />
      </div>
    </div>
  )
}

export default function LadderGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params)
  const router = useRouter()
  const hydrated = useHydrated()
  const [valid, setValid] = useState<boolean | null>(null)

  useEffect(() => {
    if (!hydrated) return
    const s = useLadderStore.getState()
    // A round left mid-way on a previous visit counts as a fall.
    s.abandonOpenRound()
    const now = useLadderStore.getState()
    const ok = game in GAME_REGISTRY && now.status === 'climbing' && now.currentGame === game
    // Checked once on entry: after the round settles the pick is cleared, but the result stays on screen.
    if (ok) now.dismissResult()
    setValid(ok)
  }, [hydrated, game])

  useEffect(() => {
    if (valid === false) router.replace('/ladder')
  }, [valid, router])

  if (!valid) return null
  return <LadderGame key={game} game={game as GameName} />
}
