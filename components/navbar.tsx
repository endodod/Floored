'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, User, X } from 'lucide-react'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import { LADDER_ENABLED, SURVIVAL_ENABLED } from '@/lib/features'
import { useLadderStore } from '@/store/ladder-store'
import { useDailyStore } from '@/store/daily-store'
import { FlooredMark } from '@/components/ui/terminal'

const MODES = [
  { href: '/daily', label: 'Daily', enabled: true },
  { href: '/ladder', label: 'Ladder', enabled: LADDER_ENABLED },
  { href: '/survival', label: 'Survival', enabled: SURVIVAL_ENABLED },
  { href: '/freeplay', label: 'Freeplay', enabled: true },
].filter((m) => m.enabled)

/** The mode's money, always in the same place: grey label, mono figure. */
function BarFigure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <p className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="hidden text-xs text-dim md:inline">{label}</span>
      <span className="num text-sm text-ink">{value}</span>
      {unit && <span className="num text-xs text-dim">{unit}</span>}
    </p>
  )
}

export function Navbar() {
  const pathname = usePathname() ?? '/'
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const dailyBankroll = useDailyStore((s) => s.bankroll)
  const ladderPot = useLadderStore((s) => s.pot)
  const ladderStatus = useLadderStore((s) => s.status)
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)
  const [menuOpen, setMenuOpen] = useState(false)

  const inFreeplay = pathname.startsWith('/freeplay')
  const inDaily = pathname.startsWith('/daily')
  const inLadder = pathname.startsWith('/ladder')
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
  if (hydrated && inDaily) figure = <BarFigure label="Daily bankroll" value={formatChips(dailyBankroll)} />
  else if (hydrated && inLadder && ladderStatus === 'climbing') figure = <BarFigure label="Pot" value={formatChips(ladderPot)} />
  else if (hydrated && inFreeplay) figure = <BarFigure label="Balance" value={formatChips(freeplayBankroll)} />

  return (
    <>
      <nav className="sticky top-0 z-50 shrink-0 border-b border-line bg-ground">
        <div className="container mx-auto flex h-12 items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-ink" aria-label="Floored, home">
            <FlooredMark />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Floored</span>
          </Link>

          {current && <span className="text-[13px] text-dim sm:hidden">{current}</span>}

          <div className="hidden h-12 items-stretch gap-6 sm:flex">
            {MODES.map((m) => {
              const active = pathname.startsWith(m.href)
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  aria-current={active ? 'page' : undefined}
                  data-active={active}
                  className={`mark-line flex items-center text-[13px] font-medium transition-colors ${
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
              <p className="num flex items-baseline gap-3 whitespace-nowrap text-[13px]">
                <span>
                  <span className={bankroll >= quotaTarget ? 'text-ink' : 'text-loss'}>{formatChips(bankroll)}</span>
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
            <Link
              href="/account"
              aria-label="Account"
              aria-current={inAccount ? 'page' : undefined}
              className={`hidden h-8 w-8 items-center justify-center rounded-full border transition-colors sm:flex ${
                inAccount ? 'border-felt text-ink' : 'border-control text-soft hover:border-dim hover:text-ink'
              }`}
            >
              <User className="h-4 w-4" strokeWidth={1.5} />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="-mr-2 flex h-10 w-10 items-center justify-center text-soft sm:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ground sm:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-12 items-center justify-between border-b border-line px-4">
            <Link href="/" className="flex items-center gap-2 text-ink">
              <FlooredMark />
              <span className="text-[15px] font-semibold">Floored</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="-mr-2 flex h-10 w-10 items-center justify-center text-soft"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
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
