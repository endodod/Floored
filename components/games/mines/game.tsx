'use client'

import { useCallback, useMemo, useState } from 'react'
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
  GameDockLeaveButton,
  GameDockSettledRow,
} from '@/components/game-dock-parts'
import { useSurvivalGameOver } from '@/hooks/use-survival-game-over'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { resolveGame } from '@/lib/survival/game-resolve'
import { findFirstSafeMineTile } from '@/games/mines/engine'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { useSurvivalPerks, boostedPotential } from '@/hooks/use-survival-perks'
import { usePerkProc } from '@/hooks/use-perk-proc'
import { PerkHint } from '@/components/survival/perk-hint'
import {
  blessedCashOutMines,
  cashOutMines,
  getMinesPayout,
  initMines,
  loseGame,
  revealMineTile,
  revealSafeMineTile,
  startMinesRound,
  winGame,
} from '@/games/mines/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { MinesState } from '@/games/mines/types'

const DIFFICULTIES: MinesState['difficulty'][] = ['easy', 'medium', 'hard', 'insane']

const DIFFICULTY_LABELS: Record<MinesState['difficulty'], string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  insane: 'Insane',
}

interface MinesResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface MinesGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<MinesResult>
}

type PendingResult = GamePendingResult

export function MinesGame({ mode, bankroll, onBet, onResolve }: MinesGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { minesSafe, minesSafeLevel, payoutBoostMult } = useSurvivalPerks('mines')
  const minesProc = usePerkProc(
    mode === 'survival' && minesSafe,
    'perk_mines_safe',
    minesSafeLevel,
  )
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [difficulty, setDifficulty] = useState<MinesState['difficulty']>('easy')
  const [lastDifficulty, setLastDifficulty] = useState<MinesState['difficulty']>('easy')
  const [round, setRound] = useState<MinesState>(initMines())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const potentialWinnings = useMemo(() => {
    const raw =
      round.stage === 'inProgress'
        ? Math.round(round.betAmount * round.multiplier)
        : getMinesPayout(round)
    return mode === 'survival' ? boostedPotential(raw, payoutBoostMult) : raw
  }, [round, mode, payoutBoostMult])

  const isBetting = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, { idle: isBetting || isSettled })
  const canStart = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function recordOutcome(next: MinesState, outcome: 'win' | 'loss', result: string) {
    const payoutAmount = getMinesPayout(next)
    const resolved = resolveGame(onResolve, {
      outcome,
      betAmount: next.betAmount,
      payout: payoutAmount,
      multiplier: next.multiplier,
    })
    const built = buildPendingResult(
      { outcome, betAmount: next.betAmount, payout: resolved.payout },
      {
        betSpecification: DIFFICULTY_LABELS[next.difficulty],
        result,
      },
      { gameMultiplier: outcome === 'win' ? next.multiplier : undefined, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  function handleStart() {
    if (!canStart || !lock()) return
    setLastBet(currentBet)
    setLastDifficulty(difficulty)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    onBet?.(currentBet)
    let next = startMinesRound(currentBet, difficulty)
    const procActive = minesProc.rollForBet()
    if (procActive) {
      const safeId = findFirstSafeMineTile(next.tiles)
      if (safeId != null) next = revealSafeMineTile(next, safeId)
    }
    setRound(next)
    setCurrentBet(0)
  }

  function handleTileClick(tileId: number) {
    if (round.stage !== 'inProgress') return
    const next = blessed ? winGame(round, tileId) : cursed ? loseGame(round, tileId) : revealMineTile(round, tileId)
    setRound(next)
    if (next.stage === 'settled' && next.outcome) {
      recordOutcome(
        next,
        next.outcome,
        next.outcome === 'win' ? 'Cash out' : 'Mine hit',
      )
    }
  }

  function handleCashOut() {
    const next = blessed ? blessedCashOutMines(round) : cashOutMines(round)
    setRound(next)
    recordOutcome(next, 'win', 'Cash out')
  }

  const handleNewRound = useCallback(() => {
    unlock()
    minesProc.resetPerk()
    setRound(initMines())
    setPendingResult(null)
    if (autoReBet && lastBet >= minBet && lastBet <= bankroll) {
      setCurrentBet(lastBet)
      setDifficulty(lastDifficulty)
    } else {
      setCurrentBet(0)
    }
  }, [autoReBet, lastBet, lastDifficulty, bankroll, minBet, minesProc])

  function handleNext() {
    if (pendingResult) setMatchHistory((h) => [pendingResult.entry, ...h].slice(0, 80))
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Mines</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0 flex flex-col items-center justify-start pt-4 pb-4 px-4 md:px-6"
        entries={matchHistory}
        gameLabel="Mines"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {minesProc.perkActive && isInProgress && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">One safe tile revealed</PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={round.betAmount}
          betType={!isBetting ? DIFFICULTY_LABELS[round.difficulty] : undefined}
          visible={!isBetting}
        />

        <div className="flex flex-col items-center w-full max-w-sm shrink-0 gap-2">
          <div
            className={`flex flex-wrap justify-center gap-3 h-10 items-center w-full shrink-0 ${
              isBetting ? 'invisible pointer-events-none' : ''
            }`}
          >
            <div className="rounded-lg bg-white/5 px-3 py-1.5 text-sm">
              <span className="text-white/40">Safe left </span>
              <span className="font-semibold text-white">{round.remainingSafe}</span>
            </div>
            <div className="rounded-lg bg-white/5 px-3 py-1.5 text-sm">
              <span className="text-white/40">Multiplier </span>
              <span className="font-semibold text-white">{formatMultiplier(round.multiplier)}</span>
            </div>
          </div>

          <div
            className={`flex justify-center gap-2 h-9 items-center w-full shrink-0 ${
              !isBetting ? 'invisible pointer-events-none' : ''
            }`}
          >
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setDifficulty(level)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  difficulty === level ? 'bg-white text-gray-900' : 'bg-white/10 text-white/50 hover:bg-white/15'
                }`}
              >
                {DIFFICULTY_LABELS[level]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full shrink-0">
            {round.tiles.length > 0 ? (
              round.tiles.map((tile) => {
                const showOutcome = tile.revealed || isSettled
                const dormantMine = isSettled && !tile.revealed && tile.hasMine
                const dormantSafe = isSettled && !tile.revealed && !tile.hasMine
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleTileClick(tile.id)}
                    disabled={!isInProgress || tile.revealed}
                    className={`h-12 rounded-lg text-lg font-bold transition-all active:scale-95 sm:h-14 ${
                      tile.revealed && tile.hasMine
                        ? 'border border-red-400 bg-red-600 text-white shadow-lg shadow-red-900/50'
                        : tile.revealed && !tile.hasMine
                          ? 'border border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                          : dormantMine
                            ? 'cursor-default border border-amber-500/70 bg-amber-950/80 text-amber-100 shadow-inner'
                            : dormantSafe
                              ? 'cursor-default border border-zinc-500/60 bg-zinc-800/80 text-zinc-200 shadow-inner'
                              : isInProgress
                                ? 'cursor-pointer border border-white/20 bg-white/10 text-white/0 hover:border-white/40 hover:bg-white/20'
                                : 'cursor-default border border-white/10 bg-white/5 text-white/0'
                    }`}
                  >
                    {showOutcome ? (tile.hasMine ? '💣' : '✓') : ''}
                  </button>
                )
              })
            ) : (
              Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg border border-white/10 bg-white/5 sm:h-14" />
              ))
            )}
          </div>

          <div className="min-h-10 flex items-center justify-center w-full shrink-0">
            <p className="text-xs text-zinc-500 text-center px-2 max-w-md">
              {isBetting
                ? 'Pick a difficulty, place chips, then start. Reveal safe tiles — cash out anytime or hit a mine and lose.'
                : isInProgress
                  ? 'Tap a tile to reveal it. Cash out to lock in your potential total winnings.'
                  : '\u00A0'}
            </p>
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
                    onClick={isSettled ? handleNext : isInProgress ? handleCashOut : handleStart}
                    disabled={isBetting && !canStart}
                    className={[
                      'min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg',
                      isInProgress
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900',
                    ].join(' ')}
                  >
                    {isSettled ? 'Next →' : isInProgress ? 'Cash Out' : 'Start →'}
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
