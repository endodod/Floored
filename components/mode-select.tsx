'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSurvivalStore } from '@/store/survival-store'
import { FLOOR_BET_LIMIT, MAX_FLOORS, STARTING_BANKROLL } from '@/lib/survival/balance'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_ENABLED, SURVIVAL_ENABLED, TABLES_ENABLED } from '@/lib/features'
import { useTablesStore } from '@/store/tables-store'
import { TABLE_GAMES } from '@/lib/tables/catalog'
import { TABLES_START_WALLET } from '@/lib/tables/stakes'
import { useLadderStore } from '@/store/ladder-store'
import { CHECKPOINT_EVERY, LADDER_LIVES, LADDER_RUNGS, START_POT } from '@/lib/ladder/rules'
import { dailyDateKey, generateDailyChallenge, totalDailyBets } from '@/lib/daily/challenge'
import { dailyMultiplier, formatMultiplier } from '@/lib/daily/share'
import { useDailyStore } from '@/store/daily-store'
import { useFreeplayStore } from '@/store/freeplay-store'
import { GAMES } from '@/lib/game-catalog'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { SectionTitle, UnitTrack } from '@/components/ui/terminal'
import { PayoutCaption } from '@/components/game-payout'

interface ModeRowProps {
  name: string
  symbol: string
  description: string
  track: ReactNode
  trackCaption: ReactNode
  figureLabel: string
  figure: ReactNode
  figureSub?: ReactNode
  action: ReactNode
  index: number
}

/** One mode as a ledger row: what it is, where you are on its track, its money, the way in. */
function ModeRow({ name, symbol, description, track, trackCaption, figureLabel, figure, figureSub, action, index }: ModeRowProps) {
  return (
    <li
      className="rise group relative grid grid-cols-1 gap-4 px-4 py-5 transition-colors duration-300 hover:bg-[#17161c] sm:px-6 lg:grid-cols-[minmax(0,1fr)_220px_168px_148px] lg:items-center lg:gap-8"
      style={{ '--d': `${120 + index * 70}ms` } as CSSProperties}
    >
      {/* the felt edge that lights up on the row you are about to pick */}
      <span
        aria-hidden
        className="m-instant absolute bottom-4 left-0 top-4 w-[2px] origin-center scale-y-0 bg-felt shadow-[0_0_12px_rgba(79,174,132,0.9)] transition-transform duration-300 group-hover:scale-y-100"
      />
      <div className="min-w-0">
        <h2 className="flex items-baseline gap-2 text-[17px] font-semibold leading-snug text-ink">
          <span aria-hidden className="text-[15px] leading-none opacity-85">{symbol}</span>
          {name}
        </h2>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-5 text-dim">{description}</p>
      </div>
      <div className="flex flex-col gap-2">
        {track}
        <p className="text-xs tabular-nums text-soft">{trackCaption}</p>
      </div>
      <div className="flex items-baseline justify-between gap-3 lg:block lg:text-right">
        <p className="text-xs text-dim">{figureLabel}</p>
        <p className="num text-xl leading-7 text-ink lg:mt-0.5">{figure}</p>
        {figureSub && <p className="text-xs tabular-nums text-dim lg:mt-0.5">{figureSub}</p>}
      </div>
      <div className="lg:justify-self-end">{action}</div>
    </li>
  )
}

