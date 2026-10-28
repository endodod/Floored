'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { FLOOR_BET_LIMIT, MAX_FLOORS, REROLL_TICKETS_PER_FLOOR, STARTING_REROLL_TICKETS } from '@/lib/survival/balance'
import { signed } from '@/components/ui/terminal'
import { calcFloorSparksEarned } from '@/lib/survival/sparks-economy'
import { evaluateMissionsOnFloorComplete } from '@/lib/survival/mission-evaluator'

/** Floor rewards and the next-floor choice — shown inline on the survival lobby once a floor is complete. */
export function FloorCompletePanel() {
  const router = useRouter()
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const floorCompleteReason = useSurvivalStore((s) => s.floorCompleteReason)
  const endlessMode = useSurvivalStore((s) => s.endlessMode)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const floorStartBankroll = useSurvivalStore((s) => s.floorStartBankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorGames = useSurvivalStore((s) => s.floorGames)
  const difficulty = useSurvivalStore((s) => s.difficulty)
  const missions = useSurvivalStore((s) => s.missions)
  const completedMissions = missions.filter((m) => m.completed)
  const advanceFloor = useSurvivalStore((s) => s.advanceFloor)
  const continueToEndless = useSurvivalStore((s) => s.continueToEndless)
  const endRun = useSurvivalStore((s) => s.endRun)
  const dismissFloorComplete = useSurvivalStore((s) => s.dismissFloorComplete)
  const appendFloorHistory = useSurvivalStore((s) => s.appendFloorHistory)
  const applyMissionResults = useSurvivalStore((s) => s.applyMissionResults)

  const [floorMissionsEvaluated, setFloorMissionsEvaluated] = useState(false)

  const isFinalFloorChoice = currentFloor === MAX_FLOORS && !endlessMode
  const isEarly = floorCompleteReason === 'early'
  const netProgress = bankroll - floorStartBankroll
  const sparksEarned =
    difficulty != null
      ? calcFloorSparksEarned({
          floor: currentFloor,
          bankroll,
          floorStartBankroll,
          quotaTarget,
          difficulty,
        })
      : 0
  const overQuota = Math.max(0, bankroll - quotaTarget)

  useEffect(() => {
    if (!floorComplete) {
      setFloorMissionsEvaluated(false)
      return
    }

    if (!floorMissionsEvaluated) {
      const updated = evaluateMissionsOnFloorComplete(missions, {
        bankroll,
        floorStartBankroll,
      })
      applyMissionResults(updated)
      setFloorMissionsEvaluated(true)
    }
  }, [floorComplete, floorMissionsEvaluated, missions, bankroll, floorStartBankroll, applyMissionResults])

  function creditFloorProgress() {
    appendFloorHistory({
      floor: currentFloor,
      quotaTarget,
      quotaAchieved: bankroll,
      floorGames,
      endBankroll: bankroll,
      completedAt: new Date().toISOString(),
    })
  }

  function handleKeepPlaying() {
    dismissFloorComplete()
  }

  function handleContinue() {
    creditFloorProgress()
    advanceFloor()
    dismissFloorComplete()
    router.push('/survival')
  }

  function handleClaimVictory() {
    creditFloorProgress()
    endRun({ victory: true })
  }

  function handleContinueEndless() {
    creditFloorProgress()
    continueToEndless()
    dismissFloorComplete()
    router.push('/survival')
  }

  if (!floorComplete) return null

  const title = isFinalFloorChoice
    ? `All ${MAX_FLOORS} floors cleared`
    : isEarly
      ? `Quota met on floor ${currentFloor}`
      : `Floor ${currentFloor} complete`
  const body = isFinalFloorChoice
    ? 'Claim your victory, or push into endless mode where quotas and min bets keep scaling.'
    : isEarly
      ? 'You still have bets left. Keep playing to build your bankroll, or move up now.'
      : endlessMode
        ? 'Endless run — collect your sparks and keep climbing.'
        : `All ${FLOOR_BET_LIMIT} bets used with the quota met. Collect your sparks, then pick a game on the next floor.`

  const rows: { label: string; value: string; tone?: string }[] = [
    { label: 'Quota', value: formatChips(quotaTarget) },
    { label: 'Net this floor', value: signed(netProgress, formatChips), tone: netProgress >= 0 ? 'text-felt' : 'text-loss' },
    ...(overQuota > 0 ? [{ label: 'Over quota', value: `+${formatChips(overQuota)}`, tone: 'text-felt' }] : []),
    ...completedMissions.map((m) => ({ label: `Mission: ${m.type.replace(/_/g, ' ')}`, value: `+${m.rewardSparks} sparks`, tone: 'text-gold' })),
    { label: 'Floor sparks', value: `+${sparksEarned} sparks`, tone: 'text-gold' },
  ]

  return (
    <section
      aria-labelledby="floor-complete-title"
      className="grid grid-cols-1 gap-6 rounded-md bg-surface p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h2 id="floor-complete-title" className="text-xl font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-soft">{body}</p>
        </div>
        <p className="text-xs leading-5 text-dim">
          Runs start with {STARTING_REROLL_TICKETS} reroll tickets and every floor adds {REROLL_TICKETS_PER_FLOOR} more.
        </p>
        <div className="mt-auto flex flex-col gap-2 sm:flex-row">
          {isFinalFloorChoice ? (
            <>
              <Button onClick={handleClaimVictory}>Claim victory</Button>
              <Button onClick={handleContinueEndless} variant="outline">
                Continue in endless mode
              </Button>
            </>
          ) : isEarly ? (
            <>
              <Button onClick={handleContinue}>Go to floor {currentFloor + 1}</Button>
              <Button onClick={handleKeepPlaying} variant="outline">
                Keep playing this floor
              </Button>
            </>
          ) : (
            <Button onClick={handleContinue}>Go to floor {currentFloor + 1}</Button>
          )}
        </div>
      </div>

      <dl className="divide-y divide-rule self-start">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[13px] capitalize text-dim">{r.label}</dt>
            <dd className={`num text-[14px] ${r.tone ?? 'text-ink'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
