'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { hasOutcomeEntry, GameOutcomeColumns, GameLastBetPanel } from '@/components/game-dock-parts'
import { cn } from '@/lib/utils'

export type MatchHistoryTone = 'win' | 'push' | 'loss' | 'partial' | 'neutral'

export interface MatchHistoryEntry {
  id: string
  at: Date
  title: string
  subtitle: string
  tone: MatchHistoryTone
  betSummary?: string
  resultSummary?: string
  profitLabel?: string
  profitTone?: 'win' | 'loss'
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** A round in the history: a surface card with a 2px edge in the colour of its outcome. */
function toneBorder(t: MatchHistoryTone) {
  if (t === 'win') return 'bg-surface shadow-[inset_2px_0_0_var(--felt)]'
  if (t === 'partial') return 'bg-surface shadow-[inset_2px_0_0_var(--gold)]'
  if (t === 'loss') return 'bg-surface shadow-[inset_2px_0_0_var(--loss)]'
  return 'bg-surface shadow-[inset_2px_0_0_var(--control)]'
}

function toneTitle(t: MatchHistoryTone) {
  if (t === 'win') return 'text-felt'
  if (t === 'push') return 'text-ink'
  if (t === 'partial') return 'text-gold'
  if (t === 'loss') return 'text-loss'
  return 'text-soft'
}

/** Wider panel for three-column outcome rows */

function HistoryEntryCard({ entry }: { entry: MatchHistoryEntry }) {
  if (hasOutcomeEntry(entry)) {
    return (
      <div className={cn('rounded-md px-3 py-2.5 text-left', toneBorder(entry.tone))}>
        <p className="num mb-2 text-[11px] text-dim">{formatTime(entry.at)}</p>
        <GameOutcomeColumns
          betSummary={entry.betSummary!}
          resultSummary={entry.resultSummary!}
          profitLabel={entry.profitLabel!}
          profitTone={entry.profitTone ?? 'loss'}
          size="history"
        />
      </div>
    )
  }

  return (
    <div className={cn('rounded-md px-3 py-2 text-left', toneBorder(entry.tone))}>
      <p className="num text-[11px] text-dim">{formatTime(entry.at)}</p>
      <p className={cn('text-[15px] font-semibold', toneTitle(entry.tone))}>{entry.title}</p>
      <p className="mt-0.5 text-xs leading-snug text-dim">{entry.subtitle}</p>
    </div>
  )
}

interface GameFieldWithHistoryProps {
  entries: MatchHistoryEntry[]
  gameLabel: string
  emptyHint?: string
  className?: string
  boardClassName?: string
  showLastBet?: boolean
  children: ReactNode
}

/**
 * Last play capsule on the field; full history opens in a portaled panel fixed to the right of
 * the measured board rect so the playing field layout is never affected.
 */
export function GameFieldWithHistory({
  entries,
  gameLabel,
  emptyHint = 'No plays yet.',
  className,
  boardClassName,
  showLastBet = false,
  children,
}: GameFieldWithHistoryProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const hasPlays = entries.length > 0
  const latest = entries[0]
  const showOutcomeLastBet = showLastBet && latest && hasOutcomeEntry(latest)

  return (
    <div className={cn('relative min-h-0 w-full flex-1 overflow-hidden', className)}>
      <div className={cn('board-fit relative min-h-0 min-w-0 h-full w-full overflow-hidden', boardClassName)}>
        {children}

        {showOutcomeLastBet ? (
          <GameLastBetPanel
            betSummary={latest.betSummary!}
            resultSummary={latest.resultSummary!}
            profitLabel={latest.profitLabel!}
            profitTone={latest.profitTone ?? 'loss'}
            historyOpen={open}
            onToggleHistory={toggle}
          />
        ) : (
          <div className="pointer-events-auto absolute right-3 top-3 z-30">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="h-8 rounded-full border border-control bg-ground/90 px-3.5 text-[13px] font-medium text-soft backdrop-blur-sm transition-colors hover:border-dim hover:text-ink"
            >
              History
            </button>
          </div>
        )}
      </div>

      {open && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-[85] cursor-default border-0 bg-black/40 p-0 backdrop-blur-[1px]"
            onClick={close}
            aria-label="Close history"
          />
          <aside
            className="sheet-in absolute inset-y-0 right-0 z-[90] flex w-[min(18rem,85%)] flex-col overflow-hidden border-l border-line bg-ground shadow-[0_0_60px_rgba(0,0,0,0.7)]"
            aria-label={`${gameLabel} match history`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
              <span className="text-[13px] font-semibold text-ink">History</span>
              <button
                type="button"
                onClick={close}
                className="rounded-full px-2.5 py-1 text-xs text-dim transition-colors hover:bg-raised hover:text-ink"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 py-2">
              {hasPlays ? entries.map((e) => (
                <HistoryEntryCard key={e.id} entry={e} />
              )) : (
                <p className="px-1 pt-2 text-[13px] text-dim">{emptyHint}</p>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
