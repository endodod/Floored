'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatChips } from '@/utils/format'

/**
 * One seat at a table: an avatar disc with the player's initials (the turn
 * timer runs round it), the name, the stack and what they did last. Out-of-hand
 * seats fall back with `g-dim`. A bot's style and skill are never shown: players
 * read them from how it plays, as at a real table.
 */
export function SeatPlate({
  name,
  stack,
  stackLabel,
  stackCaption,
  you = false,
  timer,
  dealer = false,
  dim = false,
  win = false,
  status,
  statusTone = 'neutral',
  className,
  children,
}: {
  name: string
  stack: number | null
  /** Replaces the stack figure ("Out", "3 dice"). */
  stackLabel?: ReactNode
  /** Small descriptor for the stack display, e.g. the player's tournament bankroll. */
  stackCaption?: string
  you?: boolean
  /** The seat is on the clock: the ring drains over `ms`. */
  timer?: { ms: number; key: string | number } | null
  dealer?: boolean
  dim?: boolean
  win?: boolean
  status?: ReactNode
  statusTone?: 'neutral' | 'win' | 'loss' | 'gold' | 'dim'
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('tb-seat relative flex flex-col items-center', dim && 'g-dim', className)}>
      <div className={cn('tb-plate relative flex items-center gap-2 rounded-full pr-3', you && 'tb-plate-you', win && 'g-win')}>
        <span className="tb-avatar relative flex shrink-0 items-center justify-center rounded-full">
          <span aria-hidden className="text-[11px] font-semibold tracking-wide">
            {you ? 'YOU' : name.slice(0, 2).toUpperCase()}
          </span>
          {timer && (
            <svg key={timer.key} className="tb-ring absolute inset-[-3px]" viewBox="0 0 40 40" aria-hidden>
              <circle cx="20" cy="20" r="18.5" pathLength={100} style={{ animationDuration: `${timer.ms}ms` } as CSSProperties} />
            </svg>
          )}
          {dealer && (
            <span className="tb-dealer absolute -right-1 -top-1 flex items-center justify-center rounded-full" aria-label="Dealer button">
              D
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[12.5px] font-semibold text-ink">
            {you ? 'You' : name}
          </span>
          <span className="num truncate text-[12px] text-soft">
            {stackLabel ?? (stack != null ? <>{stackCaption && <span className="mr-1 text-dim">{stackCaption}</span>}{formatChips(stack)}</> : '')}
          </span>
        </span>
      </div>
      <span
        className={cn(
          'tb-status num mt-1 h-4 truncate text-[11px] leading-4',
          statusTone === 'win' && 'text-felt',
          statusTone === 'loss' && 'text-loss',
          statusTone === 'gold' && 'text-gold',
          statusTone === 'dim' && 'text-dim',
          statusTone === 'neutral' && 'text-soft',
        )}
      >
        {status}
      </span>
      {children}
    </div>
  )
}
