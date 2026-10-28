'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_BOARD_ARENA,
  GAME_CARD_SHELL,
  GAME_CONTROL_DOCK_M,
  GAME_STATUS_BAR,
} from '@/components/game-layout'
import {
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_SECONDARY_BTN,
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
import { BOARD_CELL, BOARD_HINT, BOARD_PANEL, CELL_GOLD, CELL_LOSS, CELL_MUTED, CELL_OPEN, CELL_PICKED, CELL_WIN } from '@/components/game-board-ui'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { kenoHeatNumbers } from '@/games/keno/engine'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import {
  BOARD_SIZE,
  DRAW_COUNT,
  MAX_PICKS,
  MIN_PICKS,
  clearKenoPicks,
  getKenoPayout,
  initKeno,
  loseGame,
  quickPickKeno,
  revealAllKenoDraws,
  revealNextKenoDraw,
  startKenoRound,
  toggleKenoPick,
  winGame,
} from '@/games/keno/engine'
import type { KenoState } from '@/games/keno/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

const DRAW_TICK_MS = 380

interface KenoResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface KenoGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<KenoResult>
}

type PendingResult = GamePendingResult

export function KenoGame({ mode, bankroll, onBet, onResolve }: KenoGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { kenoHeat, kenoHeatLevel  } = useSurvivalPerks('keno')
  const heatProc = usePerkProc(
    mode === 'survival' && kenoHeat,
    'perk_keno_heat',
    kenoHeatLevel,
  )
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<KenoState>(initKeno())
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [lastPicks, setLastPicks] = useState<number[]>([])
  const [lastUsedQuickPick, setLastUsedQuickPick] = useState(false)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const resolvedRef = useRef(false)

  const isBetting = round.stage === 'betting'
  const isDrawing = round.stage === 'drawing'
  const isSettled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: isBetting || isSettled })
  const canStart = currentBet >= minBet && currentBet <= bankroll && round.picks.length >= MIN_PICKS
  const hasRevealedStats = round.revealedDrawn.length > 0
  const totalWinnings = useMemo(() => getKenoPayout(round), [round])
  const revealedSet = useMemo(() => new Set(round.revealedDrawn), [round.revealedDrawn])
  const pickSet = useMemo(() => new Set(round.picks), [round.picks])
  const heatNumbers =
    heatProc.perkActive && isDrawing && round.drawn.length > 0
      ? kenoHeatNumbers(round.drawn)
      : []
  const heatSet = useMemo(() => new Set(heatNumbers), [heatNumbers])

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function finishRound(next: KenoState) {
    if (!next.outcome || resolvedRef.current) return
    resolvedRef.current = true
    const payoutAmount = getKenoPayout(next)
    const resolved = resolveGame(onResolve, {
      outcome: next.outcome,
      betAmount: next.betAmount,
      payout: payoutAmount,
      multiplier: next.multiplier,
    })
    const built = buildPendingResult(
      { outcome: next.outcome, betAmount: next.betAmount, payout: resolved.payout },
      {
        result: `${next.hits}/${next.picks.length}`,
        resultSpecification: 'hits',
      },
      { gameMultiplier: next.multiplier > 0 ? next.multiplier : undefined, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  function handleStart() {
    if (!canStart || !lock()) return
    resolvedRef.current = false
    setLastBet(currentBet)
    setLastPicks(round.picks)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    onBet?.(currentBet)
    heatProc.rollForBet()
    setRound(blessed ? winGame(currentBet, round.picks) : cursed ? loseGame(currentBet, round.picks) : startKenoRound(currentBet, round.picks))
    setCurrentBet(0)
  }

  function handleNumberClick(num: number) {
    if (!isBetting) return
    setLastUsedQuickPick(false)
    setRound((prev) => toggleKenoPick(prev, num))
  }

  function handleQuickPick() {
    if (!isBetting) return
    setLastUsedQuickPick(true)
    setRound((prev) => quickPickKeno(prev, 5))
  }

  function handleClearPicks() {
    if (!isBetting) return
    setLastUsedQuickPick(false)
    setRound((prev) => clearKenoPicks(prev))
  }

  function handleRevealAll() {
    if (!isDrawing) return
    setRound((prev) => {
      const next = revealAllKenoDraws(prev)
      if (next.stage === 'settled') finishRound(next)
      return next
    })
  }

  useEffect(() => {
    if (!isDrawing) return
    if (round.revealedDrawn.length >= round.drawn.length) return

    const timer = window.setTimeout(() => {
      setRound((prev) => {
        const next = revealNextKenoDraw(prev)
        if (next.stage === 'settled') finishRound(next)
        return next
      })
    }, DRAW_TICK_MS)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawing, round.revealedDrawn.length, round.drawn.length])

  const handleNewRound = useCallback(() => {
    unlock()
    resolvedRef.current = false
    heatProc.resetPerk()
    setPendingResult(null)
    if (autoReBet && lastBet >= minBet && lastBet <= bankroll) {
      setCurrentBet(lastBet)
      if (lastUsedQuickPick) {
        setRound(quickPickKeno(initKeno(), 5))
      } else if (lastPicks.length > 0) {
        setRound({ ...initKeno(), picks: lastPicks })
      } else {
        setRound(initKeno())
      }
    } else {
      setCurrentBet(0)
      setRound(initKeno())
    }
  }, [autoReBet, lastBet, lastPicks, lastUsedQuickPick, bankroll, minBet])

  function handleNext() {
    if (pendingResult) setMatchHistory((h) => [pendingResult.entry, ...h].slice(0, 80))
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Keno</span>
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 flex flex-col items-center justify-start pt-4 pb-4 px-3 md:px-5"
        entries={matchHistory}
        gameLabel="Keno"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {heatNumbers.length > 0 && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Heat: {heatNumbers.join(', ')} in this draw
          </PerkHint>
        )}
        <GameActiveBetBadge betAmount={round.betAmount} visible={!isBetting} />

        <div className="flex flex-col items-center w-full max-w-sm shrink-0 gap-2">
          <div
            className={`flex flex-wrap justify-center gap-2 h-10 items-center w-full shrink-0 ${
              isBetting ? 'invisible pointer-events-none' : ''
            }`}
          >
            <div className={`${BOARD_PANEL} px-3 py-1.5 text-sm`}>
              <span className="text-dim">Hits </span>
              <span className="num text-felt">
                {hasRevealedStats ? round.hits : '—'}
              </span>
            </div>
            <div className={`${BOARD_PANEL} px-3 py-1.5 text-sm`}>
              <span className="text-dim">Multiplier </span>
              <span className="num text-ink">
                {hasRevealedStats ? formatMultiplier(round.multiplier) : '—'}
              </span>
            </div>
          </div>

          <div
            className={`flex justify-center gap-2 h-9 items-center w-full shrink-0 ${
              !isBetting ? 'invisible pointer-events-none' : ''
            }`}
          >
            <button
              type="button"
              onClick={handleQuickPick}
              className="h-8 rounded-full border border-felt bg-felt-tint px-3.5 text-xs font-semibold text-felt transition-shadow hover:shadow-[0_0_16px_-4px_rgba(79,174,132,0.8)]"
            >
              Quick pick (5)
            </button>
            <button
              type="button"
              onClick={handleClearPicks}
              className="h-8 rounded-full border border-control px-3.5 text-xs font-medium text-soft transition-colors hover:border-loss hover:text-loss"
            >
              Clear picks
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5 w-full shrink-0">
            {Array.from({ length: BOARD_SIZE }, (_, i) => {
              const num = i + 1
              const picked = pickSet.has(num)
              const drawn = revealedSet.has(num)
              const isHit = picked && drawn
              const isMiss = picked && isSettled && !drawn
              const isDrawOnly = drawn && !picked
              const isHeat = heatSet.has(num) && !picked

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumberClick(num)}
                  disabled={!isBetting || (!picked && round.picks.length >= MAX_PICKS)}
                  className={[
                    `h-9 sm:h-10 ${BOARD_CELL}`,
                    isHeat
                      ? 'ring-1 ring-[var(--gold)]'
                      : '',
                    isHit
                      ? CELL_WIN
                      : isMiss
                        ? CELL_LOSS
                        : isDrawOnly
                          ? CELL_GOLD
                          : picked
                            ? CELL_PICKED
                            : isBetting
                              ? CELL_OPEN
                              : CELL_MUTED,
                    isDrawing && picked && !drawn ? 'animate-pulse' : '',
                  ].join(' ')}
                >
                  {num}
                </button>
              )
            })}
          </div>

          <div className="min-h-10 flex items-center justify-center w-full shrink-0">
            <p className={BOARD_HINT}>
              {isBetting
                ? `Pick ${MIN_PICKS}–${MAX_PICKS} numbers, place chips, then play. ${DRAW_COUNT} balls are drawn.`
                : isDrawing
                  ? 'Numbers reveal one by one. Use Reveal All to skip the draw.'
                  : '\u00A0'}
            </p>
          </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || isDrawing}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={isDrawing}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isDrawing && (
              <p className="text-sm text-soft">
                {hasRevealedStats ? (
                  <>
                    Potential total winnings:{' '}
                    <span className="num text-felt">{formatChips(totalWinnings)}</span>
                  </>
                ) : (
                  <>Drawing ball {round.revealedDrawn.length} of {DRAW_COUNT}…</>
                )}
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
                    onClick={isSettled ? handleNext : isDrawing ? handleRevealAll : handleStart}
                    disabled={isBetting && !canStart}
                    className={isDrawing ? GAME_DOCK_SECONDARY_BTN : GAME_DOCK_PRIMARY_BTN}
                  >
                    {isSettled ? 'Next →' : isDrawing ? 'Reveal All' : 'Play →'}
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
