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
import { playSiteSound } from '@/components/site-sound'

const DRAW_TICK_MS = 380
import { BoardTile, type BoardTileState } from '@/components/games/board-tile'

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
    playSiteSound('keno-pick')
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
    playSiteSound('keno-ball')
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
        playSiteSound('keno-ball')
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
        {heatNumbers.length > 0 && (
          <PerkHint>Heat: {heatNumbers.join(', ')} in this draw</PerkHint>
        )}
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0"
        entries={matchHistory}
        gameLabel="Keno"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge betAmount={round.betAmount} visible={!isBetting} />

        <div className="grid5-board flex h-full w-full flex-col items-center justify-center gap-[clamp(0.4rem,2.4cqh,1rem)] px-4 py-3">
          {/* One slot: quick pick while betting, the draw's figures after. */}
          <div className="grid5-top flex h-9 shrink-0 items-center justify-center gap-2">
            {isBetting ? (
              <>
                <button
                  type="button"
                  onClick={handleQuickPick}
                  className="m-still h-8 rounded-full border border-gold/60 px-3.5 text-[12px] font-semibold text-gold transition-colors hover:bg-gold-tint"
                >
                  Quick Pick (5)
                </button>
                <button
                  type="button"
                  onClick={handleClearPicks}
                  className="m-still plaque h-8 rounded-full px-3.5 text-[12px] font-semibold text-dim transition-colors hover:text-ink"
                >
                  Clear picks
                </button>
              </>
            ) : (
              <>
                <span className="flex h-8 items-center gap-1.5 plaque rounded-full px-3 text-[12px]">
                  <span className="felt-print">Hits</span>
                  <span key={round.hits} className="num g-pop text-gold">{hasRevealedStats ? round.hits : '—'}</span>
                </span>
                <span className="flex h-8 items-center gap-1.5 plaque rounded-full px-3 text-[12px]">
                  <span className="felt-print">Multiplier</span>
                  <span key={round.multiplier} className="num g-pop text-ink">
                    {hasRevealedStats ? formatMultiplier(round.multiplier) : '—'}
                  </span>
                </span>
              </>
            )}
          </div>

          {/* The board: picks turn white, each drawn ball flips its number up, hits glow gold. */}
          <div className="grid5-grid grid shrink-0 grid-cols-5 gap-[calc(var(--tile)*0.14)] [--stagger:40ms]">
            {Array.from({ length: BOARD_SIZE }, (_, i) => {
              const num = i + 1
              const picked = pickSet.has(num)
              const drawn = revealedSet.has(num)
              const isHit = picked && drawn
              const isMiss = picked && isSettled && !drawn
              const isDrawOnly = drawn && !picked
              const isHeat = heatSet.has(num) && !picked
              const state: BoardTileState = isHit
                ? 'hit'
                : isDrawOnly
                  ? 'dormant'
                  : isMiss
                    ? 'idle'
                    : picked
                      ? 'selected'
                      : isBetting
                        ? 'hidden'
                        : 'idle'

              return (
                <BoardTile
                  key={num}
                  state={state}
                  index={(i % 5) + Math.floor(i / 5)}
                  onClick={() => handleNumberClick(num)}
                  sound="silent"
                  disabled={!isBetting || (!picked && round.picks.length >= MAX_PICKS)}
                  className={[
                    isHit ? 'g-gold' : '',
                    isDrawOnly ? 'btile-drawn' : '',
                    isMiss ? 'btile-miss' : '',
                    isHeat ? 'btile-hint' : '',
                    isDrawing && picked && !drawn ? 'btile-wait' : '',
                  ].join(' ')}
                >
                  {num}
                </BoardTile>
              )
            })}
          </div>

          <p className="grid5-hint flex min-h-9 max-w-sm shrink-0 items-center px-2 text-center text-[13px] text-dim">
            {isBetting
              ? mode === 'ladder'
                ? `Pick ${MIN_PICKS}–${MAX_PICKS} numbers, then play for the whole pot. ${DRAW_COUNT} balls are drawn.`
                : `Pick ${MIN_PICKS}–${MAX_PICKS} numbers, place chips, then play. ${DRAW_COUNT} balls are drawn.`
              : isDrawing
                ? 'Numbers reveal one by one. Use Reveal All to skip the draw.'
                : '\u00A0'}
          </p>
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
              <p className="text-[13px] text-soft">
                {hasRevealedStats ? (
                  <>
                    Potential total winnings:{' '}
                    <span className="num text-felt glow-felt">{formatChips(totalWinnings)}</span>
                  </>
                ) : (
                  <>Drawing ball <span className="num text-ink">{round.revealedDrawn.length}</span> of {DRAW_COUNT}…</>
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
                    data-sound={isDrawing ? 'silent' : undefined}
                    disabled={isBetting && !canStart}
                    className={GAME_DOCK_PRIMARY_BTN}
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
