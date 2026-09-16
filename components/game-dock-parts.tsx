'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { GameDockRandomQuote } from '@/components/game-dock-random-quote'
import { useOpeningTicketActive } from '@/hooks/use-opening-ticket'
import { getOpeningTicketCapMultiplier } from '@/lib/survival/survival-perks'
import { useSurvivalStore } from '@/store/survival-store'
import { formatCurrentBetLine, formatOutcomeDisplayText } from '@/lib/game-result-labels'
import { formatChips } from '@/utils/format'

/** Standard chip denominations — copy across games via import. */
export const GAME_CHIPS = [
  { value: 10, label: '$10', cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25, label: '$25', cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
] as const

/** Inner wrapper for GAME_CONTROL_DOCK_M — fills dock; middle row grows above actions. */
export const GAME_DOCK_INNER = 'flex flex-1 min-h-0 w-full flex-col py-3'

/** Middle dock row — fills space above action buttons; centers bet / outcome content. */
export const GAME_DOCK_SETTLED_SLOT =
  'flex-1 min-h-0 w-full flex flex-col items-center justify-center'

/** Bottom dock row — primary / leave buttons (shrink-0 so middle row keeps flex space). */
export const GAME_DOCK_ACTIONS = 'shrink-0 w-full flex flex-col items-center gap-1'

const CHIP_BTN =
  'w-12 h-12 rounded-full border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100'

const FRAC_BTN =
  'h-12 px-3 rounded-full border-2 font-bold text-sm shadow-lg transition-all duration-100 active:scale-90 hover:scale-105 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100'

const BET_SECTION_TITLE =
  'text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-400 leading-tight'

const OUTCOME_COL_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-zinc-500 leading-tight'

export const GAME_DOCK_GAME_OVER_BTN =
  'min-w-[10.5rem] px-7 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors text-base shadow-lg'

export const GAME_DOCK_LEAVE_BTN =
  'px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white font-bold rounded-lg transition-colors text-base'

export const GAME_DOCK_PRIMARY_BTN =
  'min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg'

export function GameDockBackButton({
  mode,
  visible,
}: {
  mode: 'freeplay' | 'survival'
  visible: boolean
}) {
  const router = useRouter()
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={() => router.push(`/${mode}`)}
      className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors"
    >
      {mode === 'survival' ? '← Lobby' : '← Game Selection'}
    </button>
  )
}

export function GameDockGameOverButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={GAME_DOCK_GAME_OVER_BTN}>
      Game Over
    </button>
  )
}

export function GameDockLeaveButton({
  mode,
  className = GAME_DOCK_LEAVE_BTN,
}: {
  mode: 'freeplay' | 'survival'
  className?: string
}) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push(`/${mode}`)} className={className}>
      ← Leave
    </button>
  )
}

/** Settled row: Leave + Next in freeplay; Game Over when survival run is lost. */
export function GameDockSettledActions({
  mode,
  showGameOver,
  onGameOver,
  onNext,
  nextLabel = 'Next →',
}: {
  mode: 'freeplay' | 'survival'
  showGameOver: boolean
  onGameOver: () => void
  onNext: () => void
  nextLabel?: string
}) {
  if (showGameOver) {
    return (
      <div className="flex justify-center gap-2">
        <GameDockGameOverButton onClick={onGameOver} />
      </div>
    )
  }
  return (
    <div className="flex justify-center gap-2">
      <GameDockLeaveButton mode={mode} />
      <button type="button" onClick={onNext} className={GAME_DOCK_PRIMARY_BTN}>
        {nextLabel}
      </button>
    </div>
  )
}

export function hasOutcomeEntry(entry: {
  betSummary?: string
  resultSummary?: string
  profitLabel?: string
}): boolean {
  return !!(entry.betSummary && entry.resultSummary && entry.profitLabel)
}

export type GameOutcomeColumnsSize = 'dock' | 'compact' | 'history'

