'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { SignedIn, SignedOut, UserButton } from '@neondatabase/auth/react/ui'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSettingsStore } from '@/store/settings-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips, parseChips } from '@/utils/format'
import { allPurchasedUpgradesForDev } from '@/lib/survival/upgrades-catalog'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'

const HUD_PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

export function Navbar() {
  const pathname = usePathname()
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const { autoReBet, setAutoReBet, forceTie, setForceTie, showAllGames, setShowAllGames, devModeUnlocked, setDevModeUnlocked, devInfiniteBets, setDevInfiniteBets } = useSettingsStore()
  const cursed = useSurvivalStore((s) => s.cursed)
  const setCursed = useSurvivalStore((s) => s.setCursed)
  const blessed = useSurvivalStore((s) => s.blessed)
  const setBlessed = useSurvivalStore((s) => s.setBlessed)
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)
  const sparks = useSurvivalStore((s) => s.sparks)
  const setBankroll = useSurvivalStore((s) => s.setBankroll)
  const setSparks = useSurvivalStore((s) => s.setSparks)
  const devSetPurchasedUpgrades = useSurvivalStore((s) => s.devSetPurchasedUpgrades)
  const [menuOpen, setMenuOpen] = useState(false)
  const [devPassword, setDevPassword] = useState('')
  const [devPasswordError, setDevPasswordError] = useState(false)
  const [devBankroll, setDevBankroll] = useState('')
  const [devSparks, setDevSparks] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

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

  const isHome = pathname === '/'
  const inFreeplay = pathname?.startsWith('/freeplay')
  const inSurvival = pathname?.startsWith('/survival')
  const inSurvivalGame = pathname?.startsWith('/survival/') ?? false

  // runActive is persisted to localStorage, so it's only known after the client
  // has mounted — gate on that to avoid an SSR/client hydration mismatch.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const showSurvivalHud = hydrated && inSurvivalGame && runActive

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const survivalDesktop = (
    <Link
      href="/survival"
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        inSurvival
          ? 'bg-amber-900/40 text-amber-300'
          : 'text-white/60 hover:text-white hover:bg-white/8'
      }`}
    >
      Survival
    </Link>
  )

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/95 backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="relative flex items-center justify-between h-16">

            {/* Left: brand + nav links */}
            <div className="flex items-center gap-4 min-w-0 z-10">
              <Link
                href="/"
                className="text-lg font-black tracking-[0.2em] uppercase text-white hover:text-white/80 transition-colors shrink-0"
              >
                FLOORED
              </Link>

              {!isHome && (
                <div className="hidden sm:flex items-center gap-1">
                  {survivalDesktop}

                  <Link
                    href="/freeplay"
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      inFreeplay
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    Freeplay
                  </Link>
                </div>
              )}

            </div>

            {/* Center: survival in-game bankroll + bets (hidden on lg+, covered by the sidebar there) */}
            <div className="flex-1 flex items-center justify-center min-w-0 px-1 sm:px-2 lg:hidden">
              {showSurvivalHud && (
                <>
                  {/* Narrowest phones: compact, no labels */}
                  <div className="flex sm:hidden items-center gap-1 text-[11px] font-bold tabular-nums">
                    <span className="px-1.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-700/60">
                      <span className={bankroll >= quotaTarget ? 'text-zinc-200' : 'text-red-400'}>{formatChips(bankroll)}</span>
                      <span className="text-zinc-500">/{formatChips(quotaTarget)}</span>
                    </span>
                    <span className="px-1.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-700/60 text-zinc-200">
                      {floorBetsPlaced}<span className="text-zinc-500">/{FLOOR_BET_LIMIT}</span>
                    </span>
                  </div>

                  {/* sm and up: full labeled pills */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div className={HUD_PILL}>
                      <span className="text-[9px] font-normal text-zinc-500 mr-1">Bankroll</span>
                      <span className={bankroll >= quotaTarget ? '' : 'text-red-400'}>{formatChips(bankroll)}</span>
                      <span className="text-zinc-500">/{formatChips(quotaTarget)}</span>
                    </div>
                    <div className={HUD_PILL}>
                      <span className="text-[9px] font-normal text-zinc-500 mr-1">Bets</span>
                      {floorBetsPlaced}
                      <span className="text-zinc-500">/{FLOOR_BET_LIMIT}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: bankroll + account */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 z-10">
              {inFreeplay && (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-right">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider leading-none mb-0.5">
                      Freeplay
                    </p>
                    <p className="text-white font-bold text-sm leading-none tabular-nums">
                      {formatChips(freeplayBankroll)}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 flex-shrink-0" />
                </div>
              )}

              <SignedOut>
                <Link
                  href="/auth/sign-in"
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-white/60 hover:text-white hover:bg-white/8 transition-colors"
                >
                  Sign In
                </Link>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Account settings"
                  aria-expanded={menuOpen}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#12121a] py-2 shadow-xl z-50">
                    <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Settings
                    </p>
                    <button
                      type="button"
                      onClick={() => setAutoReBet(!autoReBet)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm text-white/80">Auto re-bet</span>
                      <div
                        className={`relative h-4 w-7 rounded-full flex-shrink-0 transition-colors ${autoReBet ? 'bg-emerald-500' : 'bg-white/20'}`}
                      >
                        <div
                          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${autoReBet ? 'translate-x-[13px]' : 'translate-x-0.5'}`}
                        />
                      </div>
                    </button>
                    <div className="border-t border-white/10 mt-1 pt-1">
                      <div className="flex items-center justify-between px-3 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-500/70">Dev Mode</p>
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
                        <>
                          <button
                            type="button"
                            onClick={() => setForceTie(!forceTie)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                          >
                            <span className="text-sm text-white/80">Force tie <span className="text-white/30 text-xs">(HiLo)</span></span>
                            <div className={`relative h-4 w-7 rounded-full flex-shrink-0 transition-colors ${forceTie ? 'bg-yellow-500' : 'bg-white/20'}`}>
                              <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${forceTie ? 'translate-x-[13px]' : 'translate-x-0.5'}`} />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAllGames(!showAllGames)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                          >
                            <span className="text-sm text-white/80">All games <span className="text-white/30 text-xs">(survival)</span></span>
                            <div className={`relative h-4 w-7 rounded-full flex-shrink-0 transition-colors ${showAllGames ? 'bg-yellow-500' : 'bg-white/20'}`}>
                              <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${showAllGames ? 'translate-x-[13px]' : 'translate-x-0.5'}`} />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDevInfiniteBets(!devInfiniteBets)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                          >
                            <span className="text-sm text-white/80">Infinite bets <span className="text-white/30 text-xs">(survival)</span></span>
                            <div className={`relative h-4 w-7 rounded-full flex-shrink-0 transition-colors ${devInfiniteBets ? 'bg-yellow-500' : 'bg-white/20'}`}>
                              <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${devInfiniteBets ? 'translate-x-[13px]' : 'translate-x-0.5'}`} />
                            </div>
                          </button>
                          <div className="flex w-full items-center justify-between gap-3 px-3 py-2">
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

                          {/* Bankroll setter */}
                          <div className="flex items-center gap-1.5 px-3 py-1.5">
                            <span className="text-sm text-white/80 shrink-0">Bankroll</span>
                            <input
                              type="text"
                              value={devBankroll}
                              onChange={(e) => setDevBankroll(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseChips(devBankroll); if (n !== null && n > 0) { setBankroll(n); setDevBankroll('') } } }}
                              placeholder={formatChips(bankroll)}
                              className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white placeholder-white/20 outline-none focus:border-white/30"
                            />
                            <button
                              type="button"
                              onClick={() => { const n = parseChips(devBankroll); if (n !== null && n > 0) { setBankroll(n); setDevBankroll('') } }}
                              className="shrink-0 px-2 py-0.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
                            >Set</button>
                          </div>

                          {/* Sparks setter */}
                          <div className="flex items-center gap-1.5 px-3 py-1.5">
                            <span className="text-sm text-white/80 shrink-0">Sparks</span>
                            <input
                              type="text"
                              value={devSparks}
                              onChange={(e) => setDevSparks(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseChips(devSparks); if (n !== null && n >= 0) { setSparks(n); setDevSparks('') } } }}
                              placeholder={formatChips(sparks)}
                              className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white placeholder-white/20 outline-none focus:border-white/30"
                            />
                            <button
                              type="button"
                              onClick={() => { const n = parseChips(devSparks); if (n !== null && n >= 0) { setSparks(n); setDevSparks('') } }}
                              className="shrink-0 px-2 py-0.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
                            >Set</button>
                          </div>

                          {/* Upgrades */}
                          <div className="flex items-center gap-1.5 px-3 py-1.5">
                            <span className="text-sm text-white/80 shrink-0">Upgrades</span>
                            <button
                              type="button"
                              onClick={() => devSetPurchasedUpgrades(allPurchasedUpgradesForDev())}
                              className="flex-1 py-0.5 text-xs font-semibold bg-emerald-900/60 hover:bg-emerald-800/60 border border-emerald-700/40 text-emerald-300 rounded transition-colors"
                            >Grant All</button>
                            <button
                              type="button"
                              onClick={() => devSetPurchasedUpgrades([])}
                              className="flex-1 py-0.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 rounded transition-colors"
                            >Clear</button>
                          </div>
                        </>
                      ) : (
                        <div className="px-3 pb-2">
                          <div className="flex gap-1.5">
                            <input
                              type="password"
                              value={devPassword}
                              onChange={(e) => setDevPassword(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleDevUnlock()}
                              placeholder="Password"
                              className={`min-w-0 flex-1 bg-white/5 border rounded px-2 py-1 text-xs text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors ${devPasswordError ? 'border-red-500' : 'border-white/10'}`}
                            />
                            <button
                              type="button"
                              onClick={handleDevUnlock}
                              className="shrink-0 px-2 py-1 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white/70 rounded transition-colors"
                            >
                              Unlock
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
