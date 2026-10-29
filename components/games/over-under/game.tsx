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
        <span className="text-[13px] font-semibold text-ink">Over-Under</span>
        {mode === 'survival' && shieldProc.perkActive && (isBetting || isInProgress) && (
          <PerkHint>Safe Opening Roll — loss refunded to a push</PerkHint>
        )}
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 md:px-8 py-4"
        entries={matchHistory}
        gameLabel="Over-Under"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge
          betAmount={round.betAmount}
          betType={!isBetting ? `${displaySafeZone}% safe zone` : undefined}
          visible={!isBetting && round.betAmount > 0}
        />

        <div className="ou-board flex w-full max-w-md flex-col items-center gap-[clamp(0.5rem,3cqh,1rem)] shrink-0">
          <div className="ou-stats flex shrink-0 items-center gap-8 sm:gap-14">
            <div className="text-center">
              <p className="text-[11px] text-dim mb-0.5">Safe</p>
              <p className="num text-2xl font-semibold text-felt">{displaySafeZone}%</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-dim mb-0.5">Payout</p>
              <p key={payoutMult} className={`num text-2xl font-semibold text-gold glow-gold ${isBetting ? '' : 'g-pop'}`}>{formatMultiplier(payoutMult)}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-dim mb-0.5">Danger</p>
              <p className="num text-2xl font-semibold text-loss">{100 - displaySafeZone}%</p>
            </div>
          </div>

          <div className="w-full shrink-0">
            <div
              key={markerOutcome === 'loss' ? 'bust' : 'bar'}
              className={`ou-bar relative rounded-full ${markerOutcome === 'loss' ? 'g-shake' : ''} ${markerOutcome === 'win' ? 'g-win' : ''}`}
            >
              <div className="absolute inset-0 overflow-hidden rounded-full bg-loss-tint">
                <div
                  className="absolute inset-0 origin-left bg-[rgba(79,174,132,0.3)]"
                  style={{ transform: `scaleX(${displaySafeZone / 100})` }}
                />
                {/* Thick outline drawn over both zones so the fill never covers it. */}
                <div className="absolute inset-0 rounded-full border-4 border-black" />
                <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none select-none text-[12px] font-semibold">
                  <span className="text-felt opacity-70">Safe</span>
                  <span className="text-loss opacity-70">Danger</span>
                </div>
              </div>
              <div
                className="absolute inset-y-0 left-0 w-full pointer-events-none"
                style={{ transform: `translateX(${displaySafeZone}%)` }}
                aria-hidden
              >
                <span className={`absolute top-1/2 left-0 flex h-[115%] w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-px rounded-full border border-control bg-raised transition-opacity ${isBetting ? '' : 'opacity-40'}`}>
                  <span className="h-1/3 w-px bg-dim" />
                  <span className="h-1/3 w-px bg-dim" />
                </span>
              </div>
              {markerAt !== null && (
                <div
                  className="ou-marker absolute inset-y-0 left-0 w-full pointer-events-none"
                  style={{
                    transform: `translateX(${markerAt}%)`,
                    transition:
                      markerAt === 100 || markerOutcome !== null
                        ? 'none'
                        : `transform ${ROLL_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
                  }}
                >
                  <span
                    className={`absolute top-[12%] bottom-[12%] left-0 w-[5px] -translate-x-1/2 rounded-full ${
                      markerOutcome === 'win'
                        ? 'bg-felt shadow-[0_0_14px_2px_rgba(79,174,132,0.7)]'
                        : markerOutcome === 'loss'
                          ? 'bg-loss shadow-[0_0_14px_2px_rgba(229,86,111,0.7)]'
                          : 'bg-ink shadow-[0_0_12px_rgba(255,255,255,0.45)]'
                    }`}
                  />
                </div>
              )}
              <input
                type="range"
                min={10}
                max={90}
                step={1}
                value={safeZone}
                onChange={(e) => { if (isBetting) setSafeZone(Number(e.currentTarget.value)) }}
                disabled={!isBetting}
                aria-label="Safe zone"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default appearance-none"
              />
            </div>
            <div className="flex h-6 items-center justify-center mt-1.5 px-1 text-[12px] text-dim">
              {isBetting || round.rollResult == null ? (
                <span>{isBetting ? 'Drag to adjust' : 'Rolling…'}</span>
              ) : (
                <span>
                  Rolled{' '}
                  <span
                    key={round.rollResult}
                    className={`num g-pop inline-block text-[15px] font-semibold ${
                      markerOutcome === 'win' ? 'text-felt glow-felt' : markerOutcome === 'loss' ? 'text-loss' : 'text-ink'
                    }`}
                  >
                    {round.rollResult}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="ou-hint min-h-9 flex w-full shrink-0 items-center justify-center px-2">
            <p className="text-center text-[13px] text-dim">
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
                    className={GAME_DOCK_PRIMARY_BTN}
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
