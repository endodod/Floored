'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useId, useState } from 'react'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_SETTLED_SLOT,
  GAME_DOCK_INNER,
  GAME_DOCK_ACTIONS,
  GAME_DOCK_PRIMARY_BTN,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockGameOverButton,
  GameDockLeaveButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useRunEnd } from '@/hooks/use-run-end'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { getCrashCushion } from '@/lib/survival/survival-perks'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { computeMultiplier, initCrash, loseGame, startCrashRound, winGame } from '@/games/crash/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { CrashState } from '@/games/crash/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

interface CrashResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface CrashGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<CrashResult>
}

type PendingResult = GamePendingResult

function crashPendingResult(
  outcome: 'win' | 'loss',
  betAmount: number,
  payout: number,
  multiplier: number,
  freeBet?: boolean,
  /** Crash Cushion returned part of the stake: still a loss, by the rest of the stake. */
  cushioned = false,
): PendingResult {
  return buildPendingResult(
    { outcome, betAmount, payout },
    {
      result: formatMultiplier(multiplier),
      resultSpecification: outcome === 'win' ? 'Cashed' : cushioned ? 'Cushioned' : 'Crashed',
    },
    { gameMultiplier: outcome === 'win' ? multiplier : undefined, freeBet },
  )
}

// Inline growth formula so CrashCurve has no engine dependency — matches engine exactly
function mult(ms: number) { return 0.75 * Math.exp(0.23 * ms / 1000) }

function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return `M ${pts[0]![0]} ${pts[0]![1]}`
  let d = `M ${pts[0]![0].toFixed(2)} ${pts[0]![1].toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

// Multiplier gridlines: the fewest nice steps that keep four or five lines on the chart.
function gridSteps(maxMult: number): number[] {
  const steps = [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]
  const step = steps.find(s => (maxMult - 1) / s <= 4) ?? 1000
  const lines: number[] = []
  for (let m = 1; m <= maxMult; m += step) lines.push(m)
  return lines
}

function CrashCurve({
  elapsedMs,
  outcome,
}: {
  elapsedMs: number
  outcome: 'win' | 'loss' | null
}) {
  const gradId = `cx-fill${useId().replace(/:/g, '')}`
  const BOTTOM = 58
  const LEFT   = 2
  const RIGHT  = 158
  const TOP    = 4

  const live    = elapsedMs > 50
  const curMult = live ? mult(elapsedMs) : 0.75
  const maxTime = Math.max(elapsedMs + 3000, 8000)
  const maxMult = Math.max(curMult * 1.8, 3)

  const toX = (t: number) => LEFT + (t / maxTime) * (RIGHT - LEFT)
  const toY = (m: number) => BOTTOM - ((m - 0.75) / (maxMult - 0.75)) * (BOTTOM - TOP)

  const pts: [number, number][] = []
  if (live) {
    const steps = 100
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * elapsedMs
      pts.push([toX(t), toY(mult(t))])
    }
  }
  const last  = pts[pts.length - 1] ?? [LEFT, BOTTOM]
  const lineD = live ? buildSmoothPath(pts) : ''
  const fillD = live ? `${lineD} L ${last[0].toFixed(2)} ${BOTTOM} L ${LEFT} ${BOTTOM} Z` : ''

  // Colour carries meaning: under 1× the stake is losing, past 3× it is real money.
  const tone =
    outcome === 'loss' ? 'loss' :
    outcome === 'win'  ? 'gold' :
    curMult >= 3       ? 'gold' :
    curMult >= 1       ? 'felt' : 'loss'
  const color = `var(--${tone})`

  const seconds: number[] = []
  for (let s = 2000; s < maxTime; s += 2000) seconds.push(s)

  return (
    <div className={`cx-chart relative h-full w-full ${outcome === 'loss' ? 'g-shake' : ''}`}>
      <svg viewBox="0 0 160 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={outcome ? 0.32 : 0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {seconds.map(s => (
          <line key={s} x1={toX(s)} y1={TOP} x2={toX(s)} y2={BOTTOM}
            stroke="rgba(217,164,65,0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {gridSteps(maxMult).map(m => (
          <line key={m} x1={LEFT} y1={toY(m)} x2={RIGHT} y2={toY(m)}
            stroke={m === 1 ? 'rgba(217,164,65,0.4)' : 'rgba(217,164,65,0.14)'}
            strokeDasharray={m === 1 ? '4 4' : undefined}
            strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM}
          stroke="rgba(217,164,65,0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {live && (
          <>
            <path d={fillD} fill={`url(#${gradId})`} />
            <path
              d={lineD}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="cx-line"
              style={{ color }}
            />
          </>
        )}
      </svg>

      {gridSteps(maxMult).map(m => (
        <span
          key={m}
          className="felt-print num pointer-events-none absolute right-1 -translate-y-full pb-0.5"
          style={{ top: `${(toY(m) / 60) * 100}%`, letterSpacing: '0.06em' }}
        >
          {m}×
        </span>
      ))}

      {/* The rocket tip: a lit dot that rides the curve; a burst where it crashed. */}
      <span
        className="pointer-events-none absolute"
        style={{ left: `${(last[0] / 160) * 100}%`, top: `${(last[1] / 60) * 100}%` }}
      >
        {outcome === 'loss' ? (
          <svg viewBox="-12 -12 24 24" className="cx-burst absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2" aria-hidden>
            <path
              d="M0,-11 L2.6,-4.2 L9.5,-5.5 L4.8,0 L9.5,5.5 L2.6,4.2 L0,11 L-2.6,4.2 L-9.5,5.5 L-4.8,0 L-9.5,-5.5 L-2.6,-4.2 Z"
              fill="var(--loss)"
            />
            <circle r="3" fill="var(--ink)" />
          </svg>
        ) : (
          <span
            className={`cx-tip absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${live ? '' : 'cx-ready'}`}
            style={{ background: color, color }}
          />
        )}
      </span>
    </div>
  )
}

