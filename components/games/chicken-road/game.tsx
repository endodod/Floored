'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_SECONDARY_BTN,
  GameActiveBetBadge,
  GameDockBackButton,
  GameDockBetRow,
  GameDockChipRow,
  GameDockGameOverButton,
  GameDockSettledActions,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useRunEnd } from '@/hooks/use-run-end'
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
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'
import { BoardTile, TileMark, type BoardTileState } from '@/components/games/board-tile'

const MAX_STEPS = 10

/** The chicken, drawn (no emoji): it hops in each time it lands on a lane. */
function ChickenToken() {
  return (
    <svg viewBox="0 0 24 24" className="cr-hop h-[62%] w-[62%]" aria-hidden>
      <path d="M10.2 4.6c.4-1.5 2-1.9 2.6-.8.7-1.1 2.4-.6 2.2.9" fill="var(--loss)" />
      <circle cx="12" cy="13" r="7.2" fill="var(--ink)" />
      <path d="M18.7 12.2 22 13.4l-3.3 1.2z" fill="var(--gold)" />
      <circle cx="14.6" cy="11.2" r="1.15" fill="var(--ground)" />
      <path d="M6.4 13.6c1.6 2.4 4.4 2.6 6 1" stroke="var(--dim)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

interface ChickenResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface ChickenGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<ChickenResult>
}

type PendingResult = GamePendingResult

export function ChickenGame({ mode, bankroll, onBet, onResolve }: ChickenGameProps) {
  const router = useRouter()
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
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<ChickenState>(initChicken())
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [safeAdvancePending, setSafeAdvancePending] = useState(false)

  const isBetting = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, {
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
        <span className="text-[13px] font-semibold text-ink">Chicken Road</span>
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0"
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

        <div className="cr-board flex h-full w-full flex-col items-center justify-center gap-[clamp(0.4rem,2.4cqh,1rem)] px-4 py-3">
          <div className={`cr-stats flex h-9 shrink-0 items-center justify-center gap-2 ${isBetting ? 'invisible' : ''}`}>
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-3 text-[12px]">
              <span className="text-dim">Step</span>
              <span className="num text-ink">{currentStep}</span>
            </span>
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-3 text-[12px]">
              <span className="text-dim">Multiplier</span>
              <span
                key={round.multiplier}
                className={`num g-pop ${isSettled && round.outcome === 'loss' ? 'text-loss' : 'text-gold glow-gold'}`}
              >
                {formatMultiplier(round.multiplier)}
              </span>
            </span>
          </div>

          {/* The road: the chicken hops lane to lane; a crash shakes the road. */}
          <div
            className={`cr-road flex shrink-0 flex-wrap items-center justify-center gap-[calc(var(--tile)*0.14)] ${
              isSettled && round.outcome === 'loss' ? 'g-shake' : ''
            }`}
          >
            <BoardTile
              state={currentStep === 0 && !isSettled ? 'safe' : 'idle'}
              disabled
              label="Start"
              className="cr-curb"
            >
              {currentStep === 0 && !isSettled && <ChickenToken key="start" />}
            </BoardTile>
            {Array.from({ length: MAX_STEPS }, (_, i) => {
              const stepNum = i + 1
              const isPassed = currentStep >= stepNum && !isSettled
              const isCurrent = currentStep === stepNum && !isSettled
              const isKilled = isSettled && round.outcome === 'loss' && currentStep === stepNum
              const isSafe = isSettled && round.outcome === 'win' && currentStep >= stepNum
              const isLanded = isSettled && round.outcome === 'win' && currentStep === stepNum
              const state: BoardTileState = isKilled ? 'bad' : isPassed || isSafe ? 'safe' : 'idle'
              return (
                <BoardTile
                  key={stepNum}
                  state={state}
                  index={stepNum}
                  disabled
                  label={isKilled ? `Lane ${stepNum}: hit` : `Lane ${stepNum}`}
                  className={isLanded ? 'g-win' : ''}
                >
                  {isKilled ? (
                    <TileMark kind="mine" />
                  ) : isCurrent || isLanded ? (
                    <ChickenToken key={stepNum} />
                  ) : (
                    stepNum
                  )}
                </BoardTile>
              )
            })}
          </div>

          <div className="cr-labels flex h-4 w-[var(--road-w)] max-w-full shrink-0 justify-between px-1 text-[12px] text-dim">
            <span>Start</span>
            <span>
              Step <span className="num text-soft">{currentStep}</span> / {MAX_STEPS}
            </span>
          </div>

          <p className="cr-hint flex min-h-9 max-w-md shrink-0 items-center px-2 text-center text-[13px] text-dim">
            {isBetting
              ? 'Advance step by step or cash out anytime. Each step raises the multiplier — and the danger.'
              : isInProgress
                ? 'Advance for a higher multiplier, or cash out to lock in winnings.'
                : '\u00A0'}
          </p>
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
              <p className="text-[13px] text-soft">
                Potential total winnings:{' '}
                <span className="num text-felt glow-felt">{formatChips(potentialWinnings)}</span>
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
                  className={GAME_DOCK_PRIMARY_BTN}
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
                  className={GAME_DOCK_PRIMARY_BTN}
                >
                  Advance →
                </button>
                <button
                  type="button"
                  onClick={handleCashOut}
                  className={GAME_DOCK_SECONDARY_BTN}
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
