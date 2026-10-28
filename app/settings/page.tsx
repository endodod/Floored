'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { LADDER_ENABLED, SURVIVAL_ENABLED } from '@/lib/features'
import { useLadderStore } from '@/store/ladder-store'
import { ladderStats } from '@/lib/ladder/share'
import { useDailyStore } from '@/store/daily-store'
import { bestMultiplier, currentStreak, formatMultiplier } from '@/lib/daily/share'
import { dailyDateKey } from '@/lib/daily/challenge'
import { useHydrated } from '@/hooks/use-hydrated'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSettingsStore } from '@/store/settings-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips, parseChips } from '@/utils/format'
import { allPurchasedUpgradesForDev } from '@/lib/survival/upgrades-catalog'

const SECTION_TITLE = 'text-[10px] font-semibold uppercase tracking-wider mb-3'

function toggleTrack(on: boolean) {
  return `relative h-4 w-7 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-emerald-500' : 'bg-white/20'}`
}
function toggleDot(on: boolean) {
  return `absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-[13px]' : 'translate-x-0.5'}`
}

function Section({
  border,
  children,
}: {
  border: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border ${border} bg-zinc-900/60 p-5`}>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/25 border border-white/5 px-3 py-2">
      <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-white tabular-nums">{value}</p>
    </div>
  )
}

export default function SettingsPage() {
  const hydrated = useHydrated()
  const dailyHistory = useDailyStore((s) => s.history)
  const dailyRecords = Object.values(dailyHistory)
  const bestDaily = bestMultiplier(dailyHistory)
  const ladder = ladderStats(useLadderStore((s) => s.history))
  const freeplayPeakBankroll = useFreeplayStore((s) => s.peakBankroll)
  const freeplayResetCount = useFreeplayStore((s) => s.resetCount)
  const {
    autoReBet, setAutoReBet,
    forceTie, setForceTie,
    showAllGames, setShowAllGames,
    devModeUnlocked, setDevModeUnlocked,
    devInfiniteBets, setDevInfiniteBets,
  } = useSettingsStore()

  const cursed = useSurvivalStore((s) => s.cursed)
  const setCursed = useSurvivalStore((s) => s.setCursed)
  const blessed = useSurvivalStore((s) => s.blessed)
  const setBlessed = useSurvivalStore((s) => s.setBlessed)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const survivalHighscore = useSurvivalStore((s) => s.survivalHighscore)
  const survivalWinCount = useSurvivalStore((s) => s.survivalWinCount)
  const sparks = useSurvivalStore((s) => s.sparks)
  const setBankroll = useSurvivalStore((s) => s.setBankroll)
  const setSparks = useSurvivalStore((s) => s.setSparks)
  const devSetPurchasedUpgrades = useSurvivalStore((s) => s.devSetPurchasedUpgrades)

  const [devPassword, setDevPassword] = useState('')
  const [devPasswordError, setDevPasswordError] = useState(false)
  const [devBankroll, setDevBankroll] = useState('')
  const [devSparks, setDevSparks] = useState('')

  const handleDevUnlock = useCallback(() => {
    if (devPassword.toLowerCase() === 'geek') {
      setDevModeUnlocked(true)
      setDevPassword('')
      setDevPasswordError(false)
    } else {
      setDevPasswordError(true)
      setTimeout(() => setDevPasswordError(false), 1000)
    }
  }, [devPassword, setDevModeUnlocked])

  return (
    <div className="max-w-2xl mx-auto w-full space-y-5 py-2">
      <div className="mb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white/90 transition-colors mb-3"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          Home
        </Link>
        <h1 className="text-4xl sm:text-5xl font-black tracking-[0.06em] uppercase text-white leading-none">
          Settings
        </h1>
        <p className="text-white/30 text-[10px] tracking-[0.25em] uppercase mt-2">
          Stats &middot; Settings
        </p>
      </div>

      <Section border="border-emerald-900/50">
        <p className={`${SECTION_TITLE} text-emerald-300/70`}>Stats</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Dailies Played" value={hydrated ? String(dailyRecords.length) : '–'} />
          <Stat label="Daily Streak" value={hydrated ? String(currentStreak(dailyHistory, dailyDateKey())) : '–'} />
          <Stat label="Best Daily" value={hydrated && bestDaily > 0 ? formatMultiplier(bestDaily) : '–'} />
          {LADDER_ENABLED && (
            <>
              <Stat label="Best Ladder Pot" value={hydrated && ladder.runs > 0 ? formatChips(ladder.bestPot) : '–'} />
              <Stat label="Highest Rung · Tops" value={hydrated ? `${ladder.bestRung} · ${ladder.tops}` : '–'} />
            </>
          )}
          <Stat label="Peak Freeplay Bankroll" value={formatChips(freeplayPeakBankroll)} />
          <Stat label="Freeplay Resets" value={String(freeplayResetCount)} />
          {SURVIVAL_ENABLED && (
            <>
              <Stat label="Survival Highscore" value={`Floor ${survivalHighscore}`} />
              <Stat label="Survival Wins" value={String(survivalWinCount)} />
            </>
          )}
        </div>
      </Section>

      <Section border="border-indigo-900/50">
        <p className={`${SECTION_TITLE} text-indigo-300/70`}>Settings</p>
        <button
          type="button"
          onClick={() => setAutoReBet(!autoReBet)}
          className="flex w-full items-center justify-between gap-3 py-1.5 text-left"
        >
          <span className="text-sm text-white/80">Auto re-bet</span>
          <div className={toggleTrack(autoReBet)}>
            <div className={toggleDot(autoReBet)} />
          </div>
        </button>
      </Section>

      <Section border="border-yellow-900/40">
        <div className="flex items-center justify-between mb-3">
          <p className={`${SECTION_TITLE} mb-0 text-yellow-500/70`}>Dev Mode</p>
          {devModeUnlocked && (
            <button
              type="button"
              onClick={() => { setDevModeUnlocked(false); setForceTie(false); setShowAllGames(false); setCursed(false); setBlessed(false); setDevInfiniteBets(false) }}
              className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              Lock
            </button>
          )}
        </div>

        {devModeUnlocked ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setForceTie(!forceTie)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="text-sm text-white/80">Force tie <span className="text-white/30 text-xs">(HiLo, not in Daily)</span></span>
              <div className={toggleTrack(forceTie)}><div className={toggleDot(forceTie)} /></div>
            </button>
            {SURVIVAL_ENABLED && (<>
            <button
              type="button"
              onClick={() => setShowAllGames(!showAllGames)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="text-sm text-white/80">All games <span className="text-white/30 text-xs">(survival)</span></span>
              <div className={toggleTrack(showAllGames)}><div className={toggleDot(showAllGames)} /></div>
            </button>
            <button
              type="button"
              onClick={() => setDevInfiniteBets(!devInfiniteBets)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="text-sm text-white/80">Infinite bets <span className="text-white/30 text-xs">(survival)</span></span>
              <div className={toggleTrack(devInfiniteBets)}><div className={toggleDot(devInfiniteBets)} /></div>
            </button>
            </>)}

            <div className="flex w-full items-center justify-between gap-3 py-2">
              <span className="text-sm text-white/80">Game mode <span className="text-white/30 text-xs">(not in Daily)</span></span>
              <div className="relative flex h-5 w-16 shrink-0 rounded-full border border-white/10 bg-white/5 overflow-hidden">
                <div
                  className="absolute top-0 h-full w-1/3 rounded-full transition-all duration-200"
                  style={{
                    transform: `translateX(${cursed ? '0%' : blessed ? '200%' : '100%'})`,
                    backgroundColor: cursed ? '#9333ea' : blessed ? '#10b981' : 'rgba(255,255,255,0.2)',
                  }}
                />
                <button type="button" onClick={() => { setCursed(true); setBlessed(false) }} className={`relative z-10 flex-1 text-[10px] font-black transition-colors ${cursed ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>C</button>
                <button type="button" onClick={() => { setCursed(false); setBlessed(false) }} className={`relative z-10 flex-1 text-[10px] font-black transition-colors ${!cursed && !blessed ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>N</button>
                <button type="button" onClick={() => { setCursed(false); setBlessed(true) }} className={`relative z-10 flex-1 text-[10px] font-black transition-colors ${blessed ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>B</button>
              </div>
            </div>

            {SURVIVAL_ENABLED && (<>
            <div className="flex items-center gap-1.5 py-2">
              <span className="text-sm text-white/80 shrink-0">Bankroll</span>
              <input
                type="text"
                value={devBankroll}
                onChange={(e) => setDevBankroll(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseChips(devBankroll); if (n !== null && n > 0) { setBankroll(n); setDevBankroll('') } } }}
                placeholder={formatChips(bankroll)}
                className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/20 outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => { const n = parseChips(devBankroll); if (n !== null && n > 0) { setBankroll(n); setDevBankroll('') } }}
                className="shrink-0 px-2 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
              >Set</button>
            </div>

            <div className="flex items-center gap-1.5 py-2">
              <span className="text-sm text-white/80 shrink-0">Sparks</span>
              <input
                type="text"
                value={devSparks}
                onChange={(e) => setDevSparks(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseChips(devSparks); if (n !== null && n >= 0) { setSparks(n); setDevSparks('') } } }}
                placeholder={formatChips(sparks)}
                className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/20 outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => { const n = parseChips(devSparks); if (n !== null && n >= 0) { setSparks(n); setDevSparks('') } }}
                className="shrink-0 px-2 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
              >Set</button>
            </div>

            <div className="flex items-center gap-1.5 py-2">
              <span className="text-sm text-white/80 shrink-0">Upgrades</span>
              <button
                type="button"
                onClick={() => devSetPurchasedUpgrades(allPurchasedUpgradesForDev())}
                className="flex-1 py-1 text-xs font-semibold bg-emerald-900/60 hover:bg-emerald-800/60 border border-emerald-700/40 text-emerald-300 rounded transition-colors"
              >Grant All</button>
              <button
                type="button"
                onClick={() => devSetPurchasedUpgrades([])}
                className="flex-1 py-1 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 rounded transition-colors"
              >Clear</button>
            </div>
            </>)}
          </div>
        ) : (
          <div className="flex gap-1.5">
            <input
              type="password"
              value={devPassword}
              onChange={(e) => setDevPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDevUnlock()}
              placeholder="Password"
              className={`min-w-0 flex-1 bg-white/5 border rounded px-2 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors ${devPasswordError ? 'border-red-500' : 'border-white/10'}`}
            />
            <button
              type="button"
              onClick={handleDevUnlock}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
            >
              Unlock
            </button>
          </div>
        )}
      </Section>

    </div>
  )
}
