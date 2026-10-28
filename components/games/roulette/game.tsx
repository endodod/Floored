'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import {
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_SETTLED_SLOT,
  GAME_DOCK_INNER,
  GAME_DOCK_ACTIONS,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockGameOverButton,
  GameDockLeaveButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useRunEnd } from '@/hooks/use-run-end'
import { BOARD_HINT, boardChoice } from '@/components/game-board-ui'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, formatBetSummary, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { rouletteEliminatedNumbers } from '@/games/roulette/engine'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import {
  BET_LABELS,
  EUROPEAN_WHEEL_ORDER,
  getOutcomeLabelForTarget,
  formatRouletteResultLabel,
  getNumberColor,
  getPayoutForTarget,
  initRoulette,
  isNumberCoveredByTarget,
  loseGame,
  spinRoulette,
  spinRouletteWithResult,
  winGame,
} from '@/games/roulette/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { RouletteState } from '@/games/roulette/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

// Standard European roulette board layout: 3 rows top-to-bottom, 12 columns left-to-right
const BOARD_ROWS = [
  [3,  6,  9,  12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2,  5,  8,  11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1,  4,  7,  10, 13, 16, 19, 22, 25, 28, 31, 34],
]

const SPIN_MS = 4600
const SPIN_ANIMATION_MS = 4000 // Wheel tick sequence — long tail, mostly time in the last ticks

/** Per-tick delays: very fast early ticks, very long pauses at the end (normalized to `totalMs`). */
function buildSlowdownDelays(stepCount: number, totalMs: number): number[] {
  if (stepCount <= 0) return []
  const weights: number[] = []
  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 1 : i / (stepCount - 1)
    // Strong exp curve: almost all wall-clock time sits in the final ticks
    weights.push(Math.exp(14.5 * t))
  }
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => (w / sum) * totalMs)
}

// Pocket order follows the real European wheel (each tick shows correct red / black / green)
const WHEEL_POSITIONS: string[] = EUROPEAN_WHEEL_ORDER.map(String)

interface RouletteResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface RouletteGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<RouletteResult>
}

type PendingResult = GamePendingResult

// Pockets wear the chip colours: the 500 red, a near-black, the 25 green.
const POCKET_BG = { red: 'bg-[#b83a50]', black: 'bg-[#2a2930]', green: 'bg-[#2f8a62]' } as const
const POCKET_RIM = { red: 'border-[#e5566f]', black: 'border-control', green: 'border-felt' } as const
const POCKET_DOT = { red: 'bg-[#b83a50]', black: 'bg-[#2a2930] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]' } as const

const RING_OFFSET = 'ring-offset-1 ring-offset-[#101a15]'
const RING_RESULT = `ring-2 ring-white ${RING_OFFSET} shadow-[0_0_16px_rgba(255,255,255,0.35)]`
const RING_SELECTED = `ring-2 ring-[var(--felt)] ${RING_OFFSET} shadow-[0_0_14px_-2px_rgba(79,174,132,0.8)]`
const RING_SPINNING = `ring-2 ring-white/60 ${RING_OFFSET}`