export function CrashGame({ mode, bankroll, onBet, onResolve }: CrashGameProps) {
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { crashCushion, crashCushionLevel } = useSurvivalPerks('crash')
  const minBet = useGameMinBet(mode)

  const [round, setRound]         = useState<CrashState>(initCrash())
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet]     = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx]   = useState(() => pickQuote())

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: isBetting || isSettled })
  const canStart     = currentBet >= minBet && currentBet <= bankroll
  const hasCushion   = mode === 'survival' && crashCushion

  const handleNewRound = useCallback(() => {
    unlock()
    setRound(initCrash())
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
    setElapsedMs(0)
  }, [autoReBet, lastBet, bankroll])

  // Drive the live multiplier on a 50ms tick
  useEffect(() => {
    if (!isInProgress) return
    const startTime = Date.now()
    const crashAt   = round.crashAt
    const betAmount = round.betAmount

    const id = setInterval(() => {
      const elapsed = Date.now() - startTime
      const m       = computeMultiplier(elapsed)
      setElapsedMs(elapsed)

      if (m >= crashAt) {
        clearInterval(id)
        const cushionPayout =
          hasCushion && crashAt < 3.0
            ? Math.round(betAmount * getCrashCushion(crashCushionLevel))
            : 0
        setRound(prev => ({
          ...prev,
          stage: 'settled',
          currentMultiplier: crashAt,
          payoutMultiplier: cushionPayout / betAmount,
          outcome: 'loss',
          message: `Crashed at ${formatMultiplier(crashAt)}`,
        }))
        const resolved = resolveGame(onResolve, {
          outcome: 'loss',
          betAmount,
          payout: cushionPayout,
          multiplier: crashAt,
        })
        setPendingResult(
          crashPendingResult(
            'loss',
            betAmount,
            resolved.payout,
            resolved.multiplier ?? crashAt,
            resolved.firstBetWasFree,
            cushionPayout > 0,
          ),
        )
      }
    }, 50)

    return () => {
      clearInterval(id)
    }
  }, [isInProgress, round.crashAt, round.betAmount, onResolve, hasCushion, crashCushionLevel])

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart || !lock()) return
    onBet?.(currentBet)
    setQuoteIdx((prev) => pickQuote(prev))
    setLastBet(currentBet)
    setElapsedMs(0)
    setRound(blessed ? winGame(currentBet) : cursed ? loseGame(currentBet) : startCrashRound(currentBet))
    setCurrentBet(0)
  }

  function handleCashOut() {
    if (!isInProgress) return
    const m       = computeMultiplier(elapsedMs)
    const payout  = Math.round(round.betAmount * m)
    const outcome = m >= 1.0 ? 'win' : 'loss'
    setRound(prev => ({
      ...prev,
      stage: 'settled',
      currentMultiplier: m,
      payoutMultiplier: m,
      outcome,
      message: `Cashed out at ${formatMultiplier(m)}`,
    }))
    const resolved = resolveGame(onResolve, {
      outcome,
      betAmount: round.betAmount,
      payout,
      multiplier: m,
    })
    setPendingResult(
      crashPendingResult(outcome, round.betAmount, resolved.payout, resolved.multiplier ?? m, resolved.firstBetWasFree),
    )
  }

  function handleNextCrash() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  const displayMult = isInProgress ? computeMultiplier(elapsedMs) : round.currentMultiplier

  const multTone =
    isSettled && round.outcome === 'loss' ? 'text-loss' :
    isSettled && round.outcome === 'win'  ? 'text-gold glow-gold' :
    displayMult >= 3 ? 'text-gold glow-gold' :
    displayMult >= 1 ? 'text-felt glow-felt' : 'text-soft'

  return (
    <div className={GAME_CARD_SHELL}>

      {/* Status bar */}
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Crash</span>
        {hasCushion && isBetting && (
          <PerkHint>Cushion: {Math.round(getCrashCushion(crashCushionLevel) * 100)}% back on a sub-3× crash</PerkHint>
        )}
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-3 pt-3 pb-2"
        entries={matchHistory}
        gameLabel="Crash"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge betAmount={round.betAmount} visible={(isInProgress || isSettled) && round.betAmount > 0} />

        <div className="cx-board flex h-full w-full max-w-2xl min-h-0 flex-col items-center">
          <div className="cx-figure relative z-10 flex shrink-0 flex-col items-center justify-center text-center pointer-events-none select-none">
            <p className="text-[11px] text-dim">
              {isBetting
                ? 'Ready'
                : isSettled
                  ? round.outcome === 'win'
                    ? 'Cashed out at'
                    : 'Crashed at'
                  : 'Multiplier'}
            </p>
            <p
              key={isSettled ? 'settled' : 'live'}
              className={`cx-mult num font-semibold leading-none transition-colors duration-200 ${
                isBetting ? 'text-control' : multTone
              } ${isSettled ? 'g-pop' : ''}`}
            >
              {formatMultiplier(isBetting ? 0.75 : displayMult)}
            </p>
          </div>

          <p className="cx-hint shrink-0 px-2 py-1 text-center text-[13px] text-dim">
            {isBetting
              ? mode === 'ladder'
                ? 'Start with the whole pot. Cash out before the curve crashes.'
                : 'Place chips and start. Cash out before the curve crashes.'
              : isInProgress
                ? 'The multiplier rises until it crashes. Cash out any time to lock it in.'
                : '\u00A0'}
          </p>

          <div className="relative min-h-0 w-full flex-1">
            <CrashCurve elapsedMs={elapsedMs} outcome={round.outcome} />
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || isInProgress}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={isInProgress}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isInProgress && (
              <p className="text-[13px] text-soft">
                Cash out now:{' '}
                <span className="num text-felt glow-felt">
                  {formatChips(Math.round(round.betAmount * displayMult))}
                </span>
              </p>
            )}
            {isSettled && pendingResult && (
              <GameDockSettledRow
                betSummary={pendingResult.betSummary}
                resultSummary={pendingResult.resultSummary}
                profitLabel={pendingResult.profitLabel}
                tone={pendingResult.tone}
              />
            )}
            {isSettled && !pendingResult && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className={GAME_DOCK_ACTIONS}>
            <div className="flex justify-center gap-2">
              {showGameOver ? (
                <GameDockGameOverButton onClick={handleGameOver} />
              ) : (
                <>
                  {isSettled && <GameDockLeaveButton mode={mode} />}
                  <button
                    type="button"
                    onClick={isSettled ? handleNextCrash : isInProgress ? handleCashOut : handleStart}
                    disabled={isBetting && !canStart}
                    className={GAME_DOCK_PRIMARY_BTN}
                  >
                    {isSettled
                      ? 'Next →'
                      : isInProgress
                        ? `Cash out · ${formatMultiplier(displayMult)}`
                        : 'Start →'}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
