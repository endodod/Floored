'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth/client'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSettingsStore } from '@/store/settings-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips, parseChips } from '@/utils/format'
import { allPurchasedUpgradesForDev } from '@/lib/survival/upgrades-catalog'

const FELT = {
  backgroundImage:
    'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
  backgroundSize: '6px 6px',
}

const SECTION_TITLE = 'text-[10px] font-semibold uppercase tracking-wider mb-3'

function toggleTrack(on: boolean) {
  return `relative h-4 w-7 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-emerald-500' : 'bg-white/20'}`
}
function toggleDot(on: boolean) {
  return `absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-[13px]' : 'translate-x-0.5'}`
}

function Section({
  glyph,
  gradient,
  border,
  children,
}: {
  glyph: string
  gradient: string
  border: string
  children: React.ReactNode
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-5`}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
      <span
        className="absolute -right-4 -top-6 text-8xl leading-none select-none pointer-events-none opacity-[0.06]"
        aria-hidden
      >
        {glyph}
      </span>
      <div className="relative">{children}</div>
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

export default function AccountPage() {
  const session = authClient.useSession()

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
        <h1 className="text-4xl sm:text-5xl font-black tracking-[0.06em] uppercase text-white leading-none">
          Account
        </h1>
        <p className="text-white/30 text-[10px] tracking-[0.25em] uppercase mt-2">
          Profile &middot; Stats &middot; Settings
        </p>
      </div>

      <Section glyph="♠" gradient="from-violet-950 to-fuchsia-950/60" border="border-violet-900/50">
        <p className={`${SECTION_TITLE} text-violet-300/70`}>Account</p>
        {session.isPending ? (
          <p className="text-sm text-white/50">Loading…</p>
        ) : session.data ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {session.data.user.name || session.data.user.email}
              </p>
              <p className="text-xs text-white/40 truncate">{session.data.user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => authClient.signOut()}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/auth/sign-in"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/sign-up"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-zinc-900 hover:bg-white/90 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        )}
      </Section>

      <Section glyph="♦" gradient="from-emerald-950 to-teal-950/60" border="border-emerald-900/50">
        <p className={`${SECTION_TITLE} text-emerald-300/70`}>Stats</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Peak Freeplay Bankroll" value={formatChips(freeplayPeakBankroll)} />
          <Stat label="Freeplay Resets" value={String(freeplayResetCount)} />
          <Stat label="Survival Highscore" value={`Floor ${survivalHighscore}`} />
          <Stat label="Survival Wins" value={String(survivalWinCount)} />
        </div>
      </Section>

      <Section glyph="♣" gradient="from-indigo-950 to-slate-950/60" border="border-indigo-900/50">
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

      <Section glyph="⚙" gradient="from-yellow-950/70 to-zinc-950" border="border-yellow-900/40">
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
              <span className="text-sm text-white/80">Force tie <span className="text-white/30 text-xs">(HiLo)</span></span>
              <div className={toggleTrack(forceTie)}><div className={toggleDot(forceTie)} /></div>
            </button>
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

            <div className="flex w-full items-center justify-between gap-3 py-2">
              <span className="text-sm text-white/80">Game mode</span>
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
