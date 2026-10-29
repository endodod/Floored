'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
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

/** A racing chicken, drawn (no emoji), wearing its lane colour as a bib. */
function ChickenRunner({ color, running }: { color: string; running: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`crc-chicken h-full w-full ${running ? 'crc-run' : ''}`} aria-hidden>
      <path d="M10.2 4.6c.4-1.5 2-1.9 2.6-.8.7-1.1 2.4-.6 2.2.9" fill="var(--loss)" />
      <circle cx="12" cy="13" r="7.2" fill="var(--ink)" />
      <path d="M5.4 15.6a7.2 7.2 0 0 0 13.2 0z" fill={color} />
      <path d="M18.7 12.2 22 13.4l-3.3 1.2z" fill="var(--gold)" />
      <circle cx="14.6" cy="11.2" r="1.15" fill="var(--ground)" />
    </svg>
  )
}

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
        <span className="text-[13px] font-semibold text-ink">Chicken Race</span>
        {scoutProc.perkActive && isBetting && scoutEliminate !== null && (
          <PerkHint>Scout: {CHICKENS[scoutEliminate]!.name} won&apos;t win</PerkHint>
        )}
        <span className="text-[13px] text-dim">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center px-3 pt-14 pb-2"
        entries={matchHistory}
        gameLabel="Chicken Race"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
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

        <div className="crc-board flex w-full max-w-2xl min-h-0 flex-1 flex-col justify-center gap-[clamp(0.3rem,2cqh,0.75rem)]">
          <p className="crc-label felt-print px-1">{isBetting ? 'Pick your chicken' : 'Race'}</p>

          <div className="flex flex-col gap-[clamp(0.25rem,1.6cqh,0.6rem)]">
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
                  aria-pressed={isSelected}
                  style={{ '--i': chicken.id } as React.CSSProperties}
                  className={[
                    'crc-lane g-fade m-still relative flex w-full items-stretch rounded-[10px] border text-left transition-[border-color,background-color,opacity] duration-150',
                    isScoutCrossed
                      ? 'border-dashed border-loss/50 bg-ground/30 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'border-felt bg-felt-tint/80'
                        : 'border-line bg-ground/40',
                    isBetting && !isScoutCrossed ? 'cursor-pointer hover:border-dim' : '',
                    isWinner ? (isSelected ? 'g-gold' : 'g-win') : '',
                    isLoser ? 'g-dim' : '',
                  ].join(' ')}
                >
                  <span className="crc-gate flex shrink-0 items-center gap-2 border-r border-black/40 px-2">
                    <span
                      className="crc-bib num grid shrink-0 place-items-center rounded-full font-semibold text-ground"
                      style={{ backgroundColor: chicken.color }}
                    >
                      {chicken.id + 1}
                    </span>
                    <span className={`min-w-0 truncate text-[13px] font-semibold ${isSelected ? 'text-felt' : 'text-ink'}`}>
                      {chicken.name}
                    </span>
                    {isScoutCrossed && <span className="ml-auto text-[12px] font-semibold text-loss">Out</span>}
                  </span>

                  <span className="crc-track relative min-w-0 flex-1 overflow-hidden rounded-r-[9px]">
                    <span className="crc-lanemark absolute inset-x-0 top-1/2" aria-hidden />
                    <span className="crc-finish absolute inset-y-0 right-0" aria-hidden />
                    {isWinner && (
                      <span className="num g-pop absolute left-2 top-1/2 -mt-[0.6em] text-[12px] font-semibold leading-[1.2] text-gold">1st</span>
                    )}
                    <span
                      className="crc-runner absolute inset-y-0 left-1"
                      style={{ transform: `translateX(${prog}%)` }}
                    >
                      <span className="crc-token block">
                        <ChickenRunner color={chicken.color} running={isRacing} />
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <p className="crc-hint px-2 text-center text-[13px] text-dim">
            {isBetting
              ? mode === 'ladder'
                ? 'Pick a chicken, then race for the whole pot.'
                : 'Pick a chicken, place chips, then race.'
              : isRacing
                ? 'Race in progress…'
                : '\u00A0'}
          </p>
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
                    className={GAME_DOCK_PRIMARY_BTN}
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
