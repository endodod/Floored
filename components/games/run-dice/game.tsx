'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'
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
  classifyRunDiceTotal,
  getRunDicePayout,
  initRunDice,
  loseGame,
  rollRunDice,
  startRunDiceRound,
  winGame,
} from '@/games/run-dice/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { RunDiceConfig, RunDiceState } from '@/games/run-dice/types'

const DICE_WEIGHT: Record<number, number> = {2:1,3:2,4:3,5:4,6:5,7:6,8:5,9:4,10:3,11:2,12:1}

// Reveal steps during animation: 0=both spinning, 1=d1 landed, 2=d2 landed, 3=total shown
type RevealStep = 0 | 1 | 2 | 3

interface RunDiceResult {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier: number
}

type PendingResult = GamePendingResult

interface RunDiceGameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number
  config?: RunDiceConfig
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<RunDiceResult>
}

export function RunDiceGame({ mode, bankroll, config, onBet, onResolve }: RunDiceGameProps) {
  const router = useRouter()
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { runDiceInsight, runDiceInsightLevel } = useSurvivalPerks('run-dice')
  const insightProc = usePerkProc(
    mode === 'survival' && runDiceInsight,
    'perk_run_dice_insight',
    runDiceInsightLevel,
  )
  const minBet = mode === 'survival' ? floorMinBet : 1

  const [round, setRound] = useState<RunDiceState>(initRunDice(config))
  const protectionActiveRef = useRef(false)

  const gameConfig = useMemo((): RunDiceConfig => {
    if (config && config.win.length > 0) return config
    return round.config
  }, [config, round.config])
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  // Animation state
  const [isRolling, setIsRolling] = useState(false)
  const [spinDice, setSpinDice] = useState<[number, number]>([1, 1])
  const [revealStep, setRevealStep] = useState<RevealStep>(0)
  const [targetDice, setTargetDice] = useState<[number, number] | null>(null)
  const [targetTotal, setTargetTotal] = useState<number | null>(null)
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearAnimTimers() {
    if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null }
    animTimeoutsRef.current.forEach(clearTimeout)
    animTimeoutsRef.current = []
  }

  useEffect(() => () => clearAnimTimers(), [])

  useEffect(() => {
    if (!config?.win.length) return
    setRound((prev) => {
      if (prev.stage === 'betting' && prev.betAmount === 0) return initRunDice(config)
      if (prev.stage === 'inProgress') return { ...prev, config }
      return prev
    })
  }, [config])

  const winChance = useMemo(() => {
    const total = gameConfig.win.reduce((sum, v) => sum + (DICE_WEIGHT[v] ?? 0), 0)
    return total / 36
  }, [gameConfig.win])

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const isSettled    = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, {
    idle: !isRolling && (isBetting || (isSettled && pendingResult != null)),
  })
  const canStart     = currentBet >= minBet && currentBet <= bankroll
  const potentialWinnings =
    isInProgress && round.betAmount > 0
      ? Math.round(round.betAmount * round.payoutMultiplier)
      : isBetting && currentBet > 0
        ? Math.round(currentBet * round.payoutMultiplier)
        : 0

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function handleStart() {
    if (!canStart || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setQuoteIdx((prev) => pickQuote(prev))
    setPendingResult(null)
    protectionActiveRef.current = insightProc.rollForBet()
    setRound(startRunDiceRound(bet, gameConfig))
    setCurrentBet(0)
    setTargetDice(null)
    setTargetTotal(null)
  }

  function handleRoll() {
    if (isRolling) return
    clearAnimTimers()

    const next = blessed
      ? winGame(round)
      : cursed
        ? loseGame(round)
        : rollRunDice(
            { ...round, config: gameConfig },
            { lossProtection: mode === 'survival' && protectionActiveRef.current },
          )

    // Snapshot target values for the animation to reveal
    setTargetDice(next.dice)
    setTargetTotal(next.rollResult)
    setIsRolling(true)
    setRevealStep(0)
    setSpinDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])

    // Cycle random values every 65ms during the spin phase
    spinIntervalRef.current = setInterval(() => {
      setSpinDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)])
    }, 65)

    // t1: stop cycling, land die 1
    const t1 = setTimeout(() => {
      if (spinIntervalRef.current) { clearInterval(spinIntervalRef.current); spinIntervalRef.current = null }
      setRevealStep(1)
    }, 550)

    // t2: land die 2
    const t2 = setTimeout(() => setRevealStep(2), 790)

    // t3: reveal total
    const t3 = setTimeout(() => setRevealStep(3), 990)

    // t4: commit state, handle settled
    const t4 = setTimeout(() => {
      setIsRolling(false)
      setRevealStep(0)
      setRound(next)

      if (next.stage === 'settled' && next.outcome) {
        const po = getRunDicePayout(next)
        const o = next.outcome
        const resolved = resolveGame(onResolve, {
          outcome: o,
          betAmount: next.betAmount,
          payout: po,
          multiplier: next.payoutMultiplier,
        })
        const built = buildPendingResult(
          { outcome: o, betAmount: next.betAmount, payout: resolved.payout },
          {
            result:
              o === 'push' ? 'Push' : next.rollResult != null ? String(next.rollResult) : 'Settled',
            resultSpecification:
              o === 'push' || next.rollResult == null ? undefined : 'Roll',
          },
          { gameMultiplier: o === 'win' ? next.payoutMultiplier : undefined, freeBet: resolved.firstBetWasFree },
        )
        setPendingResult(built)
      }
    }, 1220)

    animTimeoutsRef.current = [t1, t2, t3, t4]
  }

  const handleNewRound = useCallback(() => {
    unlock()
    clearAnimTimers()
    protectionActiveRef.current = false
    insightProc.resetPerk()
    setRound(initRunDice(config))
    setPendingResult(null)
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
    setTargetDice(null)
    setTargetTotal(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReBet, lastBet, bankroll, config])

  function handleNextRoll() {
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    if (!survivalAfterNext(mode)) return
    handleNewRound()
  }

  function outcomeColor(val: number, cfg = gameConfig): string {
    if (cfg.win.includes(val))  return 'bg-emerald-700/80 border-emerald-500 text-emerald-200'
    if (cfg.loss.includes(val)) return 'bg-red-900/80 border-red-700 text-red-300'
    return 'bg-white/10 border-white/20 text-white/50'
  }

  function dieColor(total: number): string {
    const rollClass = classifyRunDiceTotal(gameConfig, total)
    if (rollClass === 'win') return 'bg-emerald-500 border-emerald-300 text-white'
    if (rollClass === 'loss') return 'bg-red-600 border-red-400 text-white'
    return 'bg-zinc-200 border-zinc-300 text-zinc-900'
  }

  function rollLabel(total: number, protectedLossPush = false): string {
    const rollClass = classifyRunDiceTotal(gameConfig, total)
    if (rollClass === 'win') return 'Win roll'
    if (rollClass === 'loss') return protectedLossPush ? 'Loss — protected push' : 'Loss roll'
    return 'Neutral — re-rolling'
  }

  const lastRoll = round.rollResult
  const lastDice = round.dice
  // Outcome color is revealed only when the total appears (step 3); until then keep neutral
  const neutralDie = 'bg-zinc-200 border-zinc-300 text-zinc-900'
  const tColor = revealStep >= 3 && targetTotal != null ? dieColor(targetTotal) : neutralDie

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">Run Dice</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col p-4 md:p-6"
        entries={matchHistory}
        gameLabel="Run Dice"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {insightProc.perkActive && isInProgress && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Loss rolls return your bet this round
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={round.betAmount}
          betType={!isBetting && round.betAmount > 0 ? `Roll ${round.rollCount} / 3` : undefined}
          visible={!isBetting && round.betAmount > 0}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 shrink-0 justify-center sm:justify-start">
        <div className="flex items-center justify-center min-h-[100px] shrink-0">
          {isRolling ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">

                {/* Die 1 */}
                {revealStep === 0 ? (
                  <div key="spin-d1" className="w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 bg-zinc-200 border-zinc-300 text-zinc-900 dice-rolling">
                    {spinDice[0]}
                  </div>
                ) : (
                  <div key="land-d1" className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${tColor} dice-landing`}>
                    {targetDice?.[0]}
                  </div>
                )}

                <span className="text-white/30 text-xl font-bold">+</span>

                {/* Die 2 */}
                {revealStep < 2 ? (
                  <div key="spin-d2" className="w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 bg-zinc-200 border-zinc-300 text-zinc-900 dice-rolling">
                    {spinDice[1]}
                  </div>
                ) : (
                  <div key="land-d2" className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${tColor} dice-landing`}>
                    {targetDice?.[1]}
                  </div>
                )}

                <span className="text-white/30 text-xl font-bold">=</span>

                {/* Total */}
                {revealStep >= 3 ? (
                  <div key="land-total" className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${tColor} card-reveal`}>
                    {targetTotal}
                  </div>
                ) : (
                  <div key="spin-total" className="w-16 h-16 rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
                    <span className="text-3xl text-white/20">?</span>
                  </div>
                )}

              </div>
              <p className="text-white/40 text-xs h-4">
                {revealStep < 3 ? 'Rolling…' : (
                  targetTotal != null && rollLabel(targetTotal)
                )}
              </p>
            </div>
          ) : lastDice !== null && lastRoll !== null ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${dieColor(lastRoll)}`}>
                  {lastDice[0]}
                </div>
                <span className="text-white/30 text-xl font-bold">+</span>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${dieColor(lastRoll)}`}>
                  {lastDice[1]}
                </div>
                <span className="text-white/30 text-xl font-bold">=</span>
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-2xl text-3xl font-black border-2 ${dieColor(lastRoll)}`}>
                  {lastRoll}
                </div>
              </div>
              <p className="text-white/40 text-xs h-4">
                {rollLabel(
                  lastRoll,
                  round.outcome === 'push' && round.message.includes('protected'),
                )}
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
                <span className="text-3xl text-white/20">?</span>
              </div>
              <div className="w-16 h-16 rounded-xl border-2 border-white/20 bg-white/5 flex items-center justify-center">
                <span className="text-3xl text-white/20">?</span>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Outcome map</p>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => i + 2).map((val) => (
              <div key={val} className={`rounded-md border px-1 py-2 text-center text-xs font-bold transition-all ${outcomeColor(val)} ${
                lastRoll === val && !isRolling ? 'ring-2 ring-yellow-400 scale-110 shadow-lg' : ''
              }`}>
                <p className="text-[10px] leading-none opacity-60 mb-0.5">{val}</p>
                <p className="leading-none">
                  {gameConfig.win.includes(val) ? 'W' : gameConfig.loss.includes(val) ? 'L' : 'N'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 shrink-0">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Win chance</p>
            <p className="text-white font-semibold text-sm">{(winChance * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Payout</p>
            <p className="text-white font-semibold text-sm">{formatMultiplier(round.payoutMultiplier)}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-white/40 text-xs mb-1">Rolls</p>
            <p className="text-white font-semibold text-sm">{round.rollCount} / 3</p>
          </div>
        </div>

          <div className="min-h-10 flex items-center justify-center shrink-0 px-2">
            <p className="text-center text-xs text-zinc-500">
              {isBetting
                ? 'Roll 2 dice — W wins, L loses, N re-rolls (up to 3). Three neutrals = push.'
                : isInProgress
                  ? isRolling
                    ? 'Rolling…'
                    : 'Tap Roll for another throw or wait for the outcome.'
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

          <div className={`${GAME_DOCK_ACTIONS} min-h-[2.75rem] justify-center`}>
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
                  Roll →
                </button>
              )
            )}
            {isInProgress && (
              <button
                type="button"
                onClick={handleRoll}
                disabled={isRolling}
                className="min-w-[10.5rem] px-7 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-base transition-colors shadow-lg"
              >
                {isRolling ? 'Rolling…' : 'Roll'}
              </button>
            )}
            {isSettled && pendingResult && (
              <GameDockSettledActions
                mode={mode}
                showGameOver={showGameOver}
                onGameOver={handleGameOver}
                onNext={handleNextRoll}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
