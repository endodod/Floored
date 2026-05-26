'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import {
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
import { useSurvivalGameOver } from '@/hooks/use-survival-game-over'
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
import type { RouletteBetType, RouletteState } from '@/games/roulette/types'

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
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<RouletteResult>
}

type PendingResult = GamePendingResult

function betBtnStyle(type: RouletteBetType, isActive: boolean): string {
  const base = 'rounded-lg transition-all duration-150 flex flex-col items-center'

  const activeStyle = 'bg-yellow-400 border-yellow-300 text-zinc-900'

  if (type === 'red') return `${base} border-2 ${
    isActive ? activeStyle :
               'bg-red-950/70 border-red-700 text-red-300 hover:bg-red-900/80 hover:border-red-500 hover:text-red-100'
  }`

  if (type === 'black') return `${base} border-2 ${
    isActive ? activeStyle :
               'bg-black border-zinc-600 text-zinc-100 hover:bg-zinc-950 hover:border-zinc-400 hover:text-white'
  }`

  if (type === 'green') return `${base} border-2 ${
    isActive ? activeStyle :
               'bg-emerald-950/70 border-emerald-700 text-emerald-300 hover:bg-emerald-900/80 hover:border-emerald-500 hover:text-emerald-100'
  }`

  return `${base} border-2 ${
    isActive ? activeStyle :
               'bg-zinc-900 border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white'
  }`
}

export function RouletteGame({ mode, bankroll, onBet, onResolve }: RouletteGameProps) {
  const { floorMinBet } = useSurvivalStore()
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
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<RouletteState>(initRoulette())
  const [trackerEliminated, setTrackerEliminated] = useState<number[]>([])
  const [currentBet, setCurrentBet] = useState(0)
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
  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, { idle: !spinning })

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
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Roulette</span>
        <span className="text-sm text-zinc-600">{spinning ? 'Spinning…' : round.message}</span>
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
                <div className="absolute inset-0 rounded-full animate-ping border-2 border-white/20 scale-110" />
              )}
              <div
                className={`
            w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center transition-colors duration-300
            ${
              spinning && spinningPosition
                ? spinningPosition === '0'
                  ? 'bg-emerald-700 border-emerald-400'
                  : getNumberColor(parseInt(spinningPosition, 10)) === 'red'
                    ? 'bg-red-700 border-red-400'
                    : 'bg-zinc-600 border-zinc-400'
                : isSettled
                  ? round.resultColor === 'red'
                    ? 'bg-red-700 border-red-400'
                    : round.resultColor === 'black'
                      ? 'bg-zinc-600 border-zinc-400'
                      : 'bg-emerald-700 border-emerald-400'
                  : 'bg-zinc-800/50 border-zinc-700'
            }
          `}
              >
                <span
                  className={`text-2xl sm:text-3xl font-black tabular-nums transition-colors ${
                    isSettled ? 'text-white' : spinning ? 'text-white/80' : 'text-zinc-600'
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
                      'relative h-6 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold text-white bg-emerald-700 transition-all duration-150 select-none',
                      isResult
                        ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 shadow-lg shadow-white/20'
                        : isActive
                          ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-950'
                          : isSpinningTile
                            ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-zinc-950'
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
                    const colorBase =
                      color === 'red' ? 'bg-red-700' : color === 'black' ? 'bg-zinc-600' : 'bg-emerald-700'
                    const ring = isResult
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 scale-110 z-10 shadow-lg shadow-white/20'
                      : isActive
                        ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-950 z-10'
                        : isSpinningTile
                          ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-zinc-950'
                          : ''
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => selectTarget(nStr)}
                        className={[
                          'relative w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-[10px] sm:text-xs font-bold text-white transition-all duration-150 select-none',
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
                      className={`${betBtnStyle(type, isActive)} px-3 py-1.5`}
                    >
                      <span className="text-xs font-bold">{BET_LABELS[type]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-h-10 flex w-full items-center justify-center px-2 shrink-0">
              <p className="text-center text-xs text-zinc-500 max-w-md">
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
              <p className="text-sm text-zinc-400">
                Potential total winnings:{' '}
                <span className="font-semibold text-emerald-400">{formatChips(potentialWinnings)}</span>
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
                    className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
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
