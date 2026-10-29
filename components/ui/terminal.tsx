import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared pieces of the Floored screens: the mark, the title row, the divided
 * figure strip and the unit tracks each mode is measured in.
 */

/** A playing card knocked flat onto the floor line — the floor line is the felt accent. */
export function FlooredMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn('h-5 w-5', className)} aria-hidden>
      <rect x="2.75" y="6.75" width="14.5" height="9.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.2 11.7 11.5 10 13.8 8.3 11.5Z" fill="currentColor" />
      <rect x="0" y="18" width="20" height="1.25" fill="var(--felt)" />
    </svg>
  )
}

/** The screen's title row: a noun title, one line under it, and its figures or action at the right. */
export function PageTitle({
  title,
  sub,
  aside,
  className,
}: {
  title: ReactNode
  sub?: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] sm:text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {sub && <p className="mt-1 text-[13px] leading-5 text-dim">{sub}</p>}
      </div>
      {aside && <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">{aside}</div>}
    </header>
  )
}

export const SUITS = ['\u2660\uFE0E', '\u2665\uFE0E', '\u2666\uFE0E', '\u2663\uFE0E'] as const

/** A card suit as a small glyph; hearts and diamonds in the loss red, spades and clubs in ink. */
export function Suit({ index, className }: { index: number; className?: string }) {
  const i = ((index % 4) + 4) % 4
  const suit = SUITS[i]
  const red = i === 1 || i === 2
  return (
    <span aria-hidden className={cn('select-none', red ? 'text-loss' : 'text-ink', className)}>
      {suit}
    </span>
  )
}

/** A section heading outside the cards: 16/600 with a suit pip, and an optional count or note on the right. */
export function SectionTitle({ children, note, suit = 2 }: { children: ReactNode; note?: ReactNode; suit?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-base font-semibold text-ink">
        <Suit index={suit} className="text-[11px] opacity-80" />
        <span>{children}</span>
      </h2>
      {note && <p className="text-xs text-dim">{note}</p>}
    </div>
  )
}

export type FigureTone = 'win' | 'loss' | 'gold' | 'dim'

const FIGURE_TONE: Record<FigureTone, string> = {
  win: 'text-felt glow-felt',
  loss: 'text-loss glow-loss',
  gold: 'text-gold glow-gold',
  dim: 'text-dim',
}

export interface Figure {
  label: string
  value: ReactNode
  /** Smaller grey suffix after the value: "/ 10", "of 2.0K". */
  unit?: ReactNode
  sub?: ReactNode
  tone?: FigureTone
}

/** One card split by 1px dividers, label over value. Two columns on a phone. */
export function FigureStrip({ items, className }: { items: Figure[]; className?: string }) {
  return (
    <dl
      className={cn(
        'rise grid grid-cols-2 gap-px overflow-hidden rounded-md bg-line [--d:80ms]',
        items.length >= 4 ? 'sm:grid-cols-4' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        items.length % 2 === 1 && '[&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1',
        className,
      )}
    >
      {items.map((f) => (
        <div key={f.label} className="bg-surface px-4 py-3 transition-colors hover:bg-[#18171c] sm:px-5 sm:py-4">
          <dt className="text-xs text-dim">{f.label}</dt>
          <dd className={cn('num mt-1 text-xl leading-7 text-ink', f.tone && FIGURE_TONE[f.tone])}>
            {f.value}
            {f.unit != null && <span className="ml-1 text-sm text-dim">{f.unit}</span>}
          </dd>
          {f.sub && <dd className="mt-0.5 text-xs text-dim">{f.sub}</dd>}
        </div>
      ))}
    </dl>
  )
}

/**
 * A mode measured in units: bets, rungs, floors. Each unit is a short bar;
 * spent units dim, the current one carries the felt line, checkpoints stand taller.
 */
export function UnitTrack({
  total,
  done,
  current,
  checkpointEvery,
  label,
  className,
}: {
  total: number
  /** Units already spent or cleared. */
  done: number
  /** Index (0-based) of the unit in play, if any. */
  current?: number
  checkpointEvery?: number
  label: string
  className?: string
}) {
  return (
    <div role="img" aria-label={label} className={cn('flex items-end gap-[3px]', className)}>
      {Array.from({ length: total }, (_, i) => {
        const checkpoint = checkpointEvery != null && (i + 1) % checkpointEvery === 0
        const isCurrent = current === i
        return (
          <span
            key={i}
            style={{ '--d': `${i * 22}ms` } as CSSProperties}
            className={cn(
              'w-full min-w-[4px] max-w-[18px] rounded-[1px]',
              checkpoint ? 'h-[14px]' : 'h-[9px]',
              isCurrent ? 'unit-current bg-felt' : cn('unit', i < done ? 'bg-soft' : 'bg-control'),
            )}
          />
        )
      })}
    </div>
  )
}

/** Signed money in the text, not in colour alone: "+1.2K", "−300", "0". */
export function signed(value: number, format: (n: number) => string): string {
  if (value > 0) return `+${format(value)}`
  if (value < 0) return `−${format(-value)}`
  return format(0)
}

export function toneOf(value: number): FigureTone | undefined {
  return value > 0 ? 'win' : value < 0 ? 'loss' : undefined
}
