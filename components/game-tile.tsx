import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One game as a pickable tile, shared by every lobby (freeplay, survival,
 * daily, ladder). Flat surface, the name large, its payout in mono; hovering
 * draws the felt line under the action word.
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
  className,
}: {
  label: string
  sub?: ReactNode
  /** Mono figure at the foot, left: "up to ×1,000". */
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
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      {corner && <div className="absolute right-3 top-3 z-10">{corner}</div>}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        disabled={disabled}
        aria-busy={loading || undefined}
        className={cn(
          'group flex h-full min-h-[96px] sm:min-h-[132px] w-full flex-col rounded-md bg-surface p-4 text-left transition-[background-color,transform] duration-150 sm:p-5',
          disabled ? 'cursor-default' : 'hover:bg-raised active:scale-[0.99]',
          faded && 'opacity-45',
        )}
      >
        <span className={cn('block text-[17px] font-semibold leading-snug text-ink', corner && 'pr-24')}>
          {label}
        </span>
        {sub && <span className="mt-1 block text-[13px] leading-5 text-dim">{sub}</span>}
        {children && <span className="mt-3 block">{children}</span>}
        <span className="mt-auto flex items-baseline justify-between gap-3 pt-3 sm:pt-4">
          <span className="truncate text-xs text-soft">{meta}</span>
          <span className="mark-line shrink-0 text-[13px] font-medium text-ink" data-active={loading || undefined}>
            {loading ? 'Opening…' : action}
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
      className="h-7 rounded-full border border-control px-2.5 text-xs font-medium text-soft transition-colors hover:border-dim hover:text-ink"
    >
      {children}
    </button>
  )
}
