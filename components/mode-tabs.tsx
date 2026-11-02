'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LADDER_ENABLED } from '@/lib/features'

type Tab = { href: string; label: string }

/** Each navbar mode with a daily pairs the daily with its main page as two tabs. */
const GROUPS: Record<'challenges' | 'ladder', { label: string; tabs: Tab[] }> = {
  challenges: {
    label: 'Challenges',
    tabs: [
      { href: '/daily', label: 'Daily challenge' },
      { href: '/challenges', label: 'Challenges' },
    ],
  },
  ladder: {
    label: 'Ladder',
    tabs: LADDER_ENABLED
      ? [
          { href: '/daily-ladder', label: 'Daily ladder' },
          { href: '/ladder', label: 'Ladder' },
        ]
      : [],
  },
}

/** The tab strip at the top of the Challenges and Ladder pages. */
export function ModeTabs({ group }: { group: keyof typeof GROUPS }) {
  const pathname = usePathname()
  const { label, tabs } = GROUPS[group]
  if (tabs.length < 2) return null
  return (
    <nav aria-label={label} className="rise -mb-4 flex gap-6 border-b border-rule">
      {tabs.map((t) => {
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
