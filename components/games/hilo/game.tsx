'use client'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'
import type { GameMode } from '@/store/types'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { PerkHint } from '@/components/survival/perk-hint'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { HiLoCard, HiLoState } from '@/games/hilo/types'
import {
  bumpStreak,
  cashOutHiLo,
  goAgainHiLo,
  guessHiLo,
  initHiLo,
  loseGame,
  startHiLoRound,
  streakMultiplier,
  tieGame,
  winGame,
} from '@/games/hilo/engine'

const CARD_BACK = 'repeating-linear-gradient(45deg, #27272a, #27272a 4px, #1f1f23 4px, #1f1f23 8px)'

function isRed(suit: string) {
  return suit === '♥' || suit === '♦'
}

function CardView({
  card,
  faceDown = false,
  animClass = '',
}: {
  card: HiLoCard | null
  faceDown?: boolean
  animClass?: string
}) {
  if (!card || faceDown) {
    return (
      <div
        className="rounded-xl bg-zinc-800 border border-zinc-700 shadow-2xl flex items-center justify-center shrink-0"
        style={{ width: 80, height: 112 }}
      >
        {card && (
          <div className="rounded-lg border border-zinc-700" style={{ width: 56, height: 80, background: CARD_BACK }} />
        )}
      </div>
    )
  }

  const color = isRed(card.suit) ? 'text-red-600' : 'text-zinc-900'

  return (
    <div
      className={`rounded-xl bg-white shadow-2xl flex flex-col justify-between border border-zinc-200 select-none shrink-0 ${animClass}`}
      style={{ width: 80, height: 112, padding: 7 }}
    >
      <div className={`flex flex-col items-start leading-none ${color}`}>
        <span className="font-black text-lg leading-none">{card.rank}</span>
        <span className="text-base leading-none">{card.suit}</span>
      </div>
      <span className={`text-4xl leading-none self-center ${color}`}>{card.suit}</span>
      <div className={`flex flex-col items-start rotate-180 leading-none ${color}`}>
        <span className="font-black text-lg leading-none">{card.rank}</span>
        <span className="text-base leading-none">{card.suit}</span>
      </div>
    </div>
  )
}

function NextCardReveal({ card }: { card: HiLoCard | null }) {
  const [animClass, setAnimClass] = useState('')
  const prevCard = useRef<HiLoCard | null>(null)

  useEffect(() => {
    if (card && card !== prevCard.current) {
      setAnimClass('card-reveal')
      prevCard.current = card
      const t = setTimeout(() => setAnimClass(''), 350)
      return () => clearTimeout(t)
    }
    if (!card) prevCard.current = null
  }, [card])

  return <CardView card={card} faceDown={!card} animClass={animClass} />
}

interface HiLoResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface HiLoGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<HiLoResult>
}

type PendingResult = GamePendingResult

