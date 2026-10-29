'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { playSiteSound } from '@/components/site-sound'

export type GameOutcomeTone = 'win' | 'push' | 'loss' | 'neutral'

export interface GameOutcomeToastSnap {
  title: string
  subtitle?: string
  tone: GameOutcomeTone
}

interface GameOutcomeToastProps {
  open: boolean
  title: string
  subtitle?: string
  tone?: GameOutcomeTone
  onDismiss: () => void
  /** Auto-dismiss delay in ms */
  durationMs?: number
}

export function GameOutcomeToast({
  open,
  title,
  subtitle,
  tone = 'neutral',
  onDismiss,
  durationMs = 1000,
}: GameOutcomeToastProps) {
  useEffect(() => {
    if (!open) return
    if (tone === 'win' || tone === 'loss') playSiteSound(tone)
    const id = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(id)
  }, [open, tone, durationMs, onDismiss])

  if (!open || typeof document === 'undefined') return null

  const titleCls =
    tone === 'win' ? 'text-felt glow-felt' :
    tone === 'loss' ? 'text-loss glow-loss' :
    'text-ink'
  const edge =
    tone === 'win' ? 'shadow-[inset_0_0_0_1px_rgba(79,174,132,0.4),0_0_60px_-10px_rgba(79,174,132,0.55)]' :
    tone === 'loss' ? 'shadow-[inset_0_0_0_1px_rgba(229,86,111,0.4),0_0_60px_-10px_rgba(229,86,111,0.5)]' :
    'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.6)]'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/30 p-0"
        onClick={onDismiss}
        aria-label="Dismiss result"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="game-outcome-title"
        className={cn(
          'rise pointer-events-auto relative z-10 w-full max-w-sm rounded-md bg-surface px-5 py-4 text-center',
          edge,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <p id="game-outcome-title" className={cn('text-xl font-semibold', titleCls)}>
          {title}
        </p>
        {subtitle ? <p className="mt-1 text-[13px] text-soft">{subtitle}</p> : null}
      </div>
    </div>,
    document.body,
  )
}
