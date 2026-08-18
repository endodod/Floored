'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'

const HUD_PILL =
  'px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/60 tabular-nums text-sm font-bold text-zinc-200'

export function Navbar() {
  const pathname = usePathname()
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)

  const isHome = pathname === '/'
  const inFreeplay = pathname?.startsWith('/freeplay')
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

              <Link
                href="/account"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Account"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
