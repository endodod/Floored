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
import { PlayingCard } from '@/components/games/playing-card'
import { GAME_DOCK_PRIMARY_BTN } from '@/components/game-dock-parts'
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

/** Cards take what the board has left after the streak, labels, buttons and hint. */
const CARD_STYLE = { '--card-h': 'clamp(4rem, calc(100cqh - 13rem), 8.75rem)' } as React.CSSProperties

function CardView({
  card,
  faceDown = false,
  animClass = '',
}: {
  card: HiLoCard | null
  faceDown?: boolean
  animClass?: string
}) {
  if (!card) return <PlayingCard variant="slot" />
  if (faceDown) return <PlayingCard variant="back" />
  return <PlayingCard rank={card.rank} suit={card.suit} className={animClass} />
}

/** Guess buttons on the felt: large outlined pills with the arrow leading. */
const GUESS_BTN =
  'm-still flex-1 h-12 rounded-full border text-[15px] font-semibold transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97]'

/** The next card: face-down while the guess is open, flipped up when it lands. */
function NextCardReveal({ card, pending, className }: { card: HiLoCard | null; pending: boolean; className?: string }) {
  const [animClass, setAnimClass] = useState('')
  const prevCard = useRef<HiLoCard | null>(null)

  useEffect(() => {
    if (card && card !== prevCard.current) {
      setAnimClass('g-flip')
      prevCard.current = card
      const t = setTimeout(() => setAnimClass(''), 350)
      return () => clearTimeout(t)
    }
    if (!card) prevCard.current = null
  }, [card])

  if (!card) return <PlayingCard variant={pending ? 'back' : 'slot'} />
  return <CardView card={card} animClass={`${animClass} ${className ?? ''}`} />
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
    setCurrentCardAnim('g-deal')
    setRound(startHiLoRound(bet))
    setTimeout(() => setCurrentCardAnim(''), 500)
  }

  function handleGuess(guess: 'higher' | 'lower') {
    if (!isPlaying && !isRiding) return
    let next = forceTie ? tieGame(round) : blessed ? winGame(round, guess) : cursed ? loseGame(round, guess) : guessHiLo(round, guess)
    if (mode === 'survival' && hiloHotStreak && next.stage === 'riding' && !next.isTie && Math.random() < 0.25) {
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

  /* Arrow badge: lit felt on a hit, red on a miss, quiet while waiting */
  const arrowColor =
    isRiding || (isSettled && round.outcome === 'win')
      ? 'text-felt bg-felt-tint shadow-[0_0_24px_-4px_rgba(79,174,132,0.7)]'
      : isSettled && round.outcome === 'loss'
        ? 'text-loss bg-loss-tint shadow-[0_0_24px_-4px_rgba(229,86,111,0.6)]'
        : 'text-dim bg-ground/70'

  const guessArrow = round.lastGuess === 'higher' ? '↑' : round.lastGuess === 'lower' ? '↓' : '↕'

  const nextMult = isRiding ? streakMultiplier(round.streak + 1) : 0


  return (
    <div className={GAME_CARD_SHELL} style={CARD_STYLE}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">HiLo</span>
        {hotStreakFlash && (
          <PerkHint>Hot streak — streak jumped by 2</PerkHint>
        )}
        <span className="text-[13px] text-dim">{round.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative"
        entries={matchHistory}
        gameLabel="HiLo"
      >
        <div className="hilo-board relative flex min-h-0 h-full w-full flex-col items-center justify-center px-4 py-[clamp(0.5rem,3cqh,1.5rem)] gap-[clamp(0.5rem,3cqh,1.25rem)]">
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge
          betAmount={!isBetting ? round.betAmount : 0}
          extra={isRiding ? `${round.streak}× streak` : undefined}
          visible={!isBetting && round.betAmount > 0}
        />

        {/* Streak: a gold pip per correct guess and the running multiplier */}
        <div className={`hilo-streak flex h-8 items-center gap-3 ${round.multiplier === 0 ? 'invisible' : ''}`}>
          {round.isTie ? (
            <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs font-semibold text-ink">Push</span>
          ) : (
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: Math.min(round.streak, 10) }, (_, i) => (
                <span key={i} className="unit h-2.5 w-2.5 rotate-45 bg-gold shadow-[0_0_8px_rgba(217,164,65,0.8)]" style={{ '--d': `${i * 40}ms` } as React.CSSProperties} />
              ))}
            </span>
          )}
          <span className="text-[13px] text-soft">
            {round.isTie ? 'Bet returned' : `${round.streak}× streak`}
          </span>
          <span className="num text-[17px] text-gold glow-gold">{formatMultiplier(round.multiplier)}</span>
        </div>

        {/* The two cards, the guess between them */}
        <div className="hilo-cards flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col items-center gap-2">
            <p className="felt-print">Current</p>
            <CardView card={round.currentCard} animClass={currentCardAnim} />
          </div>

          <span
            className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl font-semibold transition-[color,background-color,box-shadow] duration-300 ${arrowColor}`}
            aria-label={round.lastGuess ? `Guessed ${round.lastGuess}` : 'Higher or lower'}
          >
            {guessArrow}
          </span>

          <div className="flex flex-col items-center gap-2">
            <p className="felt-print">Next</p>
            {/* A right guess glows, a wrong one shakes. */}
            <div className={isSettled && round.outcome === 'loss' ? 'g-shake' : ''}>
              <NextCardReveal card={round.nextCard} pending={!isBetting} className={isRiding ? 'g-win' : ''} />
            </div>
          </div>
        </div>

        {/* Fixed-height slot shared by guess buttons and riding buttons */}
        <div className="hilo-actions relative flex h-12 w-full max-w-sm items-center justify-center">
          <div className={`absolute inset-x-0 flex gap-3 ${!isPlaying ? 'invisible pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => handleGuess('higher')}
              data-sound="card"
              className={`${GUESS_BTN} hilo-higher`}
            >
              <span className="mr-1.5">↑</span>Higher
            </button>
            <button
              type="button"
              onClick={() => handleGuess('lower')}
              data-sound="card"
              className={`${GUESS_BTN} hilo-lower`}
            >
              <span className="mr-1.5">↓</span>Lower
            </button>
          </div>
          <div className={`absolute inset-x-0 flex gap-3 ${!isRiding ? 'invisible pointer-events-none' : ''}`}>
            <button type="button" onClick={handleCashOut} data-sound="cashout" className={`${GAME_DOCK_PRIMARY_BTN} h-12 min-w-0 flex-1 px-4`}>
              Cash out <span className="num ml-1">{formatChips(cashoutAmount)}</span>
            </button>
            <button
              type="button"
              onClick={handleGoAgain}
              className={`${GUESS_BTN} border-gold text-gold hover:bg-gold-tint hover:shadow-[0_0_24px_-6px_rgba(217,164,65,0.8)]`}
            >
              Go again <span className="num ml-1">{formatMultiplier(nextMult)}</span>
            </button>
          </div>
        </div>

        <div className="hilo-hint min-h-10 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
          <p className="text-center text-[13px] text-dim">
            {isBetting
              ? 'Ties keep your streak alive · Ace counts high · Win streaks multiply your payout.'
              : isPlaying
                ? 'Pick Higher or Lower above.'
                : isRiding
                  ? 'Cash out or go again on the board.'
                  : '\u00A0'}
          </p>
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
            {isBetting && <GameDockBetRow currentBet={currentBet} onClear={() => setCurrentBet(0)} />}
            {isRiding && (
              <p className="text-[14px] text-soft">
                {round.isTie ? (
                  <>Push — <span className="num text-ink">{formatChips(cashoutAmount)}</span> returned if you cash out</>
                ) : (
                  <>Cash out now for <span className="num text-felt glow-felt">{formatChips(cashoutAmount)}</span></>
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
              <button type="button" onClick={handleDeal} disabled={!canDeal} data-sound="card" className={GAME_DOCK_PRIMARY_BTN}>
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
              <p className="h-10 min-w-[10.5rem] px-7 invisible select-none" aria-hidden>
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
