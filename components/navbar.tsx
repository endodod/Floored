'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, User, X } from 'lucide-react'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import { formatChips } from '@/utils/format'
import { FLOOR_BET_LIMIT } from '@/lib/survival/balance'
import { LADDER_ENABLED, SIMPLE_VIEW_ENABLED, STORY_ENABLED, SURVIVAL_ENABLED, TABLES_ENABLED } from '@/lib/features'
import { useTablesStore } from '@/store/tables-store'
import { useDailyLadderStore, useLadderStore } from '@/store/ladder-store'
import { useDailyStore } from '@/store/daily-store'
import { useChallengeStore } from '@/store/challenge-store'
import { useStoryStore } from '@/store/story-store'
import { FlooredMark } from '@/components/ui/terminal'
import { SimpleViewToggle } from '@/components/simple-view-toggle'

/** `also` lists the other pages a mode's tabs hold, so the link stays lit on them. */
const MODES = [
  { href: '/story', label: 'Story', also: [], enabled: STORY_ENABLED },
  { href: '/challenges', label: 'Challenges', also: ['/daily'], enabled: true },
  { href: '/ladder', label: 'Ladder', also: ['/daily-ladder'], enabled: LADDER_ENABLED },
  { href: '/freeplay', label: 'Freeplay', also: [], enabled: true },
  { href: '/tables', label: 'Tables', also: [], enabled: TABLES_ENABLED },
  { href: '/community', label: 'Community', also: [], enabled: true },
  { href: '/survival', label: 'Survival', also: [], enabled: SURVIVAL_ENABLED },
].filter((m) => m.enabled)

/** Segment match, so '/daily' isn't active on '/daily-ladder'. */
const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)
const inMode = (pathname: string, m: { href: string; also?: string[] }) =>
  [m.href, ...(m.also ?? [])].some((h) => isUnder(pathname, h))

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
      <span className="hidden text-xs text-dim md:inline tall:text-[13px] sm:simple:inline simple:text-[13px]">{label}</span>
      {/* key re-mounts the span so the flash replays on every change */}
      <span key={tick} className={`num text-sm text-ink tall:text-base simple:text-lg ${tick}`}>
        {formatChips(value)}
      </span>
    </p>
  )
}

export function Navbar() {
  const pathname = usePathname() ?? '/'
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const tablesWallet = useTablesStore((s) => s.wallet)
  const storyMoney = useStoryStore((s) => s.money)
  const dailyBankroll = useDailyStore((s) => s.bankroll)
  const ladderPot = useLadderStore((s) => s.pot)
  const challengeBankroll = useChallengeStore((s) => s.attempt?.bankroll ?? null)
  const ladderStatus = useLadderStore((s) => s.status)
  const dailyLadderPot = useDailyLadderStore((s) => s.pot)
  const dailyLadderStatus = useDailyLadderStore((s) => s.status)
  const runActive = useSurvivalStore((s) => s.runActive)
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const floorBetsPlaced = useSurvivalStore((s) => s.floorBetsPlaced)
  const [menuOpen, setMenuOpen] = useState(false)

  const inFreeplay = pathname.startsWith('/freeplay')
  const inDailyLadder = pathname.startsWith('/daily-ladder')
  const inDaily = pathname.startsWith('/daily') && !inDailyLadder
  const inLadder = pathname.startsWith('/ladder')
  const inStory = pathname === '/story' || pathname.startsWith('/story/')
  const inTables = pathname.startsWith('/tables')
  const inAccount = pathname.startsWith('/account')
  const inChallenge = pathname === '/challenge' || pathname.startsWith('/challenge/')
  const inSurvivalGame = pathname.startsWith('/survival/')

  // Stores are persisted to localStorage, so their values are only known after the
  // client has mounted — gate on that to avoid an SSR/client hydration mismatch.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  useEffect(() => setMenuOpen(false), [pathname])

  const showSurvivalHud = hydrated && inSurvivalGame && runActive
  const current =
    MODES.find((m) => inMode(pathname, m))?.label ?? (inChallenge ? 'Challenge' : inAccount ? 'Account' : null)

  let figure: React.ReactNode = null
  if (hydrated && inDailyLadder) {
    if (dailyLadderStatus === 'climbing') figure = <BarFigure label="Pot" value={dailyLadderPot} />
  } else if (hydrated && inDaily) figure = <BarFigure label="Bankroll" value={dailyBankroll} />
  else if (hydrated && inLadder && ladderStatus === 'climbing') figure = <BarFigure label="Pot" value={ladderPot} />
  else if (hydrated && inChallenge && challengeBankroll != null)
    figure = <BarFigure label="Challenge bankroll" value={challengeBankroll} />
  else if (hydrated && inStory) figure = <BarFigure label="Money" value={storyMoney} />
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

          {current && <span className="text-[13px] text-dim md:hidden tall:text-sm simple:text-[17px] simple:font-semibold simple:text-ink">{current}</span>}

          <div className="hidden h-12 items-stretch gap-5 md:flex lg:gap-6 tall:h-16 lg:tall:gap-8">
            {MODES.map((m) => {
              const active = inMode(pathname, m)
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  aria-current={active ? 'page' : undefined}
                  data-active={active}
                  className={`mark-line flex items-center whitespace-nowrap text-[13px] font-medium transition-colors tall:text-[15px] simple:text-[17px] ${
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

          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4 lg:ml-0 lg:flex-1 lg:justify-end">
            {figure}
            {/* On a phone in Simple view the menu carries the switch; the bar keeps its room for the figure. */}
            {SIMPLE_VIEW_ENABLED && <SimpleViewToggle className="simple:hidden md:simple:flex" />}
            <Link
              href="/account"
              aria-label="Account"
              aria-current={inAccount ? 'page' : undefined}
              className={`hidden h-8 w-8 items-center justify-center rounded-full border transition-colors md:flex tall:h-10 tall:w-10 ${
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
              className="-mr-2 flex h-10 w-10 items-center justify-center text-soft md:hidden"
            >
              <Menu className="h-5 w-5 tall:h-6 tall:w-6" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="sheet-in fixed inset-0 z-[60] flex flex-col bg-ground md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
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
              const active = m.href === '/' ? pathname === '/' : inMode(pathname, m)
              const desktopOnly = m.href === '/survival'
              return (
                <li key={m.href} className="border-b border-rule">
                  {desktopOnly ? (
                    <span className="flex h-14 items-center justify-between text-lg text-dim simple:h-16 simple:text-2xl">
                      {m.label}
                      <span className="text-xs">Desktop only</span>
                    </span>
                  ) : (
                    <Link
                      href={m.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-14 items-center text-lg simple:h-16 simple:text-2xl simple:font-semibold ${active ? 'text-ink' : 'text-soft'}`}
                    >
                      <span className="mark-line" data-active={active}>
                        {m.label}
                      </span>
                    </Link>
                  )}
                </li>
              )
            })}
            {SIMPLE_VIEW_ENABLED && (
              <li className="py-4 text-lg simple:text-2xl">
                <SimpleViewToggle variant="row" />
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  )
}
