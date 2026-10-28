'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { MAX_FLOORS } from '@/lib/survival/balance'
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

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-zinc-950 p-5 sm:p-6 shadow-lg">
      <div className="space-y-1.5">
        <h2 className={`font-bold ${isFinalFloorChoice ? 'text-amber-400 text-2xl' : 'text-lg text-foreground'}`}>
          {isFinalFloorChoice
            ? '🏆 All 10 floors cleared!'
            : isEarly
              ? `Quota met — floor ${currentFloor}`
              : endlessMode
                ? `Floor ${currentFloor} complete`
                : `Floor ${currentFloor} Complete!`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isFinalFloorChoice
            ? 'Claim your victory or push into endless mode — quotas and min bets keep scaling.'
            : isEarly
              ? 'You still have bets remaining. Keep playing to build your bankroll, or advance now.'
              : endlessMode
                ? 'Endless run — collect sparks and keep climbing.'
                : 'All 10 bets used — quota met. Collect sparks, then pick your next game on the lobby.'}
        </p>
      </div>

      <div className="flex flex-col gap-3 mt-4">
        <div className="text-xs text-zinc-500">You start runs with 3 reroll tickets and gain 3 additional reroll tickets each floor.</div>
        <div className="rounded-xl bg-muted/50 px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Goal bankroll</span>
            <span className="font-semibold">{formatChips(quotaTarget)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Net profit</span>
            <span className={`font-semibold ${netProgress >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netProgress >= 0 ? '+' : ''}{formatChips(netProgress)}</span>
          </div>
          {overQuota > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Over quota</span>
              <span className="font-semibold text-emerald-400">+{formatChips(overQuota)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="text-muted-foreground">Floor sparks</span>
            <span className="font-bold text-amber-400">✦ {sparksEarned}</span>
          </div>
        </div>

        {completedMissions.length > 0 && (
          <div className="rounded-xl bg-muted/30 px-4 py-3 text-sm">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Missions completed</p>
            <ul className="space-y-1">
              {completedMissions.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span className="text-xs capitalize text-emerald-400">{m.type.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-semibold text-yellow-400">✦ {m.rewardSparks}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isFinalFloorChoice ? (
          <div className="flex flex-col gap-2">
            <Button onClick={handleClaimVictory} className="w-full">
              Claim Victory
            </Button>
            <Button onClick={handleContinueEndless} variant="secondary" className="w-full">
              Continue — Endless Mode
            </Button>
          </div>
        ) : isEarly ? (
          <div className="flex flex-col gap-2">
            <Button onClick={handleContinue} className="w-full">
              {endlessMode ? `Continue to Floor ${currentFloor + 1}` : `Advance to Floor ${currentFloor + 1}`}
            </Button>
            <Button onClick={handleKeepPlaying} variant="secondary" className="w-full">
              Keep Playing
            </Button>
          </div>
        ) : (
          <Button onClick={handleContinue} className="w-full">
            {endlessMode
              ? `Continue to Floor ${currentFloor + 1}`
              : `Continue to Floor ${currentFloor + 1}`}
          </Button>
        )}
      </div>
    </div>
  )
}
