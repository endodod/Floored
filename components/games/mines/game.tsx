'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useMemo, useState } from 'react'
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
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'
import { BoardTile, TileMark, type BoardTileState } from '@/components/games/board-tile'

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
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<MinesResult>
}

type PendingResult = GamePendingResult

export function MinesGame({ mode, bankroll, onBet, onResolve }: MinesGameProps) {
  const router = useRouter()
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
  const minBet = useGameMinBet(mode)

  const [difficulty, setDifficulty] = useState<MinesState['difficulty']>('easy')
  const [lastDifficulty, setLastDifficulty] = useState<MinesState['difficulty']>('easy')
  const [round, setRound] = useState<MinesState>(initMines())
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
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
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: isBetting || isSettled })
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
        <span className="text-[13px] font-semibold text-ink">Mines</span>
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>
      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative min-h-0"
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

        <div className="grid5-board flex h-full w-full flex-col items-center justify-center gap-[clamp(0.4rem,2.4cqh,1rem)] px-4 py-3">
          {/* One slot: difficulty while betting, the round's figures after. */}
          <div className="grid5-top flex h-9 shrink-0 items-center justify-center gap-2">
            {isBetting ? (
              <div className="flex rounded-full bg-black/25 p-1" role="radiogroup" aria-label="Difficulty">
                {DIFFICULTIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === level}
                    onClick={() => setDifficulty(level)}
                    className={`m-still h-7 rounded-full px-3 text-[12px] font-semibold transition-colors ${
                      difficulty === level ? 'bg-ink text-ground' : 'text-dim hover:text-ink'
                    }`}
                  >
                    {DIFFICULTY_LABELS[level]}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <span className="flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-3 text-[12px]">
                  <span className="text-dim">Safe left</span>
                  <span className="num text-ink">{round.remainingSafe}</span>
                </span>
                <span className="flex h-8 items-center gap-1.5 rounded-full bg-black/25 px-3 text-[12px]">
                  <span className="text-dim">Multiplier</span>
                  <span key={round.multiplier} className={`num g-pop ${isSettled && round.outcome === 'loss' ? 'text-loss' : 'text-gold glow-gold'}`}>
                    {formatMultiplier(round.multiplier)}
                  </span>
                </span>
              </>
            )}
          </div>

          {/* The minefield: tiles cascade in, turn up with a flip, the board shakes on a mine. */}
          <div
            className={`grid5-grid grid shrink-0 grid-cols-5 [--stagger:40ms] gap-[calc(var(--tile)*0.14)] ${
              isSettled && round.outcome === 'loss' ? 'g-shake' : ''
            }`}
          >
            {round.tiles.length > 0
              ? round.tiles.map((tile) => {
                  const state: BoardTileState = tile.revealed
                    ? tile.hasMine
                      ? 'bad'
                      : 'safe'
                    : isSettled
                      ? 'dormant'
                      : isInProgress
                        ? 'hidden'
                        : 'idle'
                  const mark = tile.revealed || isSettled ? (tile.hasMine ? 'mine' : 'gem') : null
                  return (
                    <BoardTile
                      key={tile.id}
                      state={state}
                      index={(tile.id % 5) + Math.floor(tile.id / 5)}
                      onClick={() => handleTileClick(tile.id)}
                      disabled={!isInProgress || tile.revealed}
                      label={mark ? (mark === 'mine' ? 'Mine' : 'Safe') : `Tile ${tile.id + 1}`}
                      className={state === 'dormant' && tile.hasMine ? 'btile-bad' : ''}
                    >
                      {mark && <TileMark kind={mark} />}
                    </BoardTile>
                  )
                })
              : Array.from({ length: 25 }).map((_, i) => (
                  <BoardTile key={`p${i}`} state="idle" index={(i % 5) + Math.floor(i / 5)} disabled label={`Tile ${i + 1}`} />
                ))}
          </div>

          <p className="grid5-hint flex min-h-9 max-w-sm shrink-0 items-center px-2 text-center text-[13px] text-dim">
            {isBetting
              ? 'Pick a difficulty, place chips, then start. Reveal safe tiles — cash out anytime or hit a mine and lose.'
              : isInProgress
                ? 'Tap a tile to reveal it. Cash out to lock in your potential total winnings.'
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
            {isInProgress && (
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
                    className={GAME_DOCK_PRIMARY_BTN}
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
