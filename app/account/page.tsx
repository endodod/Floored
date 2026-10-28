'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth/client'
import { LADDER_ENABLED } from '@/lib/features'
import { useLadderStore } from '@/store/ladder-store'
import { ladderStats } from '@/lib/ladder/share'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSettingsStore } from '@/store/settings-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips, parseChips } from '@/utils/format'
import { allPurchasedUpgradesForDev } from '@/lib/survival/upgrades-catalog'
import { useDailyStore } from '@/store/daily-store'
import { bestMultiplier, currentStreak, formatMultiplier } from '@/lib/daily/share'
import { dailyDateKey } from '@/lib/daily/challenge'
import { useHydrated } from '@/hooks/use-hydrated'
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

function Toggle({ on, label, note, onToggle }: { on: boolean; label: string; note?: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 py-2.5 text-left"
    >
      <span className="text-[13px] text-ink">
        {label}
        {note && <span className="ml-1.5 text-dim">{note}</span>}
      </span>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? 'bg-felt shadow-[0_0_12px_rgba(79,174,132,0.7)]' : 'bg-control'}`}>
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-transform duration-200 ${on ? 'translate-x-[13px]' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  )
}

/** A settings section: its name and purpose on the left, its panel on the right. */
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-t border-line py-8 first:border-t-0 first:pt-0 md:grid-cols-[280px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-dim">{description}</p>
      </div>
      <div className="rounded-md bg-surface p-5">{children}</div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-dim">{label}</dt>
      <dd className="num text-[14px] text-ink">{value}</dd>
    </div>
  )
}

const FIELD =
  'h-[34px] min-w-0 flex-1 rounded-md border border-control bg-ground px-3 text-[13px] text-ink placeholder:text-dim outline-none focus:border-felt'

interface ServerRunStats {
  highscore: number
  wins: number
  totalRuns: number
}

export default function AccountPage() {
  const session = authClient.useSession()
  const [serverStats, setServerStats] = useState<ServerRunStats | null>(null)

  useEffect(() => {
    if (!session.data?.user) {
      setServerStats(null)
      return
    }
    let cancelled = false
    fetch('/api/run')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ServerRunStats | null) => { if (!cancelled) setServerStats(data) })
      .catch(() => { if (!cancelled) setServerStats(null) })
    return () => { cancelled = true }
  }, [session.data?.user])

  const freeplayPeakBankroll = useFreeplayStore((s) => s.peakBankroll)
  const freeplayResetCount = useFreeplayStore((s) => s.resetCount)
  const hydrated = useHydrated()
  const dailyHistory = useDailyStore((s) => s.history)
  const dailiesPlayed = Object.keys(dailyHistory).length
  const bestDaily = bestMultiplier(dailyHistory)
  const ladder = ladderStats(useLadderStore((s) => s.history))
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
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)

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
    <div className="mx-auto w-full max-w-[1152px] pb-12">
      <PageTitle title="Account" sub="Your sign-in, your records across every mode, and settings." className="mb-8" />

      <Section title="Sign-in" description="Optional. Signed in, your survival runs sync to your account.">
        {session.isPending ? (
          <p className="text-[13px] text-dim">Checking your session…</p>
        ) : session.data ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">
                {session.data.user.name || session.data.user.email}
              </p>
              <p className="truncate text-[13px] text-dim">{session.data.user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSignOutConfirmOpen(true)}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-soft">You are playing as a guest.</p>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth/sign-up">Create account</Link>
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Records"
        description={
          session.data?.user
            ? serverStats
              ? `Survival figures synced from your account · ${serverStats.totalRuns} run${serverStats.totalRuns === 1 ? '' : 's'} recorded.`
              : 'Loading your synced survival figures…'
            : 'Kept in this browser. Sign in to keep survival runs across devices.'
        }
      >
        <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 [&>div]:border-b [&>div]:border-rule">
          <Stat label="Dailies played" value={hydrated ? String(dailiesPlayed) : '—'} />
          <Stat label="Daily streak" value={hydrated ? `${currentStreak(dailyHistory, dailyDateKey())} days` : '—'} />
          <Stat label="Best daily" value={hydrated && bestDaily > 0 ? formatMultiplier(bestDaily) : '—'} />
          <Stat label="Peak freeplay balance" value={formatChips(freeplayPeakBankroll)} />
          <Stat label="Freeplay resets" value={String(freeplayResetCount)} />
          {LADDER_ENABLED && (
            <>
              <Stat label="Best ladder pot" value={hydrated && ladder.runs > 0 ? formatChips(ladder.bestPot) : '—'} />
              <Stat label="Highest rung · tops" value={hydrated ? `${ladder.bestRung} · ${ladder.tops}` : '—'} />
            </>
          )}
          <Stat label="Survival best floor" value={String(serverStats ? serverStats.highscore : survivalHighscore)} />
          <Stat label="Survival wins" value={String(serverStats ? serverStats.wins : survivalWinCount)} />
        </dl>
      </Section>

      <Section title="Settings" description="How the tables behave between rounds.">
        <Toggle on={autoReBet} label="Auto re-bet" note="repeat your last stake" onToggle={() => setAutoReBet(!autoReBet)} />
      </Section>

      <Section title="Dev mode" description="Testing switches for the survival run. Locked behind a password.">
        {devModeUnlocked ? (
          <div className="flex flex-col divide-y divide-rule">
            <Toggle on={forceTie} label="Force tie" note="HiLo, not in Daily" onToggle={() => setForceTie(!forceTie)} />
            <Toggle on={showAllGames} label="All games" note="survival" onToggle={() => setShowAllGames(!showAllGames)} />
            <Toggle on={devInfiniteBets} label="Infinite bets" note="survival" onToggle={() => setDevInfiniteBets(!devInfiniteBets)} />

            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[13px] text-ink">
                Luck <span className="ml-1.5 text-dim">not in Daily</span>
              </span>
              <div className="flex gap-4" role="radiogroup" aria-label="Luck">
                {[
                  { key: 'cursed', label: 'Cursed', on: cursed, set: () => { setCursed(true); setBlessed(false) } },
                  { key: 'normal', label: 'Normal', on: !cursed && !blessed, set: () => { setCursed(false); setBlessed(false) } },
                  { key: 'blessed', label: 'Blessed', on: blessed, set: () => { setCursed(false); setBlessed(true) } },
                ].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={o.on}
                    data-active={o.on}
                    onClick={o.set}
                    className={`mark-line text-[13px] ${o.on ? 'text-ink' : 'text-dim hover:text-ink'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 py-2.5">
              <span className="w-20 shrink-0 text-[13px] text-ink">Bankroll</span>
              <input
                type="text"
                value={devBankroll}
                onChange={(e) => setDevBankroll(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseChips(devBankroll); if (n !== null && n > 0) { setBankroll(n); setDevBankroll('') } } }}
                placeholder={formatChips(bankroll)}
                className={FIELD}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => { const n = parseChips(devBankroll); if (n !== null && n > 0) { setBankroll(n); setDevBankroll('') } }}
              >
                Set
              </Button>
            </label>

            <label className="flex items-center gap-3 py-2.5">
              <span className="w-20 shrink-0 text-[13px] text-ink">Sparks</span>
              <input
                type="text"
                value={devSparks}
                onChange={(e) => setDevSparks(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseChips(devSparks); if (n !== null && n >= 0) { setSparks(n); setDevSparks('') } } }}
                placeholder={formatChips(sparks)}
                className={FIELD}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => { const n = parseChips(devSparks); if (n !== null && n >= 0) { setSparks(n); setDevSparks('') } }}
              >
                Set
              </Button>
            </label>

            <div className="flex items-center gap-3 py-2.5">
              <span className="w-20 shrink-0 text-[13px] text-ink">Upgrades</span>
              <Button variant="outline" size="sm" onClick={() => devSetPurchasedUpgrades(allPurchasedUpgradesForDev())}>
                Grant all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => devSetPurchasedUpgrades([])}>
                Clear
              </Button>
            </div>

            <div className="pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDevModeUnlocked(false); setForceTie(false); setShowAllGames(false); setCursed(false); setBlessed(false); setDevInfiniteBets(false) }}
              >
                Lock dev mode
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              aria-label="Dev mode password"
              value={devPassword}
              onChange={(e) => setDevPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDevUnlock()}
              placeholder="Password"
              className={`${FIELD} ${devPasswordError ? 'border-loss' : ''}`}
            />
            <Button variant="outline" onClick={handleDevUnlock}>
              Unlock
            </Button>
          </div>
        )}
      </Section>

      <Dialog open={signOutConfirmOpen} onOpenChange={setSignOutConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>You&apos;ll need to sign in again to access your account.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setSignOutConfirmOpen(false)
                authClient.signOut()
              }}
            >
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
