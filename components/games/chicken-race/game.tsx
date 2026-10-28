'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
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
import { useRunEnd } from '@/hooks/use-run-end'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { formatChips } from '@/utils/format'
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
  CHICKENS,
  PAYOUT_MULTIPLIER,
  RACE_TICKS,
  TICK_MS,
  generateRaceFrames,
  initChickenRace,
  loseGame,
  previewRaceOutcome,
  settleRace,
  startRace,
  startRaceWithWinner,
  winGame,
} from '@/games/chicken-race/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { ChickenRaceState } from '@/games/chicken-race/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

interface ChickenRaceResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface ChickenRaceGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<ChickenRaceResult>
}

type PendingResult = GamePendingResult

export function ChickenRaceGame({ mode, bankroll, onBet, onResolve }: ChickenRaceGameProps) {
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { chickenScout, chickenScoutLevel  } = useSurvivalPerks('chicken-race')
  const scoutProc = usePerkProc(
    mode === 'survival' && chickenScout,
    'perk_chicken_scout',
    chickenScoutLevel,
  )
  const minBet = useGameMinBet(mode)

  const [state, setState] = useState<ChickenRaceState>(initChickenRace)
  const [scoutEliminate, setScoutEliminate] = useState<number | null>(null)
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [lastPicked, setLastPicked] = useState<number | null>(null)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [progress, setProgress] = useState<number[]>(CHICKENS.map(() => 0))
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const raceFramesRef = useRef<number[][]>([])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoutPreviewRef = useRef<{ winner: number; scoutEliminate: number } | null>(null)

  const isBetting = state.stage === 'betting'
  const isRacing = state.stage === 'racing'
  const isSettled = state.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: !isRacing })
  const canRace = state.pickedChicken !== null && currentBet >= minBet && currentBet <= bankroll
  const activeBet = isRacing || isSettled ? state.betAmount : 0
  const potentialWinnings =
    (isRacing || isBetting) && (isRacing ? state.betAmount : currentBet) > 0
      ? Math.round((isRacing ? state.betAmount : currentBet) * PAYOUT_MULTIPLIER)
      : 0

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function selectChicken(id: number) {
    if (!isBetting) return
    setState((prev) => ({ ...prev, pickedChicken: prev.pickedChicken === id ? null : id }))
  }

  function handleRace() {
    if (!canRace || state.pickedChicken === null || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    let next: ChickenRaceState
    if (blessed) {
      next = winGame(bet, state.pickedChicken)
    } else if (cursed) {
      next = loseGame(bet, state.pickedChicken)
    } else if (scoutProc.perkActive && scoutPreviewRef.current) {
      next = startRaceWithWinner(bet, state.pickedChicken, scoutPreviewRef.current.winner)
    } else {
      next = startRace(bet, state.pickedChicken)
    }
    setLastBet(bet)
    setLastPicked(state.pickedChicken)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    setProgress(CHICKENS.map(() => 0))
    raceFramesRef.current = generateRaceFrames(next.winner!)
    setState(next)

    let tick = 0
    tickRef.current = setInterval(() => {
      const frame = raceFramesRef.current[tick]
      if (frame) setProgress([...frame])
      tick++
      if (tick >= RACE_TICKS) {
        clearInterval(tickRef.current!)
        tickRef.current = null
        setProgress([...raceFramesRef.current[RACE_TICKS - 1]!])
        const settled = settleRace(next)
        setState(settled)
        recordOutcome(settled)
      }
    }, TICK_MS)
  }

  function recordOutcome(settled: ChickenRaceState) {
    const won = settled.pickedChicken === settled.winner
    const payout = won ? Math.round(settled.betAmount * PAYOUT_MULTIPLIER) : 0
    const outcome = settled.outcome ?? (won ? 'win' : 'loss')
    const resolved = resolveGame(onResolve, {
      outcome,
      betAmount: settled.betAmount,
      payout,
      multiplier: won ? PAYOUT_MULTIPLIER : 0,
    })
    const built = buildPendingResult(
      { outcome, betAmount: settled.betAmount, payout: resolved.payout },
      {
        betSpecification: CHICKENS[settled.pickedChicken!]!.name,
        result: won ? `${PAYOUT_MULTIPLIER}×` : CHICKENS[settled.winner!]!.name,
        resultSpecification: won ? 'Win' : undefined,
      },
      { gameMultiplier: won ? PAYOUT_MULTIPLIER : undefined, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  const handleNext = useCallback(() => {
    unlock()
    if (pendingResult) setMatchHistory((h) => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    if (!survivalAfterNext(mode)) return
    const next = initChickenRace()
    if (autoReBet && lastBet <= bankroll && lastPicked !== null) {
      setState({ ...next, pickedChicken: lastPicked })
      setCurrentBet(lastBet)
    } else {
      setState(next)
    }
    setProgress(CHICKENS.map(() => 0))
    scoutProc.resetPerk()
    scoutPreviewRef.current = null
    setScoutEliminate(null)
  }, [pendingResult, autoReBet, lastBet, lastPicked, bankroll, mode, scoutProc])

  useEffect(() => {
    if (!isBetting || !chickenScout || mode !== 'survival') {
      scoutPreviewRef.current = null
      setScoutEliminate(null)
      return
    }
    if (scoutProc.rollForBet()) {
      const preview = previewRaceOutcome()
      scoutPreviewRef.current = preview
      setScoutEliminate(preview.scoutEliminate)
    } else {
      scoutPreviewRef.current = null
      setScoutEliminate(null)
    }
    // Roll once each time the betting phase opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBetting, chickenScout, mode])

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current)
  }, [])

  const actionDisabled = isRacing || (isBetting && !canRace)

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Chicken Race</span>
        <span className="text-sm text-zinc-600">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center px-4 py-4"
        entries={matchHistory}
        gameLabel="Chicken Race"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {scoutProc.perkActive && isBetting && scoutEliminate !== null && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Scout: {CHICKENS[scoutEliminate]!.name} won&apos;t win
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={activeBet}
          betType={
            activeBet > 0 && state.pickedChicken !== null
              ? CHICKENS[state.pickedChicken]!.name
              : undefined
          }
          extra={activeBet > 0 ? `${PAYOUT_MULTIPLIER}×` : undefined}
          visible={activeBet > 0 && !isBetting}
        />

        <div className="flex min-h-0 flex-1 w-full flex-col items-center">
          <div className="min-h-0 flex-1 shrink" aria-hidden />
          <div className="flex w-full max-w-sm flex-col gap-2.5 shrink-0">
            <p className="text-xs text-zinc-600 uppercase tracking-wider px-1">Pick your chicken</p>

            {CHICKENS.map((chicken) => {
              const isSelected = state.pickedChicken === chicken.id
              const isWinner = isSettled && state.winner === chicken.id
              const isLoser = isSettled && state.winner !== chicken.id
              const isScoutCrossed =
                scoutProc.perkActive && isBetting && scoutEliminate === chicken.id
              const prog = progress[chicken.id] ?? 0

              return (
                <button
                  key={chicken.id}
                  type="button"
                  disabled={!isBetting || isScoutCrossed}
                  onClick={() => selectChicken(chicken.id)}
                  className={[
                    'w-full rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-150 relative',
                    isScoutCrossed
                      ? 'bg-zinc-900/60 border-zinc-800 opacity-50 cursor-not-allowed'
                      : isBetting
                        ? isSelected
                          ? 'bg-yellow-400/10 border-yellow-400 cursor-pointer'
                          : 'bg-zinc-800/60 border-zinc-700 hover:border-zinc-500 cursor-pointer'
                        : isWinner
                          ? 'border-2'
                          : isLoser
                            ? 'bg-zinc-900/40 border-zinc-800 opacity-40'
                            : 'bg-zinc-800/60 border-zinc-700',
                  ].join(' ')}
                  style={isWinner ? { borderColor: chicken.color, backgroundColor: `${chicken.color}18` } : undefined}
                >
                  {isScoutCrossed && (
                    <span className="absolute right-2 top-2 text-xs font-bold text-red-400/90">✕ Out</span>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">🐔</span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: isSelected ? '#facc15' : isWinner ? chicken.color : undefined }}
                      >
                        {chicken.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold ${isWinner ? '' : 'invisible'}`}
                      style={{ color: chicken.color }}
                    >
                      Winner!
                    </span>
                  </div>

                  <div className="relative">
                    <div className="h-2.5 rounded-full bg-zinc-700/60 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${prog}%`, backgroundColor: chicken.color, transition: 'none' }}
                      />
                    </div>
                    <div
                      className={`absolute -top-1 text-base leading-none pointer-events-none ${isBetting ? 'invisible' : ''}`}
                      style={{ left: `calc(${prog}% - 10px)`, transition: 'none' }}
                    >
                      🐔
                    </div>
                  </div>
                  <div className="h-4" />
                </button>
              )
            })}

            <div className="min-h-10 flex w-full items-center justify-center px-2">
              <p className="text-center text-xs text-zinc-500 max-w-md">
                {isBetting
                  ? 'Pick a chicken, place chips, then race.'
                  : isRacing
                    ? 'Race in progress…'
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
            visible={isBetting || isRacing}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={isRacing}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isRacing && potentialWinnings > 0 && (
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
            {!isBetting && !isRacing && !(isSettled && pendingResult) && (
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
                    onClick={isSettled ? handleNext : handleRace}
                    disabled={actionDisabled}
                    className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
                  >
                    {isSettled ? 'Next →' : 'Race →'}
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
