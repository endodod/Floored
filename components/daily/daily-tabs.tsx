'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LADDER_ENABLED } from '@/lib/features'

const TABS = [
  { href: '/daily', label: 'Daily challenge' },
  ...(LADDER_ENABLED ? [{ href: '/daily-ladder', label: 'Daily ladder' }] : []),
]

/** The two dailies side by side: the bet-slip challenge and the ladder climb. */
export function DailyTabs() {
  const pathname = usePathname()
  if (TABS.length < 2) return null
  return (
    <nav aria-label="Dailies" className="rise -mb-4 flex gap-6 border-b border-rule">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            data-active={active}
            className={`mark-line pb-2 text-[13px] font-medium ${active ? 'text-ink' : 'text-dim hover:text-ink'}`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