export function HiLoGame({ mode, bankroll, onBet, onResolve }: HiLoGameProps) {
  const router = useRouter()
  const { autoReBet, forceTie: forceTieSetting } = useSettingsStore()
  const forceTie = forceTieSetting && mode !== 'daily' && mode !== 'ladder'
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { hiloHotStreak } = useSurvivalPerks('hilo')
  const minBet = useGameMinBet(mode)

  const [round, setRound] = useState<HiLoState>(initHiLo)
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [currentCardAnim, setCurrentCardAnim] = useState('')
  const [hotStreakFlash, setHotStreakFlash] = useState(false)

  const isBetting = round.stage === 'betting'
  const isPlaying = round.stage === 'playing'
  const isRiding = round.stage === 'riding'
  const isSettled = round.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, {
    idle: isBetting || (isSettled && pendingResult != null),
  })
  const canDeal = currentBet >= minBet && currentBet <= bankroll
  const showQuoteUntilNext = !isBetting && !isSettled
  const cashoutAmount = isRiding ? Math.round(round.betAmount * round.multiplier) : 0

  function addChip(value: number) {
    setCurrentBet(prev => Math.min(prev + value, bankroll))
  }

  function handleDeal() {
    if (!canDeal || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setCurrentBet(0)
    setPendingResult(null)
    setQuoteIdx((prev) => pickQuote(prev))
    setCurrentCardAnim('card-deal-in')
    setRound(startHiLoRound(bet))
    setTimeout(() => setCurrentCardAnim(''), 300)
  }

  function handleGuess(guess: 'higher' | 'lower') {
    if (!isPlaying && !isRiding) return
    let next = forceTie ? tieGame(round) : blessed ? winGame(round, guess) : cursed ? loseGame(round, guess) : guessHiLo(round, guess)
    if (hiloHotStreak && next.stage === 'riding' && !next.isTie && Math.random() < 0.25) {
      next = bumpStreak(next)
      setHotStreakFlash(true)
      setTimeout(() => setHotStreakFlash(false), 1200)
    }
    setRound(next)

    if (next.stage === 'settled') {
      const resolved = resolveGame(onResolve, {
        outcome: 'loss',
        betAmount: next.betAmount,
        payout: 0,
        multiplier: 0,
      })
      const built = buildPendingResult(
        { outcome: 'loss', betAmount: next.betAmount, payout: resolved.payout },
        {
          result: 'Loss',
        },
        { freeBet: resolved.firstBetWasFree },
      )
      setPendingResult(built)
    }
    /* If 'riding', wait for player to cash out or go again */
  }

  function handleCashOut() {
    if (!isRiding) return
    const settled = cashOutHiLo(round)
    setRound(settled)
    const payout = Math.round(settled.betAmount * settled.multiplier)
    const resolved = resolveGame(onResolve, {
      outcome: 'win',
      betAmount: settled.betAmount,
      payout,
      multiplier: settled.multiplier,
    })
    const built = buildPendingResult(
      { outcome: 'win', betAmount: settled.betAmount, payout: resolved.payout },
      {
        result: `${settled.streak}×`,
        resultSpecification: 'streak',
      },
      { gameMultiplier: settled.multiplier, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  function handleGoAgain() {
    if (!isRiding) return
    setRound(goAgainHiLo(round))
  }

  function handleNext() {
    unlock()
    if (pendingResult) setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    if (!survivalAfterNext(mode)) return
    setCurrentCardAnim('')
    setRound(initHiLo())
    if (autoReBet && lastBet >= minBet && lastBet <= bankroll) setCurrentBet(lastBet)
  }

  /* Arrow indicator color */
  const arrowColor =
    isRiding ? 'text-emerald-400' :
    isSettled && round.outcome === 'win' ? 'text-emerald-400' :
    isSettled && round.outcome === 'loss' ? 'text-red-400' :
    'text-zinc-600'

  const guessArrow = round.lastGuess === 'higher' ? '↑' : round.lastGuess === 'lower' ? '↓' : '↕'

  const nextMult = isRiding ? streakMultiplier(round.streak + 1) : 0

  /* Flame count for streak display */
  const flames = '🔥'.repeat(Math.min(round.streak, 5))

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">HiLo</span>
        <span className="text-sm text-zinc-600">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-4 py-6 gap-5"
        entries={matchHistory}
        gameLabel="HiLo"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {hotStreakFlash && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            🔥 Hot Streak — streak jumped by 2!
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={!isBetting ? round.betAmount : 0}
          extra={isRiding ? `${round.streak}× streak` : undefined}
          visible={!isBetting && round.betAmount > 0}
        />

        {/* Streak indicator — visible whenever there's an active multiplier */}
        <div className={`flex items-center gap-2 text-sm font-bold ${round.isTie ? 'text-zinc-300' : 'text-yellow-300'} ${round.multiplier === 0 ? 'invisible' : ''}`}>
          {round.isTie ? (
            <span className="px-2 py-0.5 rounded-md bg-zinc-700 text-zinc-200 text-xs font-bold tracking-widest uppercase">Push</span>
          ) : (
            <span>{flames}</span>
          )}
          <span>{round.isTie ? `Bet returned · ${formatMultiplier(round.multiplier)}` : `${round.streak}× streak · ${formatMultiplier(round.multiplier)}`}</span>
        </div>

        {/* Card display */}
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Current</p>
            <CardView card={round.currentCard} faceDown={!round.currentCard} animClass={currentCardAnim} />
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className={`text-4xl font-black transition-colors ${arrowColor}`}>{guessArrow}</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Next</p>
            <NextCardReveal card={round.nextCard} />
          </div>
        </div>

        {/* Fixed-height slot shared by guess buttons and riding buttons */}
        <div className="relative h-11 w-72 flex items-center justify-center">
          <div className={`absolute inset-x-0 flex gap-3 ${!isPlaying ? 'invisible pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => handleGuess('higher')}
              className="flex-1 py-2.5 rounded-xl border-2 border-purple-600 bg-purple-950 hover:bg-purple-900 text-purple-200 font-bold text-sm uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95"
            >
              ↑ Higher
            </button>
            <button
              type="button"
              onClick={() => handleGuess('lower')}
              className="flex-1 py-2.5 rounded-xl border-2 border-purple-600 bg-purple-950 hover:bg-purple-900 text-purple-200 font-bold text-sm uppercase tracking-wider transition-all duration-150 hover:scale-105 active:scale-95"
            >
              ↓ Lower
            </button>
          </div>
          <div className={`absolute inset-x-0 flex gap-3 ${!isRiding ? 'invisible pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={handleCashOut}
              className="flex-1 py-2.5 rounded-xl border-2 border-emerald-600 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-bold text-sm transition-all duration-150 hover:scale-105 active:scale-95"
            >
              Cash Out — {formatChips(cashoutAmount)}
            </button>
            <button
              type="button"
              onClick={handleGoAgain}
              className="flex-1 py-2.5 rounded-xl border-2 border-yellow-600 bg-yellow-950 hover:bg-yellow-900 text-yellow-200 font-bold text-sm transition-all duration-150 hover:scale-105 active:scale-95"
            >
              Go Again → {formatMultiplier(nextMult)}
            </button>
          </div>
        </div>

        <div className="min-h-10 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
          <p className="text-center text-xs text-zinc-500">
            {isBetting
              ? 'Ties keep your streak alive · Ace counts high · Win streaks multiply your payout.'
              : isPlaying
                ? 'Pick Higher or Lower above.'
                : isRiding
                  ? 'Cash out or go again on the board.'
                  : '\u00A0'}
          </p>
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
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isRiding && (
              <p className="text-sm text-zinc-400">
                {round.isTie ? (
                  <>Push — <span className="font-semibold text-zinc-200">{formatChips(cashoutAmount)} returned if you cash out</span></>
                ) : (
                  <>Potential total winnings:{' '}<span className="font-semibold text-emerald-400">{formatChips(cashoutAmount)}</span></>
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
            {!isBetting && !isRiding && !(isSettled && pendingResult) && (
              <p className="text-sm invisible select-none">{'\u00A0'}</p>
            )}
          </div>

          <div className={GAME_DOCK_ACTIONS}>
            <div className="flex justify-center w-full">
            {showGameOver ? (
              <GameDockGameOverButton onClick={handleGameOver} />
            ) : isBetting ? (
              <button
                type="button"
                onClick={handleDeal}
                disabled={!canDeal}
                className="min-w-[10.5rem] px-7 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900 font-bold rounded-lg transition-colors text-base shadow-lg"
              >
                Deal →
              </button>
            ) : isSettled ? (
              <GameDockSettledActions
                mode={mode}
                showGameOver={showGameOver}
                onGameOver={handleGameOver}
                onNext={handleNext}
              />
            ) : (
              <p className="min-w-[10.5rem] px-7 py-2 invisible select-none" aria-hidden>
                Deal →
              </p>
            )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
