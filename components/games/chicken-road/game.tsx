'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  GameDockSettledActions,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useSurvivalGameOver } from '@/hooks/use-survival-game-over'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import {
  cashOutChicken,
  advanceChickenRound,
  advanceChickenRoundSafe,
  getChickenPayout,
  initChicken,
  loseGame,
  startChickenRound,
  winGame,
} from '@/games/chicken-road/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { ChickenState } from '@/games/chicken-road/types'

const MAX_STEPS = 10

interface ChickenResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface ChickenGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<ChickenResult>
}

type PendingResult = GamePendingResult

export function ChickenGame({ mode, bankroll, onBet, onResolve }: ChickenGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { chickenRoadLane, chickenRoadLaneLevel } = useSurvivalPerks('chicken-road')
  const laneProc = usePerkProc(
    mode === 'survival' && chickenRoadLane,
    'perk_chicken_road_lane',
    chickenRoadLaneLevel,
  )
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<ChickenState>(initChicken())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [safeAdvancePending, setSafeAdvancePending] = useState(false)

  const isBetting = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, {
    idle: isBetting || (isSettled && pendingResult != null),
  })
  const canStart = currentBet >= minBet && currentBet <= bankroll
  const potentialWinnings =
    isInProgress && round.betAmount > 0 ? Math.round(round.betAmount * round.multiplier) : 0

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function settleRound(next: ChickenState) {
    const po = getChickenPayout(next)
    const outcome = next.outcome ?? 'loss'
    const resolved = resolveGame(onResolve, {
      outcome,
      betAmount: next.betAmount,
      payout: po,
      multiplier: next.multiplier,
    })
    const partial = outcome === 'win' && po > 0 && po < next.betAmount
    const built = buildPendingResult(
      { outcome, betAmount: next.betAmount, payout: resolved.payout },
      {
        result: outcome === 'loss' ? 'Bust' : String(next.step),
        resultSpecification: outcome === 'loss' ? undefined : 'Step',
      },
      { gameMultiplier: outcome === 'win' && !partial ? next.multiplier : undefined, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  function handleStart() {
    if (!canStart || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    setSafeAdvancePending(laneProc.rollForBet())
    setRound(startChickenRound(bet))
    setCurrentBet(0)
  }

  function handleAdvance() {
    const useSafe = safeAdvancePending
    if (useSafe) setSafeAdvancePending(false)
    const next = blessed ? winGame(round) : cursed ? loseGame(round) : useSafe ? advanceChickenRoundSafe(round) : advanceChickenRound(round)
    setRound(next)
    if (next.stage === 'settled') settleRound(next)
  }

  function handleCashOut() {
    const next = cashOutChicken(round)
    setRound(next)
    settleRound(next)
  }

  const handleNewRound = useCallback(() => {
    unlock()
    laneProc.resetPerk()
    setSafeAdvancePending(false)
    setRound(initChicken())
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll, laneProc])

  function handleNext() {
    if (pendingResult) setMatchHistory((h) => [pendingResult.entry, ...h].slice(0, 80))
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  const currentStep = round.step
  const stepLabel =
    !isBetting && round.betAmount > 0
      ? `Step ${currentStep} · ${formatMultiplier(round.multiplier)}`
      : undefined

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Chicken Road</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center px-4 py-4 md:px-6"
        entries={matchHistory}
        gameLabel="Chicken"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {safeAdvancePending && isInProgress && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Safe crossing — your next advance cannot fail
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={round.betAmount}
          betType={stepLabel}
          visible={!isBetting && round.betAmount > 0}
        />

        <div className="flex min-h-0 flex-1 w-full max-w-lg flex-col">
          <div className="min-h-0 flex-1 shrink" aria-hidden />
          <div className="flex w-full flex-col items-center gap-3 shrink-0">
          <div className="w-full shrink-0 flex flex-col justify-center min-h-[4.75rem] sm:h-[4.75rem]">
            {(() => {
              const chicken = (
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-lg flex-shrink-0 ${
                    currentStep === 0 && !isSettled
                      ? 'border-yellow-400 bg-yellow-400/20'
                      : 'border-white/20 bg-white/5'
                  }`}
                >
                  🐔
                </div>
              )
              const renderStep = (i: number) => {
                const stepNum = i + 1
                const isPassed = currentStep >= stepNum && !isSettled
                const isCurrent = currentStep === stepNum && isInProgress
                const isKilled = isSettled && round.outcome === 'loss' && currentStep === stepNum
                const isSafe = isSettled && round.outcome === 'win' && currentStep >= stepNum
                return (
                  <div key={i} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <div
                      className={`h-0.5 w-3 sm:w-5 rounded-full transition-colors ${isPassed || isSafe ? 'bg-emerald-400' : 'bg-white/15'}`}
                    />
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                        isKilled
                          ? 'border-red-500 bg-red-600 text-white scale-110'
                          : isCurrent
                            ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300 scale-110'
                            : isSafe
                              ? 'border-emerald-500 bg-emerald-600/40 text-emerald-300'
                              : isPassed
                                ? 'border-emerald-500 bg-emerald-600/40 text-emerald-300'
                                : 'border-white/20 bg-white/5 text-white/30'
                      }`}
                    >
                      {isKilled ? '💥' : stepNum}
                    </div>
                  </div>
                )
              }
              const half = MAX_STEPS / 2
              return (
                <>
                  {/* sm and up: single row */}
                  <div className="hidden sm:flex items-center gap-1 sm:gap-2 justify-center">
                    {chicken}
                    {Array.from({ length: MAX_STEPS }, (_, i) => renderStep(i))}
                  </div>

                  {/* Mobile: split into 2 rows so the road fits the screen width */}
                  <div className="flex sm:hidden flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1 justify-center">
                      {chicken}
                      {Array.from({ length: half }, (_, i) => renderStep(i))}
                    </div>
                    <div className="flex items-center gap-1 justify-center">
                      {Array.from({ length: MAX_STEPS - half }, (_, i) => renderStep(i + half))}
                    </div>
                  </div>
                </>
              )
            })()}
            <div className="flex justify-between text-xs text-white/30 mt-2 px-1 h-4 shrink-0">
              <span>Start</span>
              <span>
                Step {currentStep} / {MAX_STEPS}
              </span>
            </div>
          </div>

          <div
            className={`grid grid-cols-2 gap-2 w-full max-w-sm h-[4.25rem] shrink-0 ${
              isBetting ? 'invisible pointer-events-none' : ''
            }`}
          >
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Step</p>
              <p className="text-white font-semibold tabular-nums">{currentStep}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-white/40 text-xs mb-1">Multiplier</p>
              <p className="text-white font-semibold tabular-nums">{formatMultiplier(round.multiplier)}</p>
            </div>
          </div>

          <div className="min-h-10 flex w-full items-center justify-center px-2 shrink-0">
            <p className="text-center text-xs text-zinc-500 max-w-md">
              {isBetting
                ? 'Advance step by step or cash out anytime. Each step raises the multiplier — and the danger.'
                : isInProgress
                  ? 'Advance for a higher multiplier, or cash out to lock in winnings.'
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
            {isInProgress && potentialWinnings > 0 && (
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
            {!isBetting && !isInProgress && !(isSettled && pendingResult) && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className={`${GAME_DOCK_ACTIONS} min-h-[2.75rem] justify-center gap-2`}>
            {isBetting && (
              showGameOver ? (
                <GameDockGameOverButton onClick={handleGameOver} />
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!canStart}
                  className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
                >
                  Start →
                </button>
              )
            )}
            {isInProgress && (
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleAdvance}
                  className="px-7 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors text-base shadow-lg"
                >
                  Advance →
                </button>
                <button
                  type="button"
                  onClick={handleCashOut}
                  className="px-7 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-base shadow-lg"
                >
                  Cash Out
                </button>
              </div>
            )}
            {isSettled && pendingResult && (
              <GameDockSettledActions
                mode={mode}
                showGameOver={showGameOver}
                onGameOver={handleGameOver}
                onNext={handleNext}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