export function RouletteGame({ mode, bankroll, onBet, onResolve }: RouletteGameProps) {
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { rouletteTracker, rouletteTrackerLevel } = useSurvivalPerks('roulette')
  const trackerProc = usePerkProc(
    mode === 'survival' && rouletteTracker,
    'perk_roulette_tracker',
    rouletteTrackerLevel,
  )
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<RouletteState>(initRoulette())
  const [trackerEliminated, setTrackerEliminated] = useState<number[]>([])
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [currentTarget, setCurrentTarget] = useState<string | null>(null)
  const [lastBet, setLastBet] = useState(0)
  const [lastTarget, setLastTarget] = useState<string | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [spinningPosition, setSpinningPosition] = useState<string | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const spinTickRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSpinResult = useRef<number | null>(null)

  const isBetting = round.stage === 'betting' && !spinning
  const isSettled = round.stage === 'settled' && !spinning
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: !spinning })

  // Ball Tracker: proc + eliminated numbers during betting (before spin).
  useEffect(() => {
    if (mode !== 'survival' || !rouletteTracker || !isBetting) {
      pendingSpinResult.current = null
      if (!isBetting) setTrackerEliminated([])
      return
    }
    const proc = trackerProc.rollForBet()
    if (proc) {
      const winning = Math.floor(Math.random() * 37)
      pendingSpinResult.current = winning
      setTrackerEliminated(rouletteEliminatedNumbers(winning))
    } else {
      pendingSpinResult.current = null
      setTrackerEliminated([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- roll once per betting phase
  }, [isBetting, mode, rouletteTracker, round.stage])
  const canSpin =
    currentTarget !== null && currentBet >= minBet && currentBet <= bankroll
  const activeBet = spinning || isSettled ? lastBet : 0
  const potentialWinnings = useMemo(() => {
    if (!spinning || !lastTarget || lastBet <= 0) return 0
    return lastBet * getPayoutForTarget(lastTarget)
  }, [spinning, lastTarget, lastBet])

  function selectTarget(target: string) {
    if (currentTarget === target) {
      setCurrentTarget(null)
    } else {
      setCurrentTarget(target)
    }
  }

  function addChip(value: number) {
    if (!currentTarget) return
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function clearBet() {
    setCurrentBet(0)
    setCurrentTarget(null)
  }

  function handleSpin() {
    if (!canSpin || spinning || !currentTarget || !lock()) return

    const total = currentBet
    const spunTarget = currentTarget

    onBet?.(total)
    setLastBet(currentBet)
    setLastTarget(currentTarget)
    setCurrentBet(0)
    setCurrentTarget(null)
    setPendingResult(null)

    const preRolled = pendingSpinResult.current
    const result = blessed
      ? winGame(spunTarget, total)
      : cursed
        ? loseGame(spunTarget, total)
        : preRolled != null
          ? spinRouletteWithResult(spunTarget, total, preRolled)
          : spinRoulette(spunTarget, total)
    pendingSpinResult.current = null
    setQuoteIdx((prev) => pickQuote(prev))
    setSpinning(true)
    setSpinningPosition(WHEEL_POSITIONS[0] ?? '0')

    const totalSpins = Math.floor(WHEEL_POSITIONS.length * 2.5)
    const tickCount = Math.max(1, totalSpins - 1)
    const tickDelays = buildSlowdownDelays(tickCount, SPIN_ANIMATION_MS)

    const scheduleSpinTick = (tick: number) => {
      if (tick >= tickCount) {
        spinTickRef.current = null
        setSpinningPosition(null)
        return
      }
      spinTickRef.current = setTimeout(() => {
        const positionIndex = tick + 1
        const idx = positionIndex % WHEEL_POSITIONS.length
        const position = WHEEL_POSITIONS[idx]
        if (position) setSpinningPosition(position)
        scheduleSpinTick(tick + 1)
      }, tickDelays[tick] ?? 0)
    }
    scheduleSpinTick(0)

    settleRef.current = setTimeout(() => {
      if (spinTickRef.current) { clearTimeout(spinTickRef.current); spinTickRef.current = null }
      setSpinningPosition(null)
      setSpinning(false)
      setRound(result)

      const outcome = result.outcome ?? 'loss'
      const resolved = resolveGame(onResolve, {
        outcome,
        betAmount: result.totalBetAmount,
        payout: result.totalPayout,
        multiplier: total > 0 ? result.totalPayout / total : 0,
      })

      const resultLabel = formatRouletteResultLabel(
        result.result ?? 0,
        result.resultColor ?? 'green',
      )
      const betLabel = getOutcomeLabelForTarget(spunTarget)
      const partial =
        outcome === 'loss' && result.totalPayout > 0 && result.totalPayout < result.totalBetAmount
      const outcomeWord = outcome === 'win' ? 'Win!' : outcome === 'push' ? 'Push' : partial ? 'Partial return' : 'Miss'
      const built = buildPendingResult(
        { outcome, betAmount: result.totalBetAmount, payout: resolved.payout },
        {
          betSpecification: betLabel,
          result: resultLabel,
        },
        {
          historySubtitle:
            total > 0
              ? `${formatBetSummary(total, betLabel)} → ${resultLabel} · ${outcomeWord}`
              : `${resultLabel} · ${outcomeWord}`,
          freeBet: resolved.firstBetWasFree,
        },
      )
      setPendingResult(built)
    }, SPIN_MS)
  }

  const handleNewRound = useCallback(() => {
    unlock()
    trackerProc.resetPerk()
    setTrackerEliminated([])
    setRound(initRoulette())
    setPendingResult(null)
    if (autoReBet && lastBet > 0 && lastTarget && lastBet <= bankroll) {
      setCurrentBet(lastBet)
      setCurrentTarget(lastTarget)
    }
  }, [autoReBet, lastBet, lastTarget, bankroll])

  function handleNext() {
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  useEffect(() => () => {
    if (spinTickRef.current) clearTimeout(spinTickRef.current)
    if (settleRef.current)   clearTimeout(settleRef.current)
  }, [])


  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Roulette</span>
        <span className="text-[13px] text-dim">{spinning ? 'Spinning…' : round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center px-4 py-4"
        entries={matchHistory}
        gameLabel="Roulette"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {trackerProc.perkActive && trackerEliminated.length > 0 && isBetting && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Not winning: {trackerEliminated.join(', ')}
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={activeBet}
          betType={activeBet > 0 && lastTarget ? getOutcomeLabelForTarget(lastTarget) : undefined}
          visible={activeBet > 0 && !isBetting}
        />

        <div className="flex min-h-0 flex-1 w-full flex-col items-center">
          <div className="min-h-0 flex-1 shrink" aria-hidden />
          <div className="flex w-full flex-col items-center gap-4 shrink-0">
            <div className="relative flex h-[5.5rem] shrink-0 items-center justify-center">
              {spinning && (
                <div className="absolute inset-0 rounded-full animate-ping border border-white/20 scale-110" />
              )}
              <div
                className={`
            w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center transition-colors duration-300
            ${
              spinning && spinningPosition
                ? (() => {
                    const c = spinningPosition === '0' ? 'green' : getNumberColor(parseInt(spinningPosition, 10))
                    return `${POCKET_BG[c]} ${POCKET_RIM[c]}`
                  })()
                : isSettled
                  ? `${POCKET_BG[round.resultColor ?? 'green']} ${POCKET_RIM[round.resultColor ?? 'green']}`
                  : 'bg-black/30 border-control'
            }
          `}
              >
                <span
                  className={`text-2xl sm:text-3xl font-semibold tabular-nums transition-colors ${
                    isSettled ? 'text-ink' : spinning ? 'text-soft' : 'text-dim'
                  }`}
                >
                  {spinning ? (spinningPosition ?? '?') : isSettled ? round.result : '?'}
                </span>
              </div>
            </div>

            <div className={`flex flex-col gap-0.5 shrink-0 ${!isBetting ? 'pointer-events-none' : ''}`}>
              {(() => {
                const isDirectlyActive = currentTarget === '0'
                const isGroupActive = isBetting && currentTarget !== null && !isDirectlyActive && isNumberCoveredByTarget(0, currentTarget)
                const isActive = isDirectlyActive || isGroupActive
                const isResult = isSettled && round.result === 0
                const isSpinningTile = spinningPosition === '0'
                return (
                  <button
                    type="button"
                    onClick={() => selectTarget('0')}
                    className={[
                      `relative h-6 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-semibold tabular-nums text-white ${POCKET_BG.green} transition-all duration-150 select-none`,
                      isResult
                        ? RING_RESULT
                        : isActive
                          ? RING_SELECTED
                          : isSpinningTile
                            ? RING_SPINNING
                            : '',
                      isBetting ? 'cursor-pointer hover:brightness-125 active:scale-95' : 'cursor-default',
                    ].join(' ')}
                  >
                    0
                  </button>
                )
              })()}

              {BOARD_ROWS.map((row, ri) => (
                <div key={ri} className="flex gap-0.5">
                  {row.map((n) => {
                    const nStr = String(n)
                    const isDirectlyActive = currentTarget === nStr
                    const isGroupActive = isBetting && currentTarget !== null && !isDirectlyActive && isNumberCoveredByTarget(n, currentTarget)
                    const isActive = isDirectlyActive || isGroupActive
                    const isResult = isSettled && round.result === n
                    const isSpinningTile = spinningPosition === nStr
                    const color = getNumberColor(n)
                    const colorBase = POCKET_BG[color]
                    const ring = isResult
                      ? `${RING_RESULT} scale-110 z-10`
                      : isActive
                        ? `${RING_SELECTED} z-10`
                        : isSpinningTile
                          ? RING_SPINNING
                          : ''
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => selectTarget(nStr)}
                        className={[
                          'relative w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-semibold tabular-nums text-white transition-all duration-150 select-none',
                          colorBase,
                          ring,
                          isBetting ? 'cursor-pointer hover:brightness-125 active:scale-90' : 'cursor-default',
                        ].join(' ')}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="flex min-h-10 w-full shrink-0 items-center justify-center">
              <div
                className={`flex flex-wrap justify-center gap-2 ${!isBetting ? 'invisible pointer-events-none' : ''}`}
              >
                {(['red', 'black', 'odd', 'even'] as const).map((type) => {
                  const isActive = currentTarget === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectTarget(type)}
                      className={`${boardChoice(isActive)} !h-9 !min-w-[4.5rem] !px-4 !text-[13px] inline-flex items-center justify-center gap-1.5`}
                    >
                      {(type === 'red' || type === 'black') && (
                        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${POCKET_DOT[type]}`} />
                      )}
                      {BET_LABELS[type]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-h-10 flex w-full items-center justify-center px-2 shrink-0">
              <p className={BOARD_HINT}>
                {isBetting
                  ? 'Select a number or outside bet, add chips, then spin.'
                  : spinning
                    ? 'Wheel spinning…'
                    : isSettled && round.result !== null
                      ? round.result === 0
                        ? 'Zero · Green'
                        : [
                            `${round.result}`,
                            round.resultColor === 'red' ? 'Red' : 'Black',
                            (round.result ?? 0) % 2 === 1 ? 'Odd' : 'Even',
                          ].join(' · ')
                      : '\u00A0'}
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 shrink" aria-hidden />
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || spinning}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={spinning}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && (
              <>
                <GameDockBetRow
                  currentBet={currentBet}
                  onClear={clearBet}
                />
              </>
            )}
            {spinning && potentialWinnings > 0 && (
              <p className="text-sm text-soft">
                Potential total winnings:{' '}
                <span className="font-semibold text-felt">{formatChips(potentialWinnings)}</span>
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
            {!isBetting && !spinning && !(isSettled && pendingResult) && (
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
                    onClick={isSettled ? handleNext : handleSpin}
                    disabled={!isSettled && (!canSpin || spinning)}
                    className={GAME_DOCK_PRIMARY_BTN}
                  >
                    {isSettled ? 'Next →' : spinning ? 'Spinning…' : 'Spin →'}
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
