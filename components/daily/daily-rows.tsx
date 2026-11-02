'use client'

import Link from 'next/link'
import { useHydrated } from '@/hooks/use-hydrated'
import { dailyLadderRecord, useDailyLadderStore } from '@/store/ladder-store'
import { CHECKPOINT_EVERY, LADDER_LIVES, LADDER_RUNGS, START_POT, livesActive } from '@/lib/ladder/rules'
import { dailyDateKey, dailyNumber, generateDailyChallenge, totalDailyBets } from '@/lib/daily/challenge'
import { dailyMultiplier, formatMultiplier } from '@/lib/daily/share'
import { useDailyStore } from '@/store/daily-store'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { UnitTrack } from '@/components/ui/terminal'
import { ModeRow } from '@/components/mode-row'

/** Today's Daily challenge as a mode row: on the home page and above the Challenges list. */
export function DailyChallengeRow({ index }: { index: number }) {
  const hydrated = useHydrated()
  const dailyDate = useDailyStore((s) => s.date)
  const dailyHistory = useDailyStore((s) => s.history)
  const dailyProgress = useDailyStore((s) => s.progress)
  const dailyBankroll = useDailyStore((s) => s.bankroll)
  const dailyOpened = useDailyStore((s) => s.started)

  // Pages are prerendered, so today's challenge is only known once mounted.
  const today = hydrated ? dailyDateKey() : null
  const challenge = today ? generateDailyChallenge(today) : null
  const todayRecord = today ? dailyHistory[today] : undefined
  const dailyIsToday = hydrated && dailyDate === today
  const dailyUsed = dailyIsToday ? Object.values(dailyProgress).reduce((sum, p) => sum + (p?.betsUsed ?? 0), 0) : 0
  const dailyTotal = challenge ? totalDailyBets(challenge) : 6
  const dailyStarted = dailyUsed > 0
  const dailyCta = todayRecord ? 'See results' : dailyStarted || (dailyIsToday && dailyOpened) ? 'Continue' : 'Play today'

  return (
    <ModeRow
      index={index}
      name={challenge ? `Daily challenge #${challenge.number}` : 'Daily challenge'}
      symbol="🗓️"
      description="The same challenge for everyone, one attempt. Place every bet across three games and finish with as much as you can."
      track={
        <UnitTrack
          total={dailyTotal}
          done={todayRecord ? dailyTotal : dailyUsed}
          current={!todayRecord && dailyStarted && dailyUsed < dailyTotal ? dailyUsed : undefined}
          label={`${dailyUsed} of ${dailyTotal} bets placed`}
        />
      }
      trackCaption={
        challenge
          ? `${todayRecord ? dailyTotal : dailyUsed}/${dailyTotal} bets · 3 games · min ${formatChips(challenge.minBet)}`
          : '3 games · one attempt'
      }
      figureLabel={todayRecord ? 'Today' : 'Bankroll'}
      figure={
        todayRecord
          ? todayRecord.endReason === 'failed'
            ? 'Failed'
            : todayRecord.endReason === 'gave-up'
              ? 'Gave up'
              : formatMultiplier(dailyMultiplier(todayRecord))
          : challenge
            ? formatChips(dailyStarted ? dailyBankroll : challenge.bankroll)
            : '—'
      }
      figureSub={todayRecord ? `ended on ${formatChips(todayRecord.endBankroll)}` : undefined}
      action={
        <Button asChild className="w-full lg:w-auto">
          <Link href="/daily">{dailyCta}</Link>
        </Button>
      }
    />
  )
}

/** Today's Daily ladder as a mode row: on the home page and above the Ladder. */
export function DailyLadderRow({ index }: { index: number }) {
  const hydrated = useHydrated()
  const dlStatus = useDailyLadderStore((s) => s.status)
  const dlDate = useDailyLadderStore((s) => s.date)
  const dlRung = useDailyLadderStore((s) => s.rung)
  const dlPot = useDailyLadderStore((s) => s.pot)
  const dlLives = useDailyLadderStore((s) => s.lives)
  const dlHasLives = useDailyLadderStore((s) => livesActive(s.checkpointRung))
  const dlHistory = useDailyLadderStore((s) => s.history)

  const today = hydrated ? dailyDateKey() : null
  const dlClimbing = hydrated && dlStatus === 'climbing' && dlDate === today
  const dlRecord = today ? dailyLadderRecord(dlHistory, today) : undefined

  return (
    <ModeRow
      index={index}
      name={today ? `Daily ladder #${dailyNumber(today)}` : 'Daily ladder'}
      symbol="📅"
      description="Today's ladder: the same game pickers for everyone and a single climb. Bank as big a pot as you can."
      track={
        <UnitTrack
          total={LADDER_RUNGS}
          done={dlClimbing ? dlRung : dlRecord ? dlRecord.peakRung : 0}
          current={dlClimbing ? dlRung : undefined}
          checkpointEvery={CHECKPOINT_EVERY}
          label={dlClimbing ? `On rung ${dlRung + 1} of ${LADDER_RUNGS}` : `${LADDER_RUNGS} rungs`}
        />
      }
      trackCaption={
        dlClimbing
          ? `Rung ${dlRung + 1}/${LADDER_RUNGS} · ${dlHasLives ? `${dlLives} of ${LADDER_LIVES} lives` : `a loss before rung ${CHECKPOINT_EVERY} ends it`}`
          : dlRecord
            ? dlRecord.endReason === 'failed'
              ? 'Fell before the first checkpoint'
              : `Reached rung ${dlRecord.peakRung}/${LADDER_RUNGS}`
            : `${LADDER_RUNGS} rungs · one climb a day`
      }
      figureLabel={dlRecord ? 'Today' : dlClimbing ? 'Pot' : 'Starting pot'}
      figure={
        dlRecord?.endReason === 'failed'
          ? 'Failed'
          : formatChips(dlRecord ? dlRecord.finalPot : dlClimbing ? dlPot : START_POT)
      }
      action={
        <Button asChild className="w-full lg:w-auto">
          <Link href="/daily-ladder">{dlRecord ? 'See results' : dlClimbing ? 'Continue climb' : 'Climb today'}</Link>
        </Button>
      }
    />
  )
}
