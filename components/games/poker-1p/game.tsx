'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useRef, useState } from 'react'
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
  HAND_LABELS,
  HAND_PAYOUTS,
  dealHand,
  drawCards,
  initPoker,
  loseGame,
  toggleHold,
  winGame,
} from '@/games/poker-1p/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { Card, PokerHandRank, PokerState } from '@/games/poker-1p/types'
import { PlayingCard } from '@/components/games/playing-card'
import { GAME_DOCK_PRIMARY_BTN } from '@/components/game-dock-parts'
import { useGameMinBet } from '@/hooks/use-game-min-bet'
import { useLadderAllIn } from '@/hooks/use-ladder-all-in'

const HAND_ORDER: PokerHandRank[] = [
  'royal-flush',
  'straight-flush',
  'four-of-a-kind',
  'full-house',
  'flush',
  'straight',
  'three-of-a-kind',
  'two-pair',
  'jacks-or-better',
]

interface PokerResult {
  outcome: 'win' | 'loss'
  betAmount: number
  payout: number
  multiplier: number
}

interface Poker1pGameProps {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<PokerResult>
}

type PendingResult = GamePendingResult

// Five cards across: capped by height on a desktop, by width on a phone.
/** Five cards fit the board's width and what its height leaves after the hand name, tags and hint. */
const CARD_STYLE = {
  '--card-h': 'min(clamp(4rem, calc(100cqh - 13rem), 8.75rem), calc((100cqw - 4.5rem) * 0.28))',
} as React.CSSProperties

/** A card in the hand: tap to hold — a held card lifts with a gold edge, winners glow felt green. */
function CardView({
  card,
  index,
  held,
  isWinning,
  isDead,
  selectable,
  onToggle,
}: {
  card: Card
  index: number
  held: boolean
  isWinning: boolean
  /** Settled with no scoring hand: the cards fall back. */
  isDead: boolean
  selectable: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!selectable}
      aria-pressed={held}
      aria-label={`${card.rank}${card.suit}${held ? ', held' : ''}`}
      className={[
        'm-still g-lift group relative flex flex-col items-center gap-1.5 rounded-md',
        held || isWinning ? '-translate-y-2' : '',
        selectable ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default',
      ].join(' ')}
    >
      <PlayingCard
        rank={card.rank}
        suit={card.suit}
        style={{ '--i': index } as React.CSSProperties}
        className={
          isWinning
            ? 'g-deal g-win'
            : held
              ? 'g-deal shadow-[0_0_0_2px_var(--gold),0_0_24px_-4px_rgba(217,164,65,0.85)]'
              : isDead
                ? 'g-deal g-dim'
                : 'g-deal'
        }
      />
      <span
        className={`rounded-full px-2 text-[11px] font-semibold ${
          isWinning ? 'bg-felt-tint text-felt' : held ? 'bg-gold-tint text-gold' : 'invisible'
        }`}
      >
        {isWinning ? 'Scores' : 'Held'}
      </span>
    </button>
  )
}

