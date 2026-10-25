'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import { SURVIVAL_ENABLED } from '@/lib/features'
import { useDailyStore } from '@/store/daily-store'

const HUD_PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

export function Navbar() {
  const pathname = usePathname()
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const dailyBankroll = useDailyStore((s) => s.bankroll)
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)

  const isHome = pathname === '/'
  const inFreeplay = pathname?.startsWith('/freeplay')
  const inDaily = pathname?.startsWith('/daily')
  const inSettings = pathname?.startsWith('/settings')
  const inSurvival = pathname?.startsWith('/survival')
  const inSurvivalGame = pathname?.startsWith('/survival/') ?? false

  // runActive is persisted to localStorage, so it's only known after the client
  // has mounted — gate on that to avoid an SSR/client hydration mismatch.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const showSurvivalHud = hydrated && inSurvivalGame && runActive

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
                  <Link
                    href="/daily"
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      inDaily
                        ? 'bg-amber-900/40 text-amber-300'
                        : 'text-white/60 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    Daily
                  </Link>

                  {SURVIVAL_ENABLED && survivalDesktop}

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

            {/* Right: bankroll + settings */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 z-10">
              {inDaily && hydrated && (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-right">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider leading-none mb-0.5">
                      Daily
                    </p>
                    <p className="text-white font-bold text-sm leading-none tabular-nums">
                      {formatChips(dailyBankroll)}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 flex-shrink-0" />
                </div>
              )}

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

              <Link
                href="/settings"
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 transition-colors ${
                  inSettings ? 'bg-white/15 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                aria-label="Settings"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.04.31-.07.63-.07.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
