'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, User, X, Volume2, VolumeX } from 'lucide-react'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import { LADDER_ENABLED, SURVIVAL_ENABLED, TABLES_ENABLED } from '@/lib/features'
import { useTablesStore } from '@/store/tables-store'
import { useLadderStore } from '@/store/ladder-store'
import { useDailyStore } from '@/store/daily-store'
import { FlooredMark } from '@/components/ui/terminal'
import { useSettingsStore } from '@/store/settings-store'

const MODES = [
  { href: '/daily', label: 'Daily', enabled: true },
  { href: '/ladder', label: 'Ladder', enabled: LADDER_ENABLED },
  { href: '/survival', label: 'Survival', enabled: SURVIVAL_ENABLED },
  { href: '/tables', label: 'Tables', enabled: TABLES_ENABLED },
  { href: '/freeplay', label: 'Freeplay', enabled: true },
].filter((m) => m.enabled)

/** Remembers the last value and returns a class that flashes the direction it just moved. */
function useTick(value: number): string {
  const prev = useRef(value)
  const [tick, setTick] = useState<{ cls: string; n: number }>({ cls: '', n: 0 })
  useEffect(() => {
    if (value !== prev.current) {
      setTick((t) => ({ cls: value > prev.current ? 'tick-up' : 'tick-down', n: t.n + 1 }))
      prev.current = value
    }
  }, [value])
  return tick.cls ? `${tick.cls} k${tick.n % 2}` : ''
}

/** The mode's money, always in the same place: grey label, mono figure that flashes when it moves. */
function BarFigure({ label, value }: { label: string; value: number }) {
  const tick = useTick(value)
  return (
    <p className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="hidden text-xs text-dim md:inline tall:text-[13px]">{label}</span>
      {/* key re-mounts the span so the flash replays on every change */}
      <span key={tick} className={`num text-sm text-ink tall:text-base ${tick}`}>
        {formatChips(value)}
      </span>
    </p>
  )
}