export function Poker1pGame({ mode, bankroll, onBet, onResolve }: Poker1pGameProps) {
  const router = useRouter()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const { pokerHoldBias, pokerHoldBiasLevel  } = useSurvivalPerks('poker-1p')
  const holdProc = usePerkProc(
    mode === 'survival' && pokerHoldBias,
    'perk_poker_hold_bias',
    pokerHoldBiasLevel,
  )
  const holdBiasRef = useRef(false)
  const minBet = useGameMinBet(mode)

  const [state, setState] = useState<PokerState>(initPoker)
  const [currentBet, setCurrentBet] = useState(0)
  useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)
  const [lastBet, setLastBet] = useState(0)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())

  const isBetting = state.stage === 'betting'
  const isSelecting = state.stage === 'selecting'
  const isSettled = state.stage === 'settled'
  const { showGameOver, handleGameOver } = useRunEnd(mode, { idle: isBetting || isSettled })
  const canDeal = currentBet >= minBet && currentBet <= bankroll
  const showQuoteUntilNext = !isBetting && !isSettled
  const potentialWinnings =
    isSelecting && state.betAmount > 0
      ? Math.round(state.betAmount * HAND_PAYOUTS['royal-flush'])
      : 0

  function addChip(v: number) {
    setCurrentBet((p) => Math.min(p + v, bankroll))
  }

  function handleDeal() {
    if (!canDeal || !lock()) return
    const bet = currentBet
    onBet?.(bet)
    setLastBet(bet)
    setQuoteIdx((prev) => pickQuote(prev))
    holdBiasRef.current = holdProc.rollForBet()
    setState(dealHand(bet))
    setCurrentBet(0)
    setPendingResult(null)
  }

  function handleToggleHold(index: number) {
    setState((prev) => toggleHold(prev, index))
  }

  function handleDraw() {
    setState((prev) => {
      const settled = blessed ? winGame(prev) : cursed ? loseGame(prev) : drawCards(prev, { holdBias: holdBiasRef.current })
      recordOutcome(settled)
      holdProc.resetPerk()
      return settled
    })
  }

  function recordOutcome(s: PokerState) {
    const payout = s.outcome === 'win' ? Math.round(s.betAmount * s.multiplier) : 0
    const outcome = s.outcome ?? 'loss'
    const resolved = resolveGame(onResolve, {
      outcome,
      betAmount: s.betAmount,
      payout,
      multiplier: s.multiplier,
    })
    const built = buildPendingResult(
      { outcome, betAmount: s.betAmount, payout: resolved.payout },
      {
        result: HAND_LABELS[s.handRank],
      },
      { gameMultiplier: outcome === 'win' && s.multiplier > 0 ? s.multiplier : undefined, freeBet: resolved.firstBetWasFree },
    )
    setPendingResult(built)
  }

  const handleNext = useCallback(() => {
    unlock()
    if (pendingResult) setMatchHistory((h) => [pendingResult.entry, ...h].slice(0, 80))
    setPendingResult(null)
    if (!survivalAfterNext(mode)) return
    setState(initPoker())
    setCurrentBet(autoReBet && lastBet <= bankroll ? lastBet : 0)
  }, [pendingResult, autoReBet, lastBet, bankroll, mode])

  const heldCount = state.held.filter(Boolean).length

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">1 Player Poker</span>
        {mode === 'survival' && holdProc.perkActive && isSelecting && (
          <PerkHint>Hold Harmony — draw favors held ranks</PerkHint>
        )}
        <span className="text-[13px] text-dim">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-4 py-[clamp(0.5rem,2.5cqh,1rem)] gap-[clamp(0.5rem,2.5cqh,1rem)]"
        entries={matchHistory}
        gameLabel="1 Player Poker"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        <GameActiveBetBadge
          betAmount={!isBetting ? state.betAmount : 0}
          visible={!isBetting && state.betAmount > 0}
        />

        {isBetting && (
          <div className="poker-pays poker-frame rise w-full max-w-sm shrink-0 rounded-md px-5 py-3" aria-label="Pay table">
            <p className="felt-print mb-2 text-center">Jacks or better · pays</p>
            <dl className="flex flex-col">
              {HAND_ORDER.map((rank, i) => (
                <div key={rank} className="flex items-baseline gap-2 py-[3px]">
                  <dt className={`text-[13px] ${i === 0 ? 'text-gold' : 'text-soft'}`}>{HAND_LABELS[rank]}</dt>
                  <span className="flex-1 border-b border-dotted border-[rgba(217,164,65,0.25)]" aria-hidden />
                  <dd className={`num text-[13px] ${i === 0 ? 'text-gold glow-gold' : 'text-ink'}`}>{HAND_PAYOUTS[rank]}×</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {(isSelecting || isSettled) && (
          <div className="poker-hand flex flex-col items-center gap-[clamp(0.25rem,2cqh,0.75rem)] shrink-0" style={CARD_STYLE}>
            <div className={`min-h-[2rem] text-center ${!isSettled ? 'invisible' : ''}`}>
              <p
                className={`rise text-[22px] font-semibold ${
                  state.handRank === 'none' ? 'text-loss glow-loss' : 'text-felt glow-felt'
                }`}
              >
                {HAND_LABELS[state.handRank]}
                {state.multiplier > 0 && <span className="num ml-2 text-gold glow-gold">{state.multiplier}×</span>}
              </p>
            </div>

            <div className="flex gap-1.5 sm:gap-2.5">
              {state.hand.map((card, i) => (
                <CardView
                  key={`${i}-${card.rank}${card.suit}`}
                  card={card}
                  index={i}
                  held={state.held[i] ?? false}
                  isWinning={isSettled && state.winningIndices.includes(i)}
                  isDead={isSettled && state.handRank === 'none'}
                  selectable={isSelecting}
                  onToggle={() => handleToggleHold(i)}
                />
              ))}
            </div>

            <p className={`min-h-5 text-[13px] text-soft ${!isSelecting ? 'invisible' : ''}`}>
              Tap cards to hold · <span className="num text-gold">{heldCount}</span> held · then draw
            </p>
          </div>
        )}

        <div className="poker-hint min-h-10 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
          <p className="text-center text-[13px] text-dim">
            {isBetting
              ? mode === 'ladder'
                ? 'Deal for the whole pot. Pair of jacks or better pays.'
                : 'Place chips and deal. Pair of jacks or better pays.'
              : isSelecting
                ? 'Hold cards, then draw.'
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
            {isSelecting && potentialWinnings > 0 && (
              <p className="text-[14px] text-soft">
                A royal flush pays <span className="num text-gold glow-gold">{formatChips(potentialWinnings)}</span>
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
            {!isBetting && !isSelecting && !(isSettled && pendingResult) && (
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
                    onClick={isSettled ? handleNext : isSelecting ? handleDraw : handleDeal}
                    data-sound="card"
                    disabled={isBetting && !canDeal}
                    className={GAME_DOCK_PRIMARY_BTN}
                  >
                    {isSettled ? 'Next →' : isSelecting ? 'Draw →' : 'Deal →'}
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
