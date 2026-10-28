'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { FLOOR_BET_LIMIT, MAX_FLOORS } from '@/lib/survival/balance'
import { Button } from '@/components/ui/button'
import { PageTitle } from '@/components/ui/terminal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

export function FloorPanel() {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { currentFloor, floorMinBet, bankroll, quotaTarget, floorStartBankroll, floorComplete, runDefeated, runActive, floorBetsPlaced, endlessMode, endRun, finishQuotaEarly } = useSurvivalStore()

  const netProgress = bankroll - floorStartBankroll
  const netTarget = quotaTarget - floorStartBankroll
  const progressPct = netTarget <= 0
    ? 100
    : Math.min(100, Math.max(0, (netProgress / netTarget) * 100))

  const quotaReached = bankroll >= quotaTarget
  const barTone = quotaReached ? 'bg-felt' : bankroll < floorStartBankroll ? 'bg-loss' : 'bg-soft'

  const showFinishQuota = runActive && !floorComplete && !runDefeated
  const finishQuotaEnabled = bankroll >= quotaTarget && bankroll >= floorMinBet
  const betsLeft = Math.max(0, FLOOR_BET_LIMIT - floorBetsPlaced)

  const status = runDefeated
    ? { text: 'Run over — continue to return home.', tone: 'text-loss' }
    : floorComplete
      ? { text: 'Bets used and quota met — collect your rewards below.', tone: 'text-felt' }
      : quotaReached
        ? { text: 'Quota met. Finish the floor now, or keep betting to build your bankroll.', tone: 'text-felt' }
        : {
            text: `${formatChips(quotaTarget - bankroll)} to go with ${betsLeft} bet${betsLeft === 1 ? '' : 's'} left.`,
            tone: 'text-soft',
          }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="floor-title">
      <PageTitle
        title={
          <span id="floor-title">
            Floor {currentFloor}
            <span className="text-dim">{endlessMode ? ' · endless' : ` of ${MAX_FLOORS}`}</span>
          </span>
        }
        sub={`Reach ${formatChips(quotaTarget)} within ${FLOOR_BET_LIMIT} bets, each at least ${formatChips(floorMinBet)}.`}
        aside={
          <>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Abandon
            </Button>
            {showFinishQuota && (
              <Button onClick={() => finishQuotaEnabled && finishQuotaEarly()} disabled={!finishQuotaEnabled}>
                Finish floor
              </Button>
            )}
          </>
        }
      />

      <div className="rounded-md bg-surface px-4 py-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[13px]">
            <span className="num text-xl text-ink">{formatChips(bankroll)}</span>
            <span className="text-dim"> of </span>
            <span className="num text-soft">{formatChips(quotaTarget)}</span>
            <span className="text-dim"> quota</span>
          </p>
          <p className={`text-[13px] ${status.tone}`}>{status.text}</p>
        </div>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-raised"
          role="progressbar"
          aria-label="Floor quota"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
        >
          <div className={`h-full rounded-full transition-[width] duration-500 ${barTone}`} style={{ width: `${progressPct}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md bg-line">
          {[
            { label: 'Bets placed', value: floorBetsPlaced, unit: `/ ${FLOOR_BET_LIMIT}` },
            { label: 'Min bet', value: formatChips(floorMinBet) },
            { label: 'Started floor with', value: formatChips(floorStartBankroll) },
          ].map((f) => (
            <div key={f.label} className="bg-surface px-1 py-1 first:pl-0 sm:px-4 sm:first:pl-0">
              <p className="text-xs text-dim">{f.label}</p>
              <p className="num mt-0.5 text-[15px] text-ink">
                {f.value}
                {f.unit && <span className="ml-1 text-xs text-dim">{f.unit}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abandon this run?</DialogTitle>
            <DialogDescription>
              Progress, sparks, and upgrades for this run will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                endRun({ victory: false, exiting: true })
                router.push('/')
              }}
            >
              Abandon run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