export function Navbar() {
  const pathname = usePathname() ?? '/'
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const tablesWallet = useTablesStore((s) => s.wallet)
  const dailyBankroll = useDailyStore((s) => s.bankroll)
  const ladderPot = useLadderStore((s) => s.pot)
  const ladderStatus = useLadderStore((s) => s.status)
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)
  const [menuOpen, setMenuOpen] = useState(false)
  const [soundOpen, setSoundOpen] = useState(false)
  const uiSoundsEnabled = useSettingsStore((s) => s.uiSoundsEnabled)
  const gameSoundsEnabled = useSettingsStore((s) => s.gameSoundsEnabled)
  const musicEnabled = useSettingsStore((s) => s.musicEnabled)
  const soundVolume = useSettingsStore((s) => s.soundVolume)
  const musicVolume = useSettingsStore((s) => s.musicVolume)
  const setUiSoundsEnabled = useSettingsStore((s) => s.setUiSoundsEnabled)
  const setGameSoundsEnabled = useSettingsStore((s) => s.setGameSoundsEnabled)
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled)
  const setSoundVolume = useSettingsStore((s) => s.setSoundVolume)
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume)
  const anyAudioEnabled = uiSoundsEnabled || gameSoundsEnabled || musicEnabled
  const soundToggles = [
    { label: 'Interface sounds', enabled: uiSoundsEnabled, set: setUiSoundsEnabled },
    { label: 'Game sounds', enabled: gameSoundsEnabled, set: setGameSoundsEnabled },
    { label: 'Casino music', enabled: musicEnabled, set: setMusicEnabled },
  ]

  const inFreeplay = pathname.startsWith('/freeplay')
  const inDaily = pathname.startsWith('/daily')
  const inLadder = pathname.startsWith('/ladder')
  const inTables = pathname.startsWith('/tables')
  const inAccount = pathname.startsWith('/account')
  const inSurvivalGame = pathname.startsWith('/survival/')

  // Stores are persisted to localStorage, so their values are only known after the
  // client has mounted — gate on that to avoid an SSR/client hydration mismatch.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  useEffect(() => setMenuOpen(false), [pathname])

  const showSurvivalHud = hydrated && inSurvivalGame && runActive
  const current = MODES.find((m) => pathname.startsWith(m.href))?.label ?? (inAccount ? 'Account' : null)

  let figure: React.ReactNode = null
  if (hydrated && inDaily) figure = <BarFigure label="Daily bankroll" value={dailyBankroll} />
  else if (hydrated && inLadder && ladderStatus === 'climbing') figure = <BarFigure label="Pot" value={ladderPot} />
  else if (hydrated && inTables) figure = <BarFigure label="Wallet" value={tablesWallet} />
  else if (hydrated && inFreeplay) figure = <BarFigure label="Balance" value={freeplayBankroll} />

  return (
    <>
      <nav className="site-nav sticky top-0 z-50 shrink-0 border-b border-[rgba(217,164,65,0.22)] bg-[rgba(14,21,16,0.88)] shadow-[0_8px_28px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className="container mx-auto flex h-12 items-center gap-4 px-4 sm:gap-6 sm:px-6 tall:h-16 sm:tall:gap-8">
          <Link href="/" className="group flex shrink-0 items-center gap-2 text-ink" aria-label="Floored, home">
            <FlooredMark className="m-still transition-transform duration-300 group-hover:-rotate-6 tall:h-6 tall:w-6" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] tall:text-lg">Floored</span>
          </Link>

          {current && <span className="text-[13px] text-dim sm:hidden tall:text-sm">{current}</span>}

          <div className="hidden h-12 items-stretch gap-6 sm:flex tall:h-16 tall:gap-8">
            {MODES.map((m) => {
              const active = pathname.startsWith(m.href)
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  aria-current={active ? 'page' : undefined}
                  data-active={active}
                  className={`mark-line flex items-center text-[13px] font-medium transition-colors tall:text-[15px] ${
                    active ? 'text-ink' : 'text-dim hover:text-ink'
                  }`}
                >
                  {m.label}
                </Link>
              )
            })}
          </div>

          {/* Survival in-game bankroll and bets — below lg the game's sidebar is hidden, so they live here. */}
          <div className="flex min-w-0 flex-1 items-center justify-center lg:hidden">
            {showSurvivalHud && (
              <p className="num flex items-baseline gap-3 whitespace-nowrap text-[13px] tall:text-sm">
                <span>
                  <span className={bankroll >= quotaTarget ? 'text-felt glow-felt' : 'text-loss'}>{formatChips(bankroll)}</span>
                  <span className="text-dim"> / {formatChips(quotaTarget)}</span>
                </span>
                <span>
                  <span className="text-ink">{floorBetsPlaced}</span>
                  <span className="text-dim"> / {FLOOR_BET_LIMIT} bets</span>
                </span>
              </p>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-4 lg:ml-0 lg:flex-1 lg:justify-end">
            {figure}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSoundOpen((open) => !open)}
                aria-label="Sound settings"
                aria-expanded={soundOpen}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-control text-soft transition-colors hover:border-dim hover:text-ink tall:h-10 tall:w-10"
              >
                {anyAudioEnabled ? <Volume2 className="h-4 w-4" strokeWidth={1.6} /> : <VolumeX className="h-4 w-4" strokeWidth={1.6} />}
              </button>
              {soundOpen && (
                <div className="absolute right-0 top-full z-[70] mt-2 w-72 rounded-md border border-line bg-surface p-4 shadow-xl" role="group" aria-label="Sound settings">
                  {soundToggles.map(({ label, enabled, set }) => {
                    const on = enabled
                    return (
                      <div key={label} className="flex items-center justify-between gap-3 py-1.5">
                        <p className="text-[13px] font-medium text-ink">{label}</p>
                        <button type="button" role="switch" aria-checked={on} aria-label={`Enable ${label.toLowerCase()}`} onClick={() => set(!on)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-felt' : 'bg-control'}`}>
                          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${on ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>
                    )
                  })}
                  <label className={`mt-3 flex items-center gap-3 text-xs text-soft ${gameSoundsEnabled ? '' : 'opacity-40'}`}>
                    <span>Effects</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={soundVolume}
                      disabled={!gameSoundsEnabled}
                      aria-label="Game sound volume"
                      onChange={(event) => setSoundVolume(Number(event.currentTarget.value))}
                      className="w-full accent-[#4fae84]"
                    />
                    <span className="num w-8 text-right">{Math.round(soundVolume * 100)}%</span>
                  </label>
                  <label className={`mt-3 flex items-center gap-3 text-xs text-soft ${musicEnabled ? '' : 'opacity-40'}`}>
                    <span>Music</span>
                    <input type="range" min="0" max="1" step="0.01" value={musicVolume} disabled={!musicEnabled} aria-label="Music volume" onChange={(event) => setMusicVolume(Number(event.currentTarget.value))} className="w-full accent-[#4fae84]" />
                    <span className="num w-8 text-right">{Math.round(musicVolume * 100)}%</span>
                  </label>
                </div>
              )}
            </div>
            <Link
              href="/account"
              aria-label="Account"
              aria-current={inAccount ? 'page' : undefined}
              className={`hidden h-8 w-8 items-center justify-center rounded-full border transition-colors sm:flex tall:h-10 tall:w-10 ${
                inAccount ? 'border-felt text-ink' : 'border-control text-soft hover:border-dim hover:text-ink'
              }`}
            >
              <User className="h-4 w-4 tall:h-5 tall:w-5" strokeWidth={1.5} />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="-mr-2 flex h-10 w-10 items-center justify-center text-soft sm:hidden"
            >
              <Menu className="h-5 w-5 tall:h-6 tall:w-6" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="sheet-in fixed inset-0 z-[60] flex flex-col bg-ground sm:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-12 items-center justify-between border-b border-line px-4 tall:h-16">
            <Link href="/" className="flex items-center gap-2 text-ink">
              <FlooredMark className="tall:h-6 tall:w-6" />
              <span className="text-[15px] font-semibold tall:text-lg">Floored</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="-mr-2 flex h-10 w-10 items-center justify-center text-soft"
            >
              <X className="h-5 w-5 tall:h-6 tall:w-6" strokeWidth={1.5} />
            </button>
          </div>
          <ul className="flex flex-col px-4 py-2">
            {[{ href: '/', label: 'Home' }, ...MODES, { href: '/account', label: 'Account' }].map((m) => {
              const active = m.href === '/' ? pathname === '/' : pathname.startsWith(m.href)
              const desktopOnly = m.href === '/survival'
              return (
                <li key={m.href} className="border-b border-rule">
                  {desktopOnly ? (
                    <span className="flex h-14 items-center justify-between text-lg text-dim">
                      {m.label}
                      <span className="text-xs">Desktop only</span>
                    </span>
                  ) : (
                    <Link
                      href={m.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-14 items-center text-lg ${active ? 'text-ink' : 'text-soft'}`}
                    >
                      <span className="mark-line" data-active={active}>
                        {m.label}
                      </span>
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
