'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '@/store/settings-store'
import {
  GAME_CARD_SHELL,
  GAME_BOARD_ARENA,
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
  getOverUnderPayout,
  getOverUnderPayoutMultiplier,
  initOverUnder,
  loseGameResolve,
  resolveOverUnderRound,
  startOverUnderRound,
  winGameResolve,
} from '@/games/over-under/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { OverUnderState } from '@/games/over-under/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

const ROLL_ANIM_MS = 620

interface OverUnderResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

interface OverUnderGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<OverUnderResult>
}

type PendingResult = GamePendingResult

export function OverUnderGame({ mode, bankroll, onBet, onResolve }: OverUnderGameProps) {
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { overUnderShield, overUnderShieldLevel } = useSurvivalPerks('over-under')
  const shieldProc = usePerkProc(
    mode === 'survival' && overUnderShield,
    'perk_over_under_shield',
    overUnderShieldLevel,
  )
  const minBet = useGameMinBet(mode)

  const [safeZone, setSafeZone] = useState(40)
  const [round, setRound] = useState<OverUnderState>(initOverUnder())
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const [markerAt, setMarkerAt] = useState<number | null>(null)
  const [markerOutcome, setMarkerOutcome] = useState<'win' | 'loss' | null>(null)
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: !isInProgress })

  const displaySafeZone = isBetting ? safeZone : round.safeZone
  const payoutMult = isBetting ? getOverUnderPayoutMultiplier(safeZone) : round.payoutMultiplier
  const canRoll = currentBet >= minBet && currentBet <= bankroll
  const potentialWinnings =
    isInProgress && round.betAmount > 0
      ? Math.round(round.betAmount * round.payoutMultiplier)
      : isBetting && currentBet > 0
        ? Math.round(currentBet * payoutMult)
        : 0

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleRoll() {
    if (!canRoll || !lock()) return

    animTimers.current.forEach(clearTimeout)
    animTimers.current = []

    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))

    const started = startOverUnderRound(bet, safeZone)
    const settled = blessed ? winGameResolve(started) : cursed ? loseGameResolve(started) : resolveOverUnderRound(started)
    const rollPos  = settled.rollResult!
    const outcome  = settled.outcome!

    setRound(started)
    setMarkerAt(100)
    setMarkerOutcome(null)

    const t1 = setTimeout(() => setMarkerAt(rollPos), 50)

    const shieldActive = shieldProc.rollForBet()

    const t2 = setTimeout(() => {
      setMarkerOutcome(outcome)
      setRound(settled)

      let finalOutcome: 'win' | 'loss' | 'push' = outcome
      let po = getOverUnderPayout(settled)
      if (shieldActive && outcome === 'loss') {
        po = bet
        finalOutcome = 'push'
      }

      const resolved = resolveGame(onResolve, {
        outcome: finalOutcome,
        betAmount: bet,
        payout: po,
        multiplier: settled.payoutMultiplier,
      })

      const built = buildPendingResult(
        { outcome: finalOutcome, betAmount: bet, payout: resolved.payout },
        {
          betSpecification: `${settled.safeZone}% safe zone`,
          result: String(rollPos),
          resultSpecification: 'Roll',
        },
        {
          gameMultiplier: finalOutcome === 'win' ? settled.payoutMultiplier : undefined,
          payoutBoostMult: resolved.payoutBoostMult,
          freeBet: resolved.firstBetWasFree,
        },
      )
      setPendingResult(built)
      shieldProc.resetPerk()
    }, ROLL_ANIM_MS + 80)

    animTimers.current = [t1, t2]
  }

  const handleNewRound = useCallback(() => {
    unlock()
    animTimers.current.forEach(clearTimeout)
    animTimers.current = []
    setMarkerAt(null)
    setMarkerOutcome(null)
    setRound(initOverUnder())
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
  }, [autoReBet, lastBet, bankroll])

  function handleNextRound() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    }
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  useEffect(() => () => { animTimers.current.forEach(clearTimeout) }, [])

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Over-Under</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4"
        entries={matchHistory}
        gameLabel="Over-Under"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {mode === 'survival' && shieldProc.perkActive && (isBetting || isInProgress) && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Safe Opening Roll — loss refunded to a push
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={round.betAmount}
          betType={!isBetting ? `${displaySafeZone}% safe zone` : undefined}
          visible={!isBetting && round.betAmount > 0}
        />

        <div className="flex w-full max-w-md flex-col items-center gap-4 shrink-0">
          <div className="flex h-14 shrink-0 items-center gap-8 sm:gap-14">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-teal-600 mb-0.5">Safe</p>
              <p className="text-2xl font-black text-teal-300 tabular-nums">{displaySafeZone}%</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">Payout</p>
              <p className="text-2xl font-black text-white tabular-nums">{formatMultiplier(payoutMult)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-red-600 mb-0.5">Danger</p>
              <p className="text-2xl font-black text-red-300 tabular-nums">{100 - displaySafeZone}%</p>
            </div>
          </div>

          <div className="w-full shrink-0">
            <div className="relative h-14 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-red-900/50" />
              <div
                className="absolute inset-y-0 left-0 bg-teal-700/80 transition-all duration-100"
                style={{ width: `${displaySafeZone}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none select-none">
                <span className="text-teal-100/50 text-sm font-bold">Safe</span>
                <span className="text-red-200/50 text-sm font-bold">Danger</span>
              </div>
              <div
                className="absolute inset-y-0 w-[3px] bg-white/40 overflow-visible"
                style={{ left: `calc(${displaySafeZone}% - 1.5px)` }}
              >
                <span className="absolute top-1/2 -translate-y-1/2 right-full pr-1.5 text-white/60 text-xs font-bold pointer-events-none select-none">←</span>
                <span className="absolute top-1/2 -translate-y-1/2 left-full pl-1.5 text-white/60 text-xs font-bold pointer-events-none select-none">→</span>
              </div>
              {markerAt !== null && (
                <div
                  className={`absolute top-[12%] bottom-[12%] w-[5px] rounded-full ${
                    markerOutcome === 'win'
                      ? 'bg-emerald-400 shadow-lg shadow-emerald-400/60'
                      : markerOutcome === 'loss'
                        ? 'bg-red-400 shadow-lg shadow-red-400/60'
                        : 'bg-white shadow-lg shadow-white/40'
                  }`}
                  style={{
                    left: `${markerAt}%`,
                    transform: 'translateX(-50%)',
                    transition:
                      markerAt === 100 || markerOutcome !== null
                        ? 'none'
                        : `left ${ROLL_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                  }}
                />
              )}
              <input
                type="range"
                min={10}
                max={90}
                step={1}
                value={safeZone}
                onChange={(e) => { if (isBetting) setSafeZone(Number(e.currentTarget.value)) }}
                disabled={!isBetting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default appearance-none"
              />
            </div>
            <div className="flex justify-center mt-2 px-1 text-xs text-zinc-600">
              <span>{isBetting ? 'Drag to adjust' : `Rolled ${round.rollResult ?? '—'}`}</span>
            </div>
          </div>

          <div className="min-h-10 flex w-full shrink-0 items-center justify-center px-2">
            <p className="text-center text-xs text-zinc-500">
              {isBetting
                ? `Roll 1–${displaySafeZone} wins · ${displaySafeZone + 1}–100 loses. Drag the bar to set risk.`
                : isInProgress
                  ? 'Marker rolling…'
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

          <div className={GAME_DOCK_ACTIONS}>
            <div className="flex justify-center gap-2">
              {showGameOver ? (
                <GameDockGameOverButton onClick={handleGameOver} />
              ) : (
                <>
                  {isSettled && <GameDockLeaveButton mode={mode} />}
                  <button
                    type="button"
                    onClick={isSettled ? handleNextRound : handleRoll}
                    disabled={isBetting && !canRoll}
                    className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
                  >
                    {isSettled ? 'Next →' : 'Roll →'}
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