export function GameOutcomeColumns({
  betSummary,
  resultSummary,
  profitLabel,
  profitTone,
  size = 'dock',
}: {
  betSummary: string
  resultSummary: string
  profitLabel: string
  profitTone: 'win' | 'loss'
  size?: GameOutcomeColumnsSize
}) {
  const profitColor = profitTone === 'win' ? 'text-emerald-400' : 'text-red-400'
  const bet = formatOutcomeDisplayText(betSummary)
  const result = formatOutcomeDisplayText(resultSummary)

  if (size === 'dock') {
    const dockLabelCls =
      'text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-zinc-500 leading-tight mb-0.5 sm:mb-1 shrink-0'
    const dockBoxCls =
      'flex min-h-[3.25rem] sm:min-h-[4.25rem] flex-col justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 px-1.5 py-1.5 sm:px-2.5 sm:py-2 text-center'
    return (
      <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2">
        <div className={dockBoxCls}>
          <p className={dockLabelCls}>Your bet</p>
          <p className="text-xs sm:text-base font-semibold text-zinc-100 leading-tight line-clamp-2">{bet}</p>
        </div>
        <div className={dockBoxCls}>
          <p className={dockLabelCls}>Result</p>
          <p className="text-xs sm:text-base font-semibold text-zinc-100 leading-tight truncate" title={result}>
            {result}
          </p>
        </div>
        <div className={dockBoxCls}>
          <p className={dockLabelCls}>Profit</p>
          <p className={`text-base sm:text-2xl font-black tabular-nums leading-tight ${profitColor}`}>
            {profitLabel}
          </p>
        </div>
      </div>
    )
  }

  const valueCls =
    size === 'history'
      ? 'text-sm font-semibold text-zinc-100 leading-tight'
      : 'text-xs font-semibold text-zinc-200 leading-tight'
  const profitCls =
    size === 'history'
      ? `text-base font-black tabular-nums leading-tight ${profitColor}`
      : `text-sm font-black tabular-nums leading-tight ${profitColor}`

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="min-w-0 text-center">
        <p className={OUTCOME_COL_LABEL}>Your bet</p>
        <p className={`${valueCls} line-clamp-2 mt-1`}>{bet}</p>
      </div>
      <div className="min-w-0 text-center">
        <p className={OUTCOME_COL_LABEL}>Result</p>
        <p className={`${valueCls} truncate mt-1`} title={result}>
          {result}
        </p>
      </div>
      <div className="min-w-0 text-center">
        <p className={OUTCOME_COL_LABEL}>Profit</p>
        <p className={`${profitCls} mt-1`}>{profitLabel}</p>
      </div>
    </div>
  )
}

export function GameCurrentBetBadge({
  betAmount,
  betSpecification,
  visible = true,
}: {
  betAmount: number
  betSpecification?: string
  visible?: boolean
}) {
  if (!visible || betAmount <= 0) return null
  return (
    <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2.5 shadow-lg max-w-[min(13rem,48vw)]">
      <p className={`${BET_SECTION_TITLE} mb-2`}>Current bet</p>
      <p className="text-base font-bold text-white tabular-nums leading-tight truncate">
        {formatCurrentBetLine(betAmount, betSpecification)}
      </p>
    </div>
  )
}

export function GameLastBetPanel({
  betSummary,
  resultSummary,
  profitLabel,
  profitTone,
  historyOpen,
  onToggleHistory,
}: {
  betSummary: string
  resultSummary: string
  profitLabel: string
  profitTone: 'win' | 'loss'
  historyOpen: boolean
  onToggleHistory: () => void
}) {
  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-30 max-w-[min(17rem,56vw)]">
      <button
        type="button"
        onClick={onToggleHistory}
        aria-expanded={historyOpen}
        className="w-full rounded-xl border border-zinc-700/90 bg-zinc-950/95 px-3 py-2.5 text-left shadow-lg backdrop-blur-sm hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
      >
        <p className={`${BET_SECTION_TITLE} mb-2`}>Last bet</p>
        <GameOutcomeColumns
          betSummary={betSummary}
          resultSummary={resultSummary}
          profitLabel={profitLabel}
          profitTone={profitTone}
          size="compact"
        />
        <p className="mt-2 text-center text-[10px] text-zinc-600">
          {historyOpen ? 'Hide full history' : 'Open full history'}
        </p>
      </button>
    </div>
  )
}

export function GameActiveBetBadge({
  betAmount,
  betType,
  extra,
  visible = true,
}: {
  betAmount: number
  betType?: string
  extra?: string
  visible?: boolean
}) {
  const spec = [betType, extra].filter(Boolean).join(' \u00b7 ') || undefined
  return (
    <GameCurrentBetBadge
      betAmount={betAmount}
      betSpecification={spec}
      visible={visible}
    />
  )
}

