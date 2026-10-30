'use client'
import type { GameMode } from '@/store/types'

import { useEffect, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { GameDockRandomQuote } from '@/components/game-dock-random-quote'
import { useOpeningTicketActive } from '@/hooks/use-opening-ticket'
import { useIsLadderRoute } from '@/hooks/use-ladder-all-in'
import { useRouteMode, useRunEndStatus, type RunEndStatus } from '@/hooks/use-run-end'
import { getOpeningTicketCapMultiplier } from '@/lib/survival/survival-perks'
import { useSurvivalStore } from '@/store/survival-store'
import { formatCurrentBetLine, formatOutcomeDisplayText } from '@/lib/game-result-labels'
import { formatChips } from '@/utils/format'

/** Standard chip denominations — copy across games via import. */
export const GAME_CHIPS = [
  { value: 10, label: '10', chip: '#e9e6df', ink: '#1d1c21' },
  { value: 25, label: '25', chip: '#2f8a62', ink: '#f4f1ea' },
  { value: 100, label: '100', chip: '#1b1a1f', ink: '#d9a441' },
  { value: 500, label: '500', chip: '#b83a50', ink: '#f4f1ea' },
] as const

/** Survival's chips scale with the floor's min bet; they wear the floor's colours in the same order. */
const SURVIVAL_CHIP_COLOURS = GAME_CHIPS.map(({ chip, ink }) => ({ chip, ink }))

function chipStyle(chip: string, ink: string): CSSProperties {
  return { '--chip': chip, '--chip-ink': ink } as CSSProperties
}

/** Inner wrapper for GAME_CONTROL_DOCK_M — fills dock; middle row grows above actions. */
export const GAME_DOCK_INNER = 'flex flex-1 min-h-0 w-full flex-col py-3'

/** Middle dock row — fills space above action buttons; centers bet / outcome content. */
export const GAME_DOCK_SETTLED_SLOT =
  'flex-1 min-h-0 w-full flex flex-col items-center justify-center'

/** Bottom dock row — primary / leave buttons (shrink-0 so middle row keeps flex space). */
export const GAME_DOCK_ACTIONS = 'shrink-0 w-full flex flex-col items-center gap-1'

/** A chip: a 44–48px disc, the value on its face in mono. */
const CHIP_BTN =
  'chip num flex h-11 w-11 shrink-0 items-center justify-center text-[12px] font-semibold sm:h-12 sm:w-12 sm:text-[13px]'

/** Bet-size shortcuts beside the chips: outlined pills at chip height. */
const FRAC_BTN =
  'm-still h-11 shrink-0 whitespace-nowrap rounded-full border border-control px-3 text-[13px] font-semibold text-ink transition-[border-color,background-color,transform,box-shadow] duration-150 hover:border-felt hover:bg-felt-tint hover:shadow-[0_0_18px_-6px_rgba(79,174,132,0.7)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:h-12 sm:px-3.5'

const BET_SECTION_TITLE = 'text-xs leading-tight text-dim'

const OUTCOME_COL_LABEL = 'text-xs leading-tight text-dim'

export const GAME_DOCK_GAME_OVER_BTN =
  'm-still min-w-[10.5rem] h-10 px-7 rounded-full border border-loss bg-loss-tint text-loss font-semibold text-[14px] transition-[background-color,box-shadow,transform] hover:shadow-[0_0_24px_-6px_rgba(229,86,111,0.7)] active:scale-[0.97]'

const RUN_STATUS_TONE: Record<RunEndStatus['tone'], string> = {
  win: 'text-felt glow-felt',
  loss: 'text-loss glow-loss',
  neutral: 'text-soft',
}

export const GAME_DOCK_LEAVE_BTN =
  'm-still h-10 px-5 rounded-full border border-control text-soft hover:border-dim hover:text-ink font-medium text-[14px] transition-colors active:scale-[0.97]'

export const GAME_DOCK_PRIMARY_BTN =
  'btn-glow m-still min-w-[10.5rem] h-10 px-7 rounded-full border border-[rgba(217,164,65,0.45)] bg-[linear-gradient(180deg,#286746,#1b4d34)] text-[#fffaf0] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_0_rgba(0,0,0,0.35)] hover:border-gold hover:bg-[linear-gradient(180deg,#327953,#235d3f)] disabled:border-line disabled:bg-raised disabled:text-dim disabled:shadow-none font-semibold text-[14px] transition-[background-color,border-color,box-shadow,transform] active:scale-[0.97]'

/** Secondary in-round action (Stand, Cash out alternatives): a raised pill. */
export const GAME_DOCK_SECONDARY_BTN =
  'm-still min-w-[5.25rem] h-10 px-6 rounded-full bg-raised text-ink hover:bg-control font-semibold text-[14px] transition-[background-color,transform] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed'

const BOARD_CORNER_BTN =
  'h-8 rounded-full border border-control bg-ground px-3.5 text-[13px] font-medium text-soft transition-colors hover:border-dim hover:text-ink'

/** Top-left of the board between rounds: back to the mode's hub, and this game's How to play page. */
export function GameDockBackButton({
  mode,
  visible,
}: {
  mode: GameMode
  visible: boolean
}) {
  const router = useRouter()
  const game = useParams<{ game?: string }>()?.game
  if (!visible) return null
  return (
    <div className="absolute left-3 top-3 z-10 flex gap-2">
      <button type="button" onClick={() => router.push(`/${mode}`)} className={BOARD_CORNER_BTN}>
        {mode === 'survival' ? '← Lobby' : mode === 'daily' ? '← Daily' : mode === 'ladder' ? '← Ladder' : '← All games'}
      </button>
      {game && (
        <Link href={`/how-to-play/${game}`} className={`${BOARD_CORNER_BTN} inline-flex items-center gap-1.5`}>
          <span
            aria-hidden
            className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none"
          >
            ?
          </span>
          How to play
        </Link>
      )}
    </div>
  )
}

/** Run-ending action (End run / Continue / Back to ladder / Refill chips) — label and style follow the run status. */
export function GameDockGameOverButton({ onClick }: { onClick: () => void }) {
  const action = useRunEndStatus(useRouteMode())?.action
  return (
    <button
      type="button"
      onClick={onClick}
      className={action?.tone === 'primary' ? GAME_DOCK_PRIMARY_BTN : GAME_DOCK_GAME_OVER_BTN}
    >
      {action?.label ?? 'Game Over'}
    </button>
  )
}

export function GameDockLeaveButton({
  mode,
  className = GAME_DOCK_LEAVE_BTN,
}: {
  mode: GameMode
  className?: string
}) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push(`/${mode}`)} className={className}>
      ← Leave
    </button>
  )
}

