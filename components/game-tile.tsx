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
  symbol,
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
  roomy = false,
  simpleRow = false,
  vivid = false,
}: {
  label: string
  /** A game-specific symbol shown by the title and used as the tile watermark. */
  symbol?: string
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
  /** Larger lobby card with room for longer descriptions and details. */
  roomy?: boolean
  /** Simple view: one compact row (symbol and name, button on the right) instead of a tall card. */
  simpleRow?: boolean
  /** The game's symbol as a stronger watermark, and no symbol by the name (Freeplay). */
  vivid?: boolean
}) {
  const suitIndex = index % 4
  const red = suitIndex === 1 || suitIndex === 2
  const tileSymbol = symbol ?? SUITS[suitIndex]

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
          cn(
            'tile group flex h-full w-full flex-col rounded-md bg-surface text-left',
            roomy ? 'min-h-[190px] p-5 sm:min-h-[220px] sm:p-6' : 'min-h-[96px] p-4 sm:min-h-[132px] sm:p-5',
            // Simple view: a centred app card — big symbol, the name, one big Play button.
            simpleRow
              ? 'simple:min-h-[76px] simple:flex-row simple:items-center simple:gap-3 simple:px-4 simple:py-3'
              : 'simple:min-h-[168px] simple:items-center simple:p-4 simple:text-center sm:simple:min-h-[188px]',
          ),
          disabled ? 'cursor-default' : 'hover:bg-[#17161c]',
          faded && 'opacity-45',
        )}
      >
        <span aria-hidden className={cn('tile-suit', vivid && 'tile-suit-vivid', !symbol && red ? 'text-loss' : 'text-ink')}>
          {tileSymbol}
        </span>
        <span
          className={cn(
            'flex items-baseline gap-2 text-[17px] font-semibold leading-snug text-ink',
            simpleRow
              ? 'simple:min-w-0 simple:flex-1 simple:items-center simple:gap-3 simple:text-[19px]'
              : 'simple:flex-col simple:items-center simple:gap-2 simple:text-[19px] sm:simple:text-[21px]',
            corner && 'pr-24 simple:pr-0',
          )}
        >
          <span aria-hidden className={cn('shrink-0 text-[15px] text-gold simple:leading-none', simpleRow ? 'simple:text-[26px]' : 'simple:text-[34px]', vivid && 'hidden simple:inline')}>{tileSymbol}</span>
          {label}
        </span>
        {sub && <span className="mt-1 block text-[13px] leading-5 text-dim simple:hidden">{sub}</span>}
        {children && <span className="mt-3 block simple:mt-1 simple:text-[15px]">{children}</span>}
        <span
          className={cn(
            'mt-auto flex gap-3 pt-3 sm:pt-4',
            roomy ? 'flex-col items-start' : 'items-baseline justify-between',
            simpleRow ? 'simple:mt-0 simple:w-auto simple:shrink-0 simple:pt-0' : 'simple:w-full simple:flex-col simple:items-stretch simple:pt-3',
          )}
        >
          <span className={cn('text-xs text-soft simple:hidden', roomy ? 'whitespace-normal leading-5' : 'truncate')}>{meta}</span>
          <span
            className={cn(
              'mark-line flex shrink-0 items-center gap-1 font-medium text-ink',
              roomy ? 'text-[14px]' : 'text-[13px]',
              // Simple view: the action is a real button, felt green while it can be pressed.
              simpleRow && 'simple:px-6',
              'simple:h-12 simple:justify-center simple:rounded-full simple:border simple:border-control simple:text-[17px] simple:font-semibold',
              !disabled && 'simple:border-[rgba(217,164,65,0.45)] simple:bg-[linear-gradient(180deg,#286746,#1b4d34)] simple:text-[#fffaf0]',
            )}
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
