'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

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
  mode: GameMode
  bankroll: number
  config?: RunDiceConfig
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<RunDiceResult>
}

type DieTone = 'neutral' | 'win' | 'loss'

// Pip positions on a 3×3 grid (0 = top left, 8 = bottom right).
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** An ivory die with drawn pips, sized by --die. */
function Die({ value, tone = 'neutral', className = '' }: { value: number | null | undefined; tone?: DieTone; className?: string }) {
  const pips = PIPS[value ?? 0] ?? []
  return (
    <div className={`rd-die relative ${tone === 'win' ? 'g-win' : ''} ${className}`} data-tone={tone} aria-label={value ? `Die showing ${value}` : 'Die'}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'rd-pip' : ''} />
      ))}
    </div>
  )
}

/** The total beside the dice: a figure on a tile, tinted by what it means. */
function TotalTile({ value, tone, className = '' }: { value: number | null | undefined; tone: DieTone; className?: string }) {
  const toneClass =
    tone === 'win' ? 'border-felt bg-felt-tint text-felt glow-felt g-win' : tone === 'loss' ? 'border-loss bg-loss-tint text-loss' : 'border-control bg-raised text-ink'
  return <div className={`rd-total num relative ${toneClass} ${className}`}>{value}</div>
}

export function RunDiceGame({ mode, bankroll, config, onBet, onResolve }: RunDiceGameProps) {
  const router = useRouter()
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
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<RunDiceState>(initRunDice(config))
  const protectionActiveRef = useRef(false)

  const gameConfig = useMemo((): RunDiceConfig => {
    if (config && config.win.length > 0) return config
    return round.config
  }, [config, round.config])
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
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
  const { showGameOver, handleGameOver } = useRunEnd(mode, {
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
    if (cfg.win.includes(val))  return 'bg-felt-tint border-felt text-felt'
    if (cfg.loss.includes(val)) return 'bg-loss-tint border-transparent text-loss'
    return 'bg-black/25 border-transparent text-dim'
  }

  function dieTone(total: number): DieTone {
    const rollClass = classifyRunDiceTotal(gameConfig, total)
    if (rollClass === 'win') return 'win'
    if (rollClass === 'loss') return 'loss'
    return 'neutral'
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
  const tTone: DieTone = revealStep >= 3 && targetTotal != null ? dieTone(targetTotal) : 'neutral'

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Run Dice</span>
        <span className="text-[13px] text-dim">{round.message}</span>
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

        <div className="rd-board flex min-h-0 flex-1 flex-col gap-[clamp(0.5rem,2.6cqh,1rem)] shrink-0 justify-center">
        <div className="rd-dice flex items-center justify-center shrink-0">
          {isRolling ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-[calc(var(--die)*0.2)]">
                {revealStep === 0 ? (
                  <Die key="spin-d1" value={spinDice[0]} className="dice-rolling" />
                ) : (
                  <Die key="land-d1" value={targetDice?.[0]} tone={tTone} className="dice-landing" />
                )}
                <span className="text-dim text-xl">+</span>
                {revealStep < 2 ? (
                  <Die key="spin-d2" value={spinDice[1]} className="dice-rolling" />
                ) : (
                  <Die key="land-d2" value={targetDice?.[1]} tone={tTone} className="dice-landing" />
                )}
                <span className="text-dim text-xl">=</span>
                {revealStep >= 3 ? (
                  <TotalTile key="land-total" value={targetTotal} tone={tTone} className={`g-pop ${tTone === 'loss' ? 'g-shake' : ''}`} />
                ) : (
                  <div key="spin-total" className="rd-total border-dashed border-control text-dim">?</div>
                )}
              </div>
              <p className="text-dim text-[12px] h-4">
                {revealStep < 3 ? 'Rolling…' : (
                  targetTotal != null && rollLabel(targetTotal)
                )}
              </p>
            </div>
          ) : lastDice !== null && lastRoll !== null ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-[calc(var(--die)*0.2)]">
                <Die value={lastDice[0]} tone={dieTone(lastRoll)} />
                <span className="text-dim text-xl">+</span>
                <Die value={lastDice[1]} tone={dieTone(lastRoll)} />
                <span className="text-dim text-xl">=</span>
                <TotalTile value={lastRoll} tone={dieTone(lastRoll)} />
              </div>
              <p className="text-dim text-[12px] h-4">
                {rollLabel(
                  lastRoll,
                  round.outcome === 'push' && round.message.includes('protected'),
                )}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-[calc(var(--die)*0.2)]">
                <div className="rd-total border-dashed border-control text-dim g-pop">?</div>
                <div className="rd-total border-dashed border-control text-dim g-pop" style={{ '--i': 1 } as React.CSSProperties}>?</div>
              </div>
              <p className="h-4" />
            </div>
          )}
        </div>

        <div className="rd-map shrink-0">
          <p className="text-dim text-[11px] mb-1.5">Outcome map</p>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, i) => i + 2).map((val) => {
              const isLast = lastRoll === val && !isRolling
              return (
                <div
                  key={isLast ? `${val}-hit` : val}
                  className={`relative rounded-md border-2 px-0.5 py-[clamp(0.25rem,1.4cqh,0.5rem)] text-center text-[12px] font-semibold ${outcomeColor(val)} ${
                    isLast ? 'g-pop g-gold z-10' : ''
                  }`}
                >
                  <p className="num text-[10px] leading-none opacity-70 mb-0.5">{val}</p>
                  <p className="leading-none">
                    {gameConfig.win.includes(val) ? 'W' : gameConfig.loss.includes(val) ? 'L' : 'N'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rd-stats grid grid-cols-3 gap-2 shrink-0">
          <div className="bg-black/25 rounded-xl px-3 py-[clamp(0.35rem,1.8cqh,0.75rem)] text-center">
            <p className="text-dim text-[11px] mb-0.5">Win chance</p>
            <p className="num text-ink text-[14px]">{(winChance * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-black/25 rounded-xl px-3 py-[clamp(0.35rem,1.8cqh,0.75rem)] text-center">
            <p className="text-dim text-[11px] mb-0.5">Payout</p>
            <p className="num text-gold glow-gold text-[14px]">{formatMultiplier(round.payoutMultiplier)}</p>
          </div>
          <div className="bg-black/25 rounded-xl px-3 py-[clamp(0.35rem,1.8cqh,0.75rem)] text-center">
            <p className="text-dim text-[11px] mb-0.5">Rolls</p>
            <p key={round.rollCount} className={`num text-ink text-[14px] ${isBetting ? '' : 'g-pop'}`}>{round.rollCount} / 3</p>
          </div>
        </div>

          <div className="rd-hint min-h-9 flex items-center justify-center shrink-0 px-2">
            <p className="text-center text-[13px] text-dim">
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

          <div className={`${GAME_DOCK_ACTIONS} min-h-[2.75rem] justify-center`}>
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
                  Roll →
                </button>
              )
            )}
            {isInProgress && (
              <button
                type="button"
                onClick={handleRoll}
                disabled={isRolling}
                className={GAME_DOCK_PRIMARY_BTN}
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
