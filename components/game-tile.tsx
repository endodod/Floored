'use client'

import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SUITS } from '@/components/ui/terminal'

/**
 * One game as a pickable tile, shared by every lobby (freeplay, survival,
 * daily, ladder). Flat surface, the name large, its payout in mono. On hover it
 * lifts, a spotlight follows the pointer, the suit watermark wakes and the felt
 * line draws under the action word.
 */
export function GameTile({
  label,
  sub,
  meta,
  action = 'Play',
  disabled,
  faded,
  loading,
  onClick,
  onMouseEnter,
  corner,
  children,
  index = 0,
  className,
}: {
  label: string
  sub?: ReactNode
  /** Figure at the foot, left: "up to ×1,000". */
  meta?: ReactNode
  /** Action word at the foot, right. */
  action?: ReactNode
  disabled?: boolean
  /** Spent or unavailable — stays readable, steps back. */
  faded?: boolean
  loading?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  /** Absolutely placed control in the top-right corner (a reroll button). */
  corner?: ReactNode
  children?: ReactNode
  /** Position in its grid: staggers the entrance and picks the suit. */
  index?: number
  className?: string
}) {
  const suitIndex = index % 4
  const red = suitIndex === 1 || suitIndex === 2

  function handleMove(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div className={cn('rise relative h-full', className)} style={{ '--d': `${Math.min(index, 12) * 45 + 120}ms` } as CSSProperties}>
      {corner && <div className="absolute right-3 top-3 z-10">{corner}</div>}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseMove={disabled ? undefined : handleMove}
        disabled={disabled}
        aria-busy={loading || undefined}
        className={cn(
          'tile group flex h-full min-h-[96px] w-full flex-col rounded-md bg-surface p-4 text-left sm:min-h-[132px] sm:p-5',
          disabled ? 'cursor-default' : 'hover:bg-[#17161c]',
          faded && 'opacity-45',
        )}
      >
        <span aria-hidden className={cn('tile-suit', red ? 'text-loss' : 'text-ink')}>
          {SUITS[suitIndex]}
        </span>
        <span className={cn('block text-[17px] font-semibold leading-snug text-ink', corner && 'pr-24')}>
          {label}
        </span>
        {sub && <span className="mt-1 block text-[13px] leading-5 text-dim">{sub}</span>}
        {children && <span className="mt-3 block">{children}</span>}
        <span className="mt-auto flex items-baseline justify-between gap-3 pt-3 sm:pt-4">
          <span className="truncate text-xs text-soft">{meta}</span>
          <span
            className="mark-line flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink"
            data-active={loading || undefined}
          >
            {loading ? 'Dealing…' : action}
            {!loading && !disabled && (
              <span aria-hidden className="m-still inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            )}
          </span>
        </span>
      </button>
    </div>
  )
}

/** Small outlined control for a tile corner: "Reroll · 1 ticket". */
export function TileCornerButton({
  children,
  title,
  onClick,
}: {
  children: ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="group/reroll flex h-7 items-center gap-1 rounded-full border border-control bg-surface px-2.5 text-xs font-medium text-soft transition-colors hover:border-gold hover:text-gold"
    >
      <span aria-hidden className="m-still inline-block transition-transform duration-300 group-hover/reroll:rotate-180">
        ↻
      </span>
      {children}
    </button>
  )
}
