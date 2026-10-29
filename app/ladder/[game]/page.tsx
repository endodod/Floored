'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { useLadderStore } from '@/store/ladder-store'
import { useLadderGameBankroll } from '@/hooks/use-game-bankroll'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_LIVES, LADDER_RUNGS } from '@/lib/ladder/rules'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'

const PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

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
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className={PILL}>
          <span className="text-[9px] font-normal text-zinc-500 mr-1">Rung</span>
          {shown.rung + 1}
          <span className="text-zinc-500">/{LADDER_RUNGS}</span>
        </div>
        <div className={PILL}>
          <span className="text-[9px] font-normal text-zinc-500 mr-1">All-in</span>
          {formatChips(shown.stake)}
        </div>
        <div className={PILL}>
          <span className="text-[9px] font-normal text-zinc-500 mr-1">Win more than</span>
          {formatChips(shown.stake)}
        </div>
        <div className={PILL} aria-label={`${lives} lives left`}>
          {'❤️'.repeat(lives) + '🖤'.repeat(LADDER_LIVES - lives)}
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
