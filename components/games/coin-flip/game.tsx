'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_ACTIONS,
  GAME_DOCK_INNER,
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_SECONDARY_BTN,
  GAME_DOCK_SETTLED_SLOT,
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
import { getCoinBiasChance } from '@/lib/survival/survival-perks'
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import { cashOut, flipAgain, initCoinFlip, loseFlipAgain, loseGame, startFlip, winFlipAgain, winGame } from '@/games/coin-flip/engine'
import type { CoinFlipState, CoinSide } from '@/games/coin-flip/types'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

const COIN_SPIN_MS = 1500
const COIN_LAND_MS = 900
const COIN_FULL_SPINS = 4

function sideToDeg(side: CoinSide): number {
  return side === 'tails' ? 180 : 0
}

function spinEndDeg(from: CoinSide, to: CoinSide): number {
  const fromDeg = sideToDeg(from)
  const toDeg = sideToDeg(to)
  const delta = (toDeg - fromDeg + 360) % 360
  return fromDeg + COIN_FULL_SPINS * 360 + delta
}

interface CoinFlipResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface CoinFlipGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<CoinFlipResult>
}

type PendingResult = GamePendingResult

export function CoinFlipGame({ mode, bankroll, onBet, onResolve }: CoinFlipGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { coinBias, purchasedUpgrades } = useSurvivalPerks('coin-flip')
  const minBet = useGameMinBet(mode)
  const biasChance =
    mode === 'survival' && coinBias
      ? getCoinBiasChance(purchasedUpgrades, 'coin-flip')
      : undefined

  const [state, setState] = useState<CoinFlipState>(initCoinFlip)
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [coinAnim, setCoinAnim] = useState<'idle' | 'spinning' | 'landing'>('idle')
  const [spinKeyframes, setSpinKeyframes] = useState({ from: '0deg', end: '1440deg' })
  const pendingFlipRef = useRef<CoinFlipState | null>(null)
  const lastPickRef = useRef<CoinSide | null>(null)
  const t1Ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t2Ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isBetting = state.stage === 'betting'
  const isRiding = state.stage === 'riding'
  const isSettled = state.stage === 'settled'
  const isFlipping = coinAnim !== 'idle'
  const { showGameOver, handleGameOver } = useRunEnd(mode, {
    idle: !isFlipping && (isBetting || isSettled),
  })
  const canFlip = currentBet >= minBet && currentBet <= bankroll && state.pick !== null

  const cashoutAmount = isRiding ? Math.round(state.betAmount * state.multiplier) : 0
  const activeBet = !isBetting && state.betAmount > 0 ? state.betAmount : 0
  const pickLabel = (side: CoinSide | null) => (side === 'heads' ? 'Heads' : side === 'tails' ? 'Tails' : undefined)
  const showQuoteUntilNext = isFlipping || (!isBetting && !isSettled)

  function addChip(v: number) {
    setCurrentBet((p) => Math.min(p + v, bankroll))
  }

  function handlePickSide(side: CoinSide) {
    if (isFlipping) return
    lastPickRef.current = side
    if (isBetting) setState((prev) => ({ ...prev, pick: side }))
    else if (isRiding) setState((prev) => ({ ...prev, nextPick: side }))
  }

  useEffect(() => {
    if (!autoReBet || isFlipping || !lastPickRef.current) return
    if (isRiding && !state.nextPick)
      setState((prev) => ({ ...prev, nextPick: lastPickRef.current }))
  }, [state.stage, state.streak, isRiding, isFlipping, autoReBet, state.nextPick])

  useEffect(() => () => {
    if (t1Ref.current) clearTimeout(t1Ref.current)
    if (t2Ref.current) clearTimeout(t2Ref.current)
  }, [])

  function settleRound(s: CoinFlipState) {
    const payout = s.outcome === 'win' ? Math.round(s.betAmount * s.multiplier) : 0
    const outcome = s.outcome ?? 'loss'
    const resolved = resolveGame(onResolve, {
      outcome,
      betAmount: s.betAmount,
      payout,
      multiplier: s.outcome === 'win' ? s.multiplier : 0,
    })
    const built = buildPendingResult(
      { outcome, betAmount: s.betAmount, payout: resolved.payout },
      {
        betSpecification: pickLabel(s.pick),
        result: outcome === 'win' ? `${s.multiplier}×` : 'Loss',
        resultSpecification: outcome === 'win' ? 'Win' : undefined,
      },
      { gameMultiplier: outcome === 'win' ? s.multiplier : undefined, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  function triggerFlip(next: CoinFlipState) {
    const fromSide = state.lastResult ?? 'heads'
    const toSide = next.lastResult ?? 'heads'
    setSpinKeyframes({
      from: `${sideToDeg(fromSide)}deg`,
      end: `${spinEndDeg(fromSide, toSide)}deg`,
    })
    pendingFlipRef.current = next
    setCoinAnim('spinning')

    t1Ref.current = setTimeout(() => {
      const result = pendingFlipRef.current!
      setState(result)
      setCoinAnim('landing')
      if (result.stage === 'settled') settleRound(result)
      t2Ref.current = setTimeout(() => setCoinAnim('idle'), COIN_LAND_MS)
    }, COIN_SPIN_MS)
  }

  function handleFlip() {
    if (!canFlip || !state.pick || isFlipping || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    const next = blessed ? winGame(bet, state.pick!) : cursed ? loseGame(bet, state.pick) : startFlip(bet, state.pick, biasChance != null ? { biasChance } : undefined)
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    triggerFlip(next)
  }

  function handleFlipAgain() {
    if (!state.nextPick || isFlipping) return
    setQuoteIdx((prev) => pickQuote(prev))
    triggerFlip(blessed ? winFlipAgain(state) : cursed ? loseFlipAgain(state) : flipAgain(state, biasChance != null ? { biasChance } : undefined))
  }

  function handleCashOut() {
    if (isFlipping) return
    const next = cashOut(state)
    setState(next)
    settleRound(next)
  }

  const handleNext = useCallback(() => {
    unlock()
    if (pendingResult) setMatchHistory((h) => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    if (!survivalAfterNext(mode)) return
    setState({ ...initCoinFlip(), pick: autoReBet ? lastPickRef.current : null })
    setSpinKeyframes({ from: '0deg', end: '1440deg' })
    setCoinAnim('idle')
    setCurrentBet(autoReBet && lastBet <= bankroll ? lastBet : 0)
  }, [pendingResult, autoReBet, lastBet, bankroll, mode])

  const coinAnimClass = coinAnim === 'spinning' ? 'coin-spinning' : coinAnim === 'landing' ? 'coin-landing' : ''
  // After the coin lands: a winning face glows, a losing one shakes and falls back.
  const coinOutcome =
    coinAnim === 'spinning' || !state.outcome
      ? ''
      : state.outcome === 'win'
        ? 'g-gold'
        : coinAnim === 'landing'
          ? 'g-shake'
          : 'g-dim'
  const displaySide = state.lastResult ?? 'heads'
  const coinStyle = {
    '--coin-rest-rotate': displaySide === 'tails' ? '180deg' : '0deg',
    ...(coinAnim === 'spinning'
      ? { '--coin-spin-from': spinKeyframes.from, '--coin-spin-end': spinKeyframes.end }
      : {}),
  } as React.CSSProperties

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">Coin Flip</span>
        <span className="text-[13px] text-dim">{isFlipping ? 'Flipping…' : state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full"
        entries={matchHistory}
        gameLabel="Coin Flip"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !isFlipping && !showGameOver} />
        {biasChance != null && (isBetting || isRiding) && !isFlipping && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Coin biased toward your pick (~{Math.round(biasChance * 100)}%)
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={activeBet}
          betType={pickLabel(isBetting ? state.pick : isRiding ? state.nextPick : state.pick)}
          extra={isRiding && !isFlipping ? `${state.multiplier}× · ${state.streak}× streak` : undefined}
          visible={activeBet > 0 && !isBetting}
        />

        <div className="cf-board flex h-full w-full flex-col items-center justify-center gap-[clamp(0.5rem,3cqh,1.25rem)] px-4 py-3">
        <div className={`cf-coin relative shrink-0 rounded-full ${coinOutcome}`}>
        <div
          className={`coin-3d h-full w-full ${coinAnimClass}`}
          style={coinStyle}
          aria-label={isFlipping ? 'Coin flipping' : `Coin showing ${displaySide}`}
        >
          <div className="coin-edge" aria-hidden />
          <div className="coin-face coin-head">
            <span className="coin-mark">H</span>
            <span className="coin-name">Heads</span>
          </div>
          <div className="coin-face coin-tail">
            <span className="coin-mark">T</span>
            <span className="coin-name">Tails</span>
          </div>
        </div>
        </div>

        <div className="cf-side flex flex-col items-center gap-[clamp(0.5rem,3cqh,1.25rem)]">
        <div className={`flex min-h-6 items-center gap-2 text-[13px] ${!isRiding || isFlipping ? 'invisible' : ''}`}>
          <span className="flex gap-1" aria-hidden>
            {Array.from({ length: Math.min(state.streak, 5) }, (_, i) => (
              <span key={i} className="g-pop h-2 w-2 rounded-full bg-gold" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </span>
          <span className="text-soft">
            <span className="num text-ink">{state.streak}×</span> streak ·{' '}
            <span key={state.multiplier} className="num g-pop inline-block text-gold glow-gold">{state.multiplier}×</span>
          </span>
        </div>

        <div className={`flex gap-3 shrink-0 ${isSettled || isFlipping ? 'invisible pointer-events-none' : ''}`} role="radiogroup" aria-label="Pick a side">
          {(['heads', 'tails'] as CoinSide[]).map((side) => {
            const isActive = isBetting ? state.pick === side : state.nextPick === side
            return (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => handlePickSide(side)}
                className={[
                  'g-lift m-still h-[clamp(2.5rem,12cqh,3.25rem)] w-24 rounded-full border text-[13px] font-semibold transition-[border-color,background-color,color,box-shadow,transform] duration-150 active:scale-95',
                  isActive
                    ? 'border-felt bg-felt-tint text-ink -translate-y-0.5 shadow-[0_0_18px_-6px_rgba(79,174,132,0.7)]'
                    : 'border-control bg-black/25 text-soft hover:border-dim hover:text-ink',
                ].join(' ')}
              >
                {side === 'heads' ? 'Heads' : 'Tails'}
              </button>
            )
          })}
        </div>

        <div className="cf-hint min-h-9 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
          <p className="text-center text-[13px] text-dim">
            {isBetting && !isFlipping
              ? 'Pick heads or tails, place chips, then flip.'
              : isFlipping
                ? 'Flipping…'
                : isRiding
                  ? 'Win streak — cash out or flip again.'
                  : '\u00A0'}
          </p>
        </div>
        </div>
        </div>
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>
        <div className={GAME_DOCK_INNER}>
          <GameDockChipRow
            visible={isBetting || showQuoteUntilNext}
            bankroll={bankroll}
            currentBet={currentBet}
            onAddChip={addChip}
            quoteIdx={quoteIdx}
            showQuote={showQuoteUntilNext}
            minBet={minBet}
          />

          <div className={GAME_DOCK_SETTLED_SLOT}>
            {isBetting && !showQuoteUntilNext && (
              <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />
            )}
            {isRiding && !isFlipping && (
              <p className="text-[13px] text-soft">
                Potential total winnings:{' '}
                <span className="num text-felt glow-felt">{formatChips(cashoutAmount)}</span>
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
            {!((isBetting && !showQuoteUntilNext) || (isRiding && !isFlipping) || (isSettled && pendingResult)) && (
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
                  onClick={isSettled ? handleNext : isRiding ? handleCashOut : handleFlip}
                  disabled={(isBetting && !canFlip) || isFlipping}
                  className={isRiding ? GAME_DOCK_SECONDARY_BTN : GAME_DOCK_PRIMARY_BTN}
                >
                  {isSettled ? 'Next →' : isRiding ? 'Cash Out' : 'Flip →'}
                </button>
              </>
            )}
            {isRiding && (
              <button
                type="button"
                onClick={handleFlipAgain}
                disabled={!state.nextPick || isFlipping}
                className={GAME_DOCK_PRIMARY_BTN}
              >
                Flip Again →
              </button>
            )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
