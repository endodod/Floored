'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSurvivalStore } from '@/store/survival-store'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_ENABLED, SURVIVAL_ENABLED } from '@/lib/features'
import { useLadderStore } from '@/store/ladder-store'
import { LADDER_RUNGS, START_POT } from '@/lib/ladder/rules'
import { dailyDateKey, generateDailyChallenge, totalDailyBets } from '@/lib/daily/challenge'
import { dailyMultiplier, formatMultiplier } from '@/lib/daily/share'
import { useDailyStore } from '@/store/daily-store'
import { formatChips } from '@/utils/format'
import { DailyCountdown } from '@/components/daily/countdown'

const FELT = {
  backgroundImage:
    'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
  backgroundSize: '6px 6px',
}

const PLAY_ICON = (
  <svg viewBox="0 0 10 10" className="w-3 h-3 fill-white translate-x-px" aria-hidden>
    <polygon points="2,1 9,5 2,9" />
  </svg>
)

const LOCK_ICON = (
  <svg viewBox="0 0 12 12" className="w-3 h-3 fill-white/60" aria-hidden>
    <rect x="2" y="5" width="8" height="6" rx="1" />
    <path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1.2" fill="none" />
  </svg>
)

export function ModeSelect() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const startRun = useSurvivalStore((s) => s.startRun)
  const isMobile = useIsMobile()
  const hydrated = useHydrated()
  const dailyDate = useDailyStore((s) => s.date)
  const dailyHistory = useDailyStore((s) => s.history)
  const dailyProgress = useDailyStore((s) => s.progress)
  const ladderStatus = useLadderStore((s) => s.status)
  const ladderRung = useLadderStore((s) => s.rung)
  const ladderPot = useLadderStore((s) => s.pot)
  const ladderClimbing = hydrated && ladderStatus === 'climbing'

  // The home page is prerendered, so today's challenge is only known once mounted.
  const today = hydrated ? dailyDateKey() : null
  const challenge = today ? generateDailyChallenge(today) : null
  const todayRecord = today ? dailyHistory[today] : undefined
  const dailyStarted =
    hydrated && dailyDate === today && Object.values(dailyProgress).some((p) => (p?.betsUsed ?? 0) > 0)
  const dailyCta = todayRecord ? 'See results' : dailyStarted ? 'Continue' : 'Play today'

  function handleSurvivalClick() {
    if (isMobile) return
    // Difficulty picker is disabled for now — new runs always start on Normal.
    if (!runActive) startRun('normal')
    router.push('/survival')
  }

  return (
    <>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 w-full ${LADDER_ENABLED && SURVIVAL_ENABLED ? 'max-w-3xl' : 'lg:grid-cols-3 max-w-5xl'}`}>
        {/* ── Daily ── */}
        <Link
          href="/daily"
          className="relative overflow-hidden rounded-2xl border border-emerald-900/50 hover:border-emerald-600 bg-gradient-to-br from-emerald-950 to-teal-950 cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group transition-all duration-200 text-left"
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
          <div className="relative p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-3xl tracking-tight group-hover:scale-[1.04] origin-left transition-transform duration-200">
                Daily{challenge && ` #${challenge.number}`}
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                Same challenge for everyone. One attempt. Play every bet across three games without going under.
              </p>
            </div>

            <ul className="space-y-1.5">
              {[
                challenge ? `${formatChips(challenge.bankroll)} shared bankroll` : 'One shared bankroll',
                challenge ? `3 games · ${totalDailyBets(challenge)} bets total` : '3 random games',
                todayRecord
                  ? todayRecord.endReason === 'failed'
                    ? 'Today: 💀 Failed'
                    : `Today: ${formatChips(todayRecord.endBankroll)} (${formatMultiplier(dailyMultiplier(todayRecord))})`
                  : challenge
                    ? `Use every bet · min ${formatChips(challenge.minBet)}`
                    : 'One try per day',
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 flex-shrink-0" />
                  {text}
                </li>
              ))}
              <li className="flex items-center gap-2 text-white/50 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 flex-shrink-0" />
                New daily in&nbsp;<DailyCountdown />
              </li>
            </ul>

            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                {PLAY_ICON}
              </div>
              <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                {dailyCta}
              </span>
            </div>
          </div>
        </Link>

        {/* ── Ladder ── */}
        {LADDER_ENABLED && (
        <Link
          href="/ladder"
          className="relative overflow-hidden rounded-2xl border border-violet-900/60 hover:border-violet-500 bg-gradient-to-br from-violet-950 to-fuchsia-950 cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group transition-all duration-200 text-left"
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
          <div className="relative p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-3xl tracking-tight group-hover:scale-[1.04] origin-left transition-transform duration-200">
                Ladder
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                Go all-in rung after rung. Profit climbs a rung, every game once per run — lose and fall to your last checkpoint.
              </p>
            </div>

            <ul className="space-y-1.5">
              {[
                `${formatChips(START_POT)} pot, ${LADDER_RUNGS} rungs`,
                'Checkpoint every 3 rungs',
                '3 lives · cash out any time',
                ladderClimbing ? `Current: rung ${ladderRung} · ${formatChips(ladderPot)}` : 'Each game usable once',
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                {PLAY_ICON}
              </div>
              <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                {ladderClimbing ? 'Continue climb' : 'Play now'}
              </span>
            </div>
          </div>
        </Link>
        )}

        {/* ── Survival (toggle in lib/features.ts) ── */}
        {SURVIVAL_ENABLED && (
        <button
          type="button"
          onClick={handleSurvivalClick}
          onMouseEnter={() => !isMobile && router.prefetch('/survival')}
          disabled={isMobile}
          aria-disabled={isMobile}
          className={[
            'relative overflow-hidden rounded-2xl border transition-all duration-200 text-left',
            isMobile
              ? 'border-amber-900/20 bg-gradient-to-br from-amber-950/40 to-red-950/40 opacity-50 cursor-not-allowed'
              : 'border-amber-900/50 hover:border-amber-600 bg-gradient-to-br from-amber-950 to-red-950 cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group',
          ].join(' ')}
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />

          <div className="relative p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-3xl tracking-tight group-hover:scale-[1.04] origin-left transition-transform duration-200">
                Survival
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                {isMobile
                  ? 'Not available on mobile — open this on a larger screen to play.'
                  : <>Hit each floor&apos;s bankroll quota within {FLOOR_BET_LIMIT} bets — or the run ends.</>}
              </p>
            </div>

            <ul className="space-y-1.5">
              {[
                '1,000 starting chips',
                `${FLOOR_BET_LIMIT} bets per floor`,
                'Floor min bet rises each level',
                'Earn Sparks for upgrades',
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                {isMobile ? LOCK_ICON : PLAY_ICON}
              </div>
              <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                {isMobile ? 'Desktop only' : runActive ? 'Continue run' : 'Play now'}
              </span>
            </div>
          </div>
        </button>
        )}

        {/* ── Freeplay ── */}
        <Link
          href="/freeplay"
          className="relative overflow-hidden rounded-2xl border border-blue-900 hover:border-blue-600 bg-gradient-to-br from-slate-900 to-blue-950 cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group transition-all duration-200 text-left"
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
          <div className="relative p-6 flex flex-col gap-5">
            <div>
              <p className="text-white font-black text-3xl tracking-tight group-hover:scale-[1.04] origin-left transition-transform duration-200">
                Freeplay
              </p>
              <p className="text-white/40 text-xs mt-1.5">
                All games, no floors, no quotas. 10,000 chips to start.
              </p>
            </div>

            <ul className="space-y-1.5">
              {[
                'No floors or quotas',
                'No economy, no stakes',
                'Practice any game',
                'Infinite reset',
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-white/50 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                {PLAY_ICON}
              </div>
              <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                Play now
              </span>
            </div>
          </div>
        </Link>
      </div>
    </>
  )
}