export function ModeSelect() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const survivalBankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const isMobile = useIsMobile()
  const hydrated = useHydrated()
  const dailyDate = useDailyStore((s) => s.date)
  const dailyHistory = useDailyStore((s) => s.history)
  const dailyProgress = useDailyStore((s) => s.progress)
  const dailyBankroll = useDailyStore((s) => s.bankroll)
  const dailyOpened = useDailyStore((s) => s.started)
  const ladderStatus = useLadderStore((s) => s.status)
  const ladderRung = useLadderStore((s) => s.rung)
  const ladderPot = useLadderStore((s) => s.pot)
  const ladderLives = useLadderStore((s) => s.lives)
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const tablesWallet = useTablesStore((s) => s.wallet)
  const tablesPlayed = useTablesStore((s) => s.history.length)
  const ladderClimbing = hydrated && ladderStatus === 'climbing'
  const survivalLive = hydrated && runActive

  // The home page is prerendered, so today's challenge is only known once mounted.
  const today = hydrated ? dailyDateKey() : null
  const challenge = today ? generateDailyChallenge(today) : null
  const todayRecord = today ? dailyHistory[today] : undefined
  const dailyIsToday = hydrated && dailyDate === today
  const dailyUsed = dailyIsToday ? Object.values(dailyProgress).reduce((sum, p) => sum + (p?.betsUsed ?? 0), 0) : 0
  const dailyTotal = challenge ? totalDailyBets(challenge) : 6
  const dailyStarted = dailyUsed > 0
  const dailyCta = todayRecord ? 'See results' : dailyStarted || (dailyIsToday && dailyOpened) ? 'Continue' : 'Play today'

  function handleSurvivalClick() {
    if (isMobile) return
    // The survival screen shows its intro (and the Start run button) when no run is live.
    router.push('/survival')
  }

  return (
    <div className="flex flex-col gap-12">
      <ul className="divide-y divide-rule overflow-hidden rounded-md bg-surface shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
        {/* ── Daily ── */}
        <ModeRow
          index={0}
          name={challenge ? `Daily #${challenge.number}` : 'Daily'}
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

        {/* ── Ladder ── */}
        {LADDER_ENABLED && (
          <ModeRow
            index={1}
            name="Ladder"
            symbol="🪜"
            description="Go all-in rung after rung. Any profit climbs, every game once per run; lose and you fall to the last checkpoint."
            track={
              <UnitTrack
                total={LADDER_RUNGS}
                done={ladderClimbing ? ladderRung : 0}
                current={ladderClimbing ? ladderRung : undefined}
                checkpointEvery={CHECKPOINT_EVERY}
                label={ladderClimbing ? `On rung ${ladderRung + 1} of ${LADDER_RUNGS}` : `${LADDER_RUNGS} rungs`}
              />
            }
            trackCaption={
              ladderClimbing
                ? `Rung ${ladderRung + 1}/${LADDER_RUNGS} · ${ladderLives} of ${LADDER_LIVES} lives`
                : `${LADDER_RUNGS} rungs · checkpoint every ${CHECKPOINT_EVERY}`
            }
            figureLabel={ladderClimbing ? 'Pot' : 'Starting pot'}
            figure={formatChips(ladderClimbing ? ladderPot : START_POT)}
            action={
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href="/ladder">{ladderClimbing ? 'Continue climb' : 'Start climb'}</Link>
              </Button>
            }
          />
        )}

        {/* ── Survival (toggle in lib/features.ts) ── */}
        {SURVIVAL_ENABLED && (
          <ModeRow
            index={2}
            name="Survival"
            symbol="🛡️"
            description={`Reach each floor's bankroll quota within ${FLOOR_BET_LIMIT} bets or the run ends. Sparks from each floor buy upgrades.`}
            track={
              <UnitTrack
                total={MAX_FLOORS}
                done={survivalLive ? currentFloor - 1 : 0}
                current={survivalLive ? Math.min(currentFloor, MAX_FLOORS) - 1 : undefined}
                label={survivalLive ? `On floor ${currentFloor} of ${MAX_FLOORS}` : `${MAX_FLOORS} floors`}
              />
            }
            trackCaption={
              survivalLive
                ? `Floor ${currentFloor}/${MAX_FLOORS} · ${FLOOR_BET_LIMIT} bets a floor`
                : `${MAX_FLOORS} floors · ${FLOOR_BET_LIMIT} bets a floor`
            }
            figureLabel={survivalLive ? 'Bankroll' : 'Starting bankroll'}
            figure={formatChips(survivalLive ? survivalBankroll : STARTING_BANKROLL)}
            figureSub={survivalLive ? `quota ${formatChips(quotaTarget)}` : undefined}
            action={
              <Button
                variant="outline"
                className="w-full lg:w-auto"
                onClick={handleSurvivalClick}
                onMouseEnter={() => !isMobile && router.prefetch('/survival')}
                disabled={isMobile}
              >
                {isMobile ? 'Desktop only' : survivalLive ? 'Continue run' : 'Start run'}
              </Button>
            }
          />
        )}

        {/* ── Tables (toggle in lib/features.ts) ── */}
        {TABLES_ENABLED && (
          <ModeRow
            index={3}
            name="Tables"
            symbol="🃏"
            description="Sit down with bots at Hold'em and Liar's Dice. Buy in, outlast the table, take the prize pool."
            track={<UnitTrack total={TABLE_GAMES.length} done={TABLE_GAMES.length} label={`${TABLE_GAMES.length} table games`} />}
            trackCaption={`${TABLE_GAMES.length} games · ${hydrated ? tablesPlayed : 0} tables played`}
            figureLabel="Wallet"
            figure={formatChips(hydrated ? tablesWallet : TABLES_START_WALLET)}
            action={
              <Button asChild variant="outline" className="w-full lg:w-auto">
                <Link href="/tables">Take a seat</Link>
              </Button>
            }
          />
        )}

        {/* ── Freeplay ── */}
        <ModeRow
          index={4}
          name="Freeplay"
          symbol="🎮"
          description="Every game, no floors and no quotas. Practise anything and reset your balance whenever you like."
          track={<UnitTrack total={GAMES.length} done={GAMES.length} label={`${GAMES.length} games open`} />}
          trackCaption={`${GAMES.length} games open`}
          figureLabel="Balance"
          figure={hydrated ? formatChips(freeplayBankroll) : '—'}
          action={
            <Button asChild variant="outline" className="w-full lg:w-auto">
              <Link href="/freeplay">Open lobby</Link>
            </Button>
          }
        />
      </ul>

      <section className="rise flex flex-col gap-4 [--d:420ms]" aria-labelledby="all-games">
        <SectionTitle note="Tap a game to learn how it plays">
          <span id="all-games">All {GAMES.length} games</span>
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <li key={g.name} className="border-t border-rule">
              <Link
                href={`/how-to-play/${g.name}`}
                className="m-instant group flex items-baseline justify-between gap-4 py-3 transition-[padding] duration-200 hover:pl-1.5"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">{g.symbol}</span>
                    <span className="mark-line text-[14px] font-medium text-ink">{g.label}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-dim">{g.sub}</span>
                </span>
                <PayoutCaption game={g.name} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
