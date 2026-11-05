'use client'

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A hotspot's actions: a bottom sheet on phones and tablets, a card beside the
 * hotspot on wide screens. Escape, the close button or a tap outside closes it
 * and focus goes back to the hotspot that opened it.
 */
export function ActionSheet({
  anchor,
  title,
  kicker,
  art,
  onClose,
  children,
  size = 'md',
  className,
}: {
  /** The hotspot's place in the stage, 0–1 each way. */
  anchor: { x: number; y: number }
  title: ReactNode
  kicker?: ReactNode
  /** A portrait or picture at the card's left. */
  art?: ReactNode
  onClose: () => void
  children: ReactNode
  /** `lg`: a near-full-height sheet on phones, a large centred panel from `sm` up. */
  size?: 'md' | 'lg'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  const right = anchor.x >= 0.55
  const big = size === 'lg'
  return (
    <>
      <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 z-30 cursor-default bg-black/45 lg:bg-black/20" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ ['--ax' as string]: anchor.x } as CSSProperties}
        className={cn(
          'st-sheet st-motion absolute inset-x-0 bottom-0 z-40 flex flex-col gap-3 rounded-t-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none',
          big
            ? 'h-[calc(100%_-_1rem)] sm:inset-x-0 sm:bottom-auto sm:top-1/2 sm:mx-auto sm:h-auto sm:max-h-[calc(100%_-_2rem)] sm:w-[min(880px,calc(100%_-_3rem))] sm:-translate-y-1/2 sm:rounded-xl sm:p-6 sm:pb-6'
            : 'max-h-[calc(100%_-_1.5rem)] lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:w-[360px] lg:-translate-y-1/2 lg:rounded-xl lg:pb-4',
          // Beside the hotspot, but never past the stage's edge. --sw is the card's width
          // (360px; a wider card sets its own with its width class).
          !big && (right ? 'lg:right-[clamp(1rem,calc((1_-_var(--ax))_*_100%_+_3.5rem),calc(100%_-_var(--sw,360px)_-_1rem))]' : 'lg:left-[clamp(1rem,calc(var(--ax)_*_100%_+_3.5rem),calc(100%_-_var(--sw,360px)_-_1rem))]'),
          className,
        )}
      >
        <div aria-hidden className={cn('mx-auto -mt-1.5 h-1 w-10 shrink-0 rounded-full bg-white/15', big ? 'sm:hidden' : 'lg:hidden')} />
        <div className="flex items-center gap-3">
          {art && <div className="w-12 shrink-0 sm:w-14">{art}</div>}
          <div className="min-w-0 flex-1 pt-0.5">
            {kicker && <p className="felt-print !text-[10px]">{kicker}</p>}
            <h2 id={titleId} className="mt-0.5 text-[18px] font-semibold leading-6 text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-dim hover:bg-white/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className={cn('flex min-h-0 flex-col gap-3', big && 'flex-1')}>{children}</div>
      </div>
    </>
  )
}

/** A line of muted detail inside a sheet. */
export function SheetNote({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'loss' | 'gold' | 'soft' }) {
  return (
    <p className={cn('text-[13px] leading-5', tone === 'dim' && 'text-dim', tone === 'loss' && 'text-loss', tone === 'gold' && 'text-gold', tone === 'soft' && 'text-soft')}>
      {children}
    </p>
  )
}