export function OpeningTicketBetMarker({ className = '' }: { className?: string }) {
  return (
    <span
      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 px-1.5 py-0.5 rounded-md border border-emerald-500/50 bg-emerald-950/55 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse ${className}`}
    >
      ✦ Opening Ticket
    </span>
  )
}

export function GameDockBetRow({
  currentBet,
  onClear,
  label = 'Bet',
}: {
  currentBet: number
  onClear: () => void
  label?: string
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap justify-center">
      <span className="text-zinc-500 text-base">{label}</span>
      <span className="font-bold text-xl text-white tabular-nums">
        {currentBet > 0 ? formatChips(currentBet) : '—'}
      </span>
      {currentBet > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-0.5 text-xs font-medium rounded border border-zinc-700 hover:border-zinc-500 text-zinc-500 hover:text-white transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export function GameDockSettledRow({
  betSummary,
  resultSummary,
  profitLabel,
  tone,
}: {
  betSummary: string
  resultSummary: string
  profitLabel: string
  tone: 'win' | 'loss'
}) {
  return (
    <div className="flex w-full max-w-lg items-center justify-center px-1">
      <GameOutcomeColumns
        betSummary={betSummary}
        resultSummary={resultSummary}
        profitLabel={profitLabel}
        profitTone={tone}
        size="dock"
      />
    </div>
  )
}

export function GameDockChipRow({
  visible,
  bankroll,
  currentBet,
  onAddChip,
  quoteIdx,
  showQuote = false,
  minBet,
}: {
  visible: boolean
  bankroll: number
  currentBet: number
  onAddChip: (value: number) => void
  quoteIdx?: number
  showQuote?: boolean
  minBet?: number
}) {
  const openingTicketActive = useOpeningTicketActive()
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)
  const openingTicketCap = minBet ? minBet * getOpeningTicketCapMultiplier(purchasedUpgrades) : 0
  const useSurvivalChips = (minBet ?? 1) > 1
  const survivalChips = useSurvivalChips
    ? [
        { value: minBet!, label: formatChips(minBet!) },
        { value: Math.round(minBet! * 2.5), label: formatChips(Math.round(minBet! * 2.5)) },
        { value: Math.round(minBet! * 10), label: formatChips(Math.round(minBet! * 10)) },
        { value: Math.round(minBet! * 50), label: formatChips(Math.round(minBet! * 50)) },
      ]
    : null

  return (
    <div
      className={`flex shrink-0 flex-nowrap justify-center items-center gap-2 min-h-12 ${!visible ? 'hidden' : ''}`}
    >
      {showQuote && quoteIdx !== undefined ? (
        <GameDockRandomQuote quoteIdx={quoteIdx} />
      ) : (
        <>
          {openingTicketActive && useSurvivalChips && minBet ? (
            <button
              type="button"
              onClick={() => onAddChip(openingTicketCap - currentBet)}
              disabled={currentBet >= openingTicketCap}
              className={`${FRAC_BTN} bg-emerald-950 hover:bg-emerald-900 border-emerald-600 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]`}
            >
              Opening Ticket
            </button>
          ) : (
            <>
              {useSurvivalChips
                ? survivalChips!.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onAddChip(chip.value)}
                      disabled={chip.value > bankroll - currentBet}
                      className={`${FRAC_BTN} bg-amber-950 hover:bg-amber-900 border-amber-800 text-amber-300`}
                    >
                      {chip.label}
                    </button>
                  ))
                : GAME_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onAddChip(chip.value)}
                      disabled={chip.value > bankroll - currentBet}
                      className={`${CHIP_BTN} ${chip.cls}`}
                    >
                      {chip.label}
                    </button>
                  ))}
              <button
                type="button"
                onClick={() => onAddChip(Math.max(Math.floor(bankroll / 4), minBet ?? 1))}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className={`${FRAC_BTN} bg-blue-100 hover:bg-blue-50 border-blue-200 text-blue-900`}
              >
                ¼
              </button>
              <button
                type="button"
                onClick={() => onAddChip(Math.max(Math.floor(bankroll / 2), minBet ?? 1))}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className={`${FRAC_BTN} bg-blue-50 hover:bg-white border-blue-100 text-blue-900`}
              >
                ½
              </button>
              <button
                type="button"
                onClick={() => onAddChip(bankroll)}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className={`${FRAC_BTN} bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900`}
              >
                All In
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function GameBoardHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-zinc-500 text-center px-2 max-w-md">{children}</p>
}
