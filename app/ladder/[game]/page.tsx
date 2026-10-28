'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { useLadderStore } from '@/store/ladder-store'
import { useLadderGameBankroll } from '@/hooks/use-game-bankroll'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_LIVES, LADDER_RUNGS } from '@/lib/ladder/rules'
import { describeLadderResult } from '@/components/ladder/result-text'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'

const PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

const TITLE_TONE = { good: 'text-emerald-400', bad: 'text-red-400', neutral: 'text-foreground' }

function LadderGame({ game }: { game: GameName }) {
  const { wagerCap, handleBet, handleResolve } = useLadderGameBankroll(game)
  const rung = useLadderStore((s) => s.rung)
  const pot = useLadderStore((s) => s.pot)
  const lives = useLadderStore((s) => s.lives)
  const finalPot = useLadderStore((s) => s.finalPot)
  const openRound = useLadderStore((s) => s.openRound)
  const lastResult = useLadderStore((s) => s.lastResult)
  const dismissResult = useLadderStore((s) => s.dismissResult)
  const GameComponent = GAME_REGISTRY[game]

  // Rung and stake in play — frozen while a round is open so the pills don't jump on settle.
  const [shown, setShown] = useState({ rung, stake: pot })
  useEffect(() => {
    if (!openRound && !lastResult) setShown({ rung, stake: pot })
  }, [openRound, lastResult, rung, pot])

  // Let the round's result animation play before covering it.
  const [showResult, setShowResult] = useState(false)
  useEffect(() => {
    if (!lastResult) {
      setShowResult(false)
      return
    }
    const t = setTimeout(() => setShowResult(true), 1500)
    return () => clearTimeout(t)
  }, [lastResult])

  const result = lastResult ? describeLadderResult(lastResult, { rung, pot, lives, finalPot }) : null
  const runOver = lastResult?.kind === 'out' || lastResult?.kind === 'topped'

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

      {showResult && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-xs rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
            <h2 className={`text-2xl font-black mb-2 ${TITLE_TONE[result.tone]}`}>{result.title}</h2>
            <p className="text-zinc-500 text-sm mb-8">{result.body}</p>
            {lastResult?.kind === 'push' && (
              <button
                type="button"
                onClick={dismissResult}
                className="block w-full mb-2 py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-xl text-sm transition-colors shadow-lg"
              >
                Go again
              </button>
            )}
            <Link
              href="/ladder"
              className={
                lastResult?.kind === 'push'
                  ? 'block w-full py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold rounded-xl text-sm transition-colors'
                  : 'block w-full py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-xl text-sm transition-colors shadow-lg'
              }
            >
              {runOver ? 'See results' : lastResult?.kind === 'push' ? 'Pick another game' : 'Back to ladder'}
            </Link>
          </div>
        </div>
      )}
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