/** Settled row: Leave + Next, or the run-ending action once the run is over (or a floor / rung is done). */
export function GameDockSettledActions({
  mode,
  showGameOver,
  onGameOver,
  onNext,
  nextLabel = 'Next →',
}: {
  mode: GameMode
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
  runStatus,
}: {
  betSummary: string
  resultSummary: string
  profitLabel: string
  profitTone: 'win' | 'loss'
  size?: GameOutcomeColumnsSize
  /** Dock only: what the round meant for the run, shown under the round's result. */
  runStatus?: RunEndStatus | null
}) {
  const profitColor = profitTone === 'win' ? 'text-felt glow-felt' : 'text-loss glow-loss'
  const bet = formatOutcomeDisplayText(betSummary)
  const result = formatOutcomeDisplayText(resultSummary)

  if (size === 'dock') {
    const dockLabelCls = 'text-[11px] sm:text-xs text-dim leading-tight mb-0.5 sm:mb-1 shrink-0'
    const dockBoxCls =
      'flex min-h-[3.25rem] sm:min-h-[4.25rem] flex-col justify-center bg-surface px-1.5 py-1.5 sm:px-3 sm:py-2 text-center'
    return (
      <div className="rise grid w-full grid-cols-3 gap-px overflow-hidden rounded-md bg-line">
        <div className={dockBoxCls}>
          <p className={dockLabelCls}>Your bet</p>
          <p className="text-xs sm:text-[15px] font-semibold text-ink leading-tight line-clamp-2">{bet}</p>
        </div>
        <div className={dockBoxCls}>
          <p className={dockLabelCls}>Result</p>
          <p className="text-xs sm:text-[15px] font-semibold text-ink leading-tight truncate" title={result}>
            {result}
          </p>
          {runStatus && (
            <p
              className={`text-[11px] sm:text-[13px] font-semibold leading-tight line-clamp-2 mt-0.5 ${RUN_STATUS_TONE[runStatus.tone]}`}
            >
              {runStatus.text}
            </p>
          )}
        </div>
        <div className={dockBoxCls}>
          <p className={dockLabelCls}>Profit</p>
          <p className={`num text-base sm:text-[22px] leading-tight ${profitColor}`}>
            {profitLabel}
          </p>
        </div>
      </div>
    )
  }

  const valueCls =
    size === 'history'
      ? 'text-[13px] font-semibold text-ink leading-tight'
      : 'text-xs font-semibold text-soft leading-tight'
  const profitCls =
    size === 'history'
      ? `num text-[15px] leading-tight ${profitColor}`
      : `num text-[13px] leading-tight ${profitColor}`

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
    <div className="rise pointer-events-none absolute left-3 top-3 z-10 max-w-[min(13rem,48vw)] select-none rounded-md bg-ground/90 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      <p className={`${BET_SECTION_TITLE} mb-1`}>Current bet</p>
      <p className="num truncate text-[15px] leading-tight text-ink">
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
    <div className="pointer-events-auto absolute right-3 top-3 z-30 max-w-[min(17rem,56vw)]">
      <button
        type="button"
        onClick={onToggleHistory}
        aria-expanded={historyOpen}
        className="w-full rounded-md bg-ground/90 px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm transition-[box-shadow,background-color] hover:bg-raised hover:shadow-[inset_0_0_0_1px_rgba(79,174,132,0.35)]"
      >
        <p className={`${BET_SECTION_TITLE} mb-2`}>Last bet</p>
        <GameOutcomeColumns
          betSummary={betSummary}
          resultSummary={resultSummary}
          profitLabel={profitLabel}
          profitTone={profitTone}
          size="compact"
        />
        <p className="mt-2 text-center text-[11px] text-dim">
          {historyOpen ? 'Hide history' : 'Full history →'}
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
      className={`unit-current shrink-0 rounded-full bg-felt-tint px-2 py-0.5 text-[11px] font-semibold text-felt ${className}`}
    >
      Opening ticket
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
  // Ladder bets are always the whole pot — nothing to clear.
  const ladder = useIsLadderRoute()
  return (
    <div className="flex items-center gap-2.5 flex-wrap justify-center">
      <span className="text-[14px] text-dim">{ladder ? 'All-in' : label}</span>
      <span className="num text-xl text-ink">
        {currentBet > 0 ? formatChips(currentBet) : '—'}
      </span>
      {currentBet > 0 && !ladder && (
        <button
          type="button"
          onClick={onClear}
          className="h-6 rounded-full border border-control px-2.5 text-xs text-dim transition-colors hover:border-loss hover:text-loss"
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
  const runStatus = useRunEndStatus(useRouteMode())
  return (
    <div className="flex w-full max-w-lg items-center justify-center px-1">
      <GameOutcomeColumns
        betSummary={betSummary}
        resultSummary={resultSummary}
        profitLabel={profitLabel}
        profitTone={tone}
        size="dock"
        runStatus={runStatus}
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
  allInLabel = 'All in',
}: {
  visible: boolean
  bankroll: number
  currentBet: number
  onAddChip: (value: number) => void
  quoteIdx?: number
  showQuote?: boolean
  minBet?: number
  /** The last pill adds everything `bankroll` allows: "All in", or "Max" where that is a table limit. */
  allInLabel?: string
}) {
  const openingTicketActive = useOpeningTicketActive()
  const ladder = useIsLadderRoute()
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
      className={`flex shrink-0 flex-wrap justify-center items-center gap-1.5 sm:gap-2 min-h-12 ${!visible ? 'hidden' : ''}`}
    >
      {showQuote && quoteIdx !== undefined ? (
        <GameDockRandomQuote quoteIdx={quoteIdx} />
      ) : ladder ? (
        <p className="text-[13px] text-soft">The whole pot rides on this round.</p>
      ) : (
        <>
          {openingTicketActive && useSurvivalChips && minBet ? (
            <button
              type="button"
              onClick={() => onAddChip(openingTicketCap - currentBet)}
              disabled={currentBet >= openingTicketCap}
              className={`${FRAC_BTN} border-felt bg-felt-tint text-felt shadow-[0_0_14px_-4px_rgba(79,174,132,0.7)]`}
            >
              Opening ticket
            </button>
          ) : (
            <>
              {useSurvivalChips
                ? survivalChips!.map((chip, i) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onAddChip(chip.value)}
                      disabled={chip.value > bankroll - currentBet}
                      aria-label={`Add ${chip.label}`}
                      className={`${CHIP_BTN} w-auto min-w-11 px-2 sm:min-w-12`}
                      style={chipStyle(SURVIVAL_CHIP_COLOURS[i % 4]!.chip, SURVIVAL_CHIP_COLOURS[i % 4]!.ink)}
                    >
                      <span>{chip.label}</span>
                    </button>
                  ))
                : GAME_CHIPS.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => onAddChip(chip.value)}
                      disabled={chip.value > bankroll - currentBet}
                      aria-label={`Add ${chip.value}`}
                      className={CHIP_BTN}
                      style={chipStyle(chip.chip, chip.ink)}
                    >
                      <span>{chip.label}</span>
                    </button>
                  ))}
              <button
                type="button"
                onClick={() => onAddChip(Math.max(Math.floor(bankroll / 4), minBet ?? 1))}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className={FRAC_BTN}
              >
                ¼
              </button>
              <button
                type="button"
                onClick={() => onAddChip(Math.max(Math.floor(bankroll / 2), minBet ?? 1))}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className={FRAC_BTN}
              >
                ½
              </button>
              <button
                type="button"
                onClick={() => onAddChip(bankroll)}
                disabled={currentBet >= bankroll || bankroll <= 0}
                className={`${FRAC_BTN} border-gold text-gold hover:border-gold hover:bg-gold-tint hover:shadow-[0_0_18px_-6px_rgba(217,164,65,0.8)]`}
              >
                {allInLabel}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

export type DockChip = { value: number; label: string; chip: string; ink: string }

/** The chips a game offers: the standard four, or four scaled to the survival floor's minimum bet. */
export function dockChips(minBet?: number): DockChip[] {
  if ((minBet ?? 1) <= 1) return GAME_CHIPS.map((c) => ({ ...c }))
  return [1, 2.5, 10, 50].map((m, i) => {
    const value = Math.round(minBet! * m)
    return { value, label: formatChips(value), ...SURVIVAL_CHIP_COLOURS[i]! }
  })
}

/** The survival opening ticket as a single chip worth its cap, or null when no ticket is active. */
export function useOpeningTicketChip(minBet?: number): DockChip | null {
  const active = useOpeningTicketActive()
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)
  if (!active || (minBet ?? 1) <= 1) return null
  const value = minBet! * getOpeningTicketCapMultiplier(purchasedUpgrades)
  return { value, label: 'Ticket', chip: '#2f8a62', ink: '#f4f1ea' }
}

/**
 * Chip rack for games where chips are placed on a table (Roulette): pick a value,
 * then each tap on the table places one chip of it. The picked chip sits raised
 * with a gold ring. `children` go after the chips (Undo and the like).
 */
/** A stake picked by share of the bankroll instead of by chip: ¼, ½ or everything left. */
export type StakeFraction = 'quarter' | 'half' | 'all'

const STAKE_FRACTIONS: { value: StakeFraction; label: string }[] = [
  { value: 'quarter', label: '¼' },
  { value: 'half', label: '½' },
  { value: 'all', label: 'All in' },
]

/**
 * What one tap places with a fraction picked: that share of `bankroll` (at least `minBet`),
 * never more than is left to bet. "All in" is everything left.
 */
export function stakeForFraction(fraction: StakeFraction, bankroll: number, remaining: number, minBet = 1): number {
  if (fraction === 'all') return Math.max(remaining, 0)
  const share = Math.floor(bankroll * (fraction === 'quarter' ? 0.25 : 0.5))
  return Math.max(Math.min(Math.max(share, minBet), remaining), 0)
}

export function GameDockChipPicker({
  chips,
  selected,
  onSelect,
  remaining,
  fraction,
  onSelectFraction,
  children,
}: {
  chips: DockChip[]
  selected: number
  onSelect: (value: number) => void
  /** What is left to bet; chips worth more are disabled. */
  remaining: number
  /** The picked share of the bankroll, if any; it overrides the picked chip. */
  fraction?: StakeFraction | null
  /** Shows the ¼ / ½ / All in pills after the chips. */
  onSelectFraction?: (fraction: StakeFraction) => void
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-center gap-1.5 sm:gap-2" role="radiogroup" aria-label="Chip value">
      {chips.map((chip) => {
        const on = !fraction && chip.value === selected
        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(chip.value)}
            disabled={chip.value > remaining}
            aria-label={`${chip.label} chip`}
            className={`${CHIP_BTN} m-still g-lift ${chip.label.length > 3 ? 'text-[9px] tracking-tight sm:text-[10px]' : ''} ${
              on ? '-translate-y-1 ring-2 ring-gold ring-offset-2 ring-offset-ground' : ''
            }`}
            style={chipStyle(chip.chip, chip.ink)}
          >
            <span>{chip.label}</span>
          </button>
        )
      })}
      {onSelectFraction &&
        STAKE_FRACTIONS.map((f) => {
          const on = fraction === f.value
          return (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelectFraction(f.value)}
              disabled={remaining <= 0}
              className={`${FRAC_BTN} ${
                f.value === 'all'
                  ? 'border-gold text-gold hover:border-gold hover:bg-gold-tint hover:shadow-[0_0_18px_-6px_rgba(217,164,65,0.8)]'
                  : ''
              } ${on ? 'ring-2 ring-gold ring-offset-2 ring-offset-ground' : ''}`}
            >
              {f.label}
            </button>
          )
        })}
      {children}
    </div>
  )
}

/** A small outlined pill beside the chip rack (Undo, Rebet). */
export const GAME_DOCK_RACK_BTN = FRAC_BTN

export function GameBoardHint({ children }: { children: ReactNode }) {
  return <p className="max-w-md px-2 text-center text-[13px] text-dim">{children}</p>
}
