'use client'

import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { Button } from '@/components/ui/button'
import { FLOOR_BET_LIMIT, MAX_FLOORS } from '@/lib/survival/balance'
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
      className="grid grid-cols-1 gap-6 rounded-md bg-surface p-5 sm:p-6 lg:grid-cols-2 lg:gap-10"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h2 id="survival-defeat-title" className="text-xl font-semibold text-loss">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-soft">{description}</p>
        </div>
        <Button onClick={handleContinue} variant="destructive" className="mt-auto self-start">
          End run
        </Button>
      </div>

      <dl className="divide-y divide-rule self-start">
        {[
          { label: 'Floor', value: `${currentFloor} / ${MAX_FLOORS}`, tone: 'text-ink' },
          { label: 'Bankroll', value: formatChips(bankroll), tone: 'text-loss' },
          { label: 'Quota', value: formatChips(quotaTarget), tone: 'text-ink' },
        ].map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[13px] text-dim">{r.label}</dt>
            <dd className={`num text-[14px] ${r.tone}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
