'use client'

import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { Button } from '@/components/ui/button'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import { formatChips } from '@/utils/format'
import type { DefeatReason } from '@/store/types'

function defeatCopy(reason: DefeatReason, quotaTarget: number) {
  if (reason === 'bust') {
    return {
      title: 'Out of chips',
      description: 'Your bankroll fell below the floor minimum bet. This run is over.',
    }
  }
  return {
    title: 'Quota missed',
    description: `You used all ${FLOOR_BET_LIMIT} bets on this floor without reaching ${formatChips(quotaTarget)}. This run is over.`,
  }
}

/** Run-over summary on the survival lobby — for a defeat left pending when the player walked out of a game. */
export function SurvivalDefeatPanel() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const runDefeated = useSurvivalStore((s) => s.runDefeated)
  const defeatReason = useSurvivalStore((s) => s.defeatReason ?? s.pendingDefeatReason)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const confirmDefeat = useSurvivalStore((s) => s.confirmDefeat)
  const pendingDefeatReason = useSurvivalStore((s) => s.pendingDefeatReason)

  const open = runActive && (runDefeated || pendingDefeatReason != null) && defeatReason != null
  if (!open) return null

  const { title, description } = defeatCopy(defeatReason, quotaTarget)

  function handleContinue() {
    confirmDefeat()
    router.push('/')
  }

  return (
    <section
      aria-labelledby="survival-defeat-title"
      className="rounded-2xl border border-red-900/50 bg-zinc-950 p-5 sm:p-6 shadow-lg flex flex-col gap-5 text-center"
    >
      <div className="space-y-2">
        <h2 id="survival-defeat-title" className="text-xl font-bold text-red-400">
          {title}
        </h2>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>

      <div className="rounded-xl bg-zinc-900/80 border border-zinc-800 px-4 py-3 text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-zinc-500">Floor</span>
          <span className="font-semibold">{currentFloor} / 10</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Bankroll</span>
          <span className="font-semibold text-red-300">{formatChips(bankroll)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Quota</span>
          <span className="font-semibold">{formatChips(quotaTarget)}</span>
        </div>
      </div>

      <Button onClick={handleContinue} className="w-full" size="lg" variant="destructive">
        End run
      </Button>
    </section>
  )
}
