'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LADDER_ENABLED, TABLES_ENABLED } from '@/lib/features'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/', match: ['/'], label: 'Home', icon: '🏠', enabled: true },
  { href: '/challenges', match: ['/challenges', '/challenge', '/daily', '/community'], label: 'Challenges', icon: '🎯', enabled: true },
  { href: '/ladder', match: ['/ladder', '/daily-ladder'], label: 'Ladder', icon: '🪜', enabled: LADDER_ENABLED },
  { href: '/tables', match: ['/tables'], label: 'Tables', icon: '🃏', enabled: TABLES_ENABLED },
  { href: '/freeplay', match: ['/freeplay'], label: 'Games', icon: '🎮', enabled: true },
].filter((t) => t.enabled)

/** A game table (/freeplay/mines, /tables/holdem): the board needs the height, and the dock has its own Leave. */
function isGameRoute(pathname: string): boolean {
  const [mode, sub] = pathname.split('/').filter(Boolean)
  if (!sub) return false
  if (mode === 'tables' && sub === 'lobby') return false
  return ['daily', 'daily-ladder', 'ladder', 'challenge', 'survival', 'tables', 'freeplay'].includes(mode ?? '')
}

/**
 * Simple view on a phone: the app-style tab bar along the bottom, so every
 * mode is one big tap away. Hidden on game tables, on wider screens (the
 * navbar has the links) and outside Simple view.
 */
export function SimpleTabBar() {
  const pathname = usePathname() ?? '/'
  if (isGameRoute(pathname)) return null

  return (
    <nav
      aria-label="Modes"
      className="relative z-50 hidden shrink-0 border-t border-[rgba(217,164,65,0.22)] bg-[rgba(14,21,16,0.96)] pb-[env(safe-area-inset-bottom)] simple:block md:simple:hidden"
    >
      <ul className="flex">
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : t.match.some((m) => pathname === m || pathname.startsWith(`${m}/`))
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-[68px] flex-col items-center justify-center gap-1 text-[13px] font-semibold transition-colors',
                  active ? 'text-ink' : 'text-dim',
                )}
              >
                <span aria-hidden className={cn('text-[24px] leading-none', !active && 'opacity-60 grayscale')}>
                  {t.icon}
                </span>
                <span className={cn('rounded-full px-2', active && 'bg-felt-tint text-felt')}>{t.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
