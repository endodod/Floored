'use client'
import type { GameMode } from '@/store/types'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/store/settings-store'
import { GAME_CARD_SHELL, GAME_BOARD_ARENA, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import {
  GAME_DOCK_PRIMARY_BTN,
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
import { BOARD_HINT, BOARD_LABEL, BOARD_PANEL } from '@/components/game-board-ui'
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

function CardView({
  card,
  held,
  isWinning,
  selectable,
  onToggle,
}: {
  card: Card
  held: boolean
  isWinning: boolean
  selectable: boolean
  onToggle: () => void
}) {
  const isRed = card.suit === '♥' || card.suit === '♦'
  const color = isRed ? 'text-red-600' : 'text-zinc-900'
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!selectable}
      className={[
        'w-14 sm:w-16 h-[5.5rem] sm:h-24 rounded-xl border border-zinc-200 bg-white shadow-2xl flex flex-col items-center justify-center gap-1 select-none transition-all duration-150',
        isWinning
          ? '-translate-y-1 ring-2 ring-[var(--felt)] shadow-[0_0_22px_-2px_rgba(79,174,132,0.75)]'
          : held
            ? '-translate-y-1 ring-2 ring-[var(--felt)]'
            : '',
        selectable ? 'cursor-pointer hover:-translate-y-0.5 active:scale-95' : 'cursor-default',
      ].join(' ')}
    >
      <span className={`text-xl sm:text-2xl font-semibold leading-none ${color}`}>{card.rank}</span>
      <span className={`text-2xl sm:text-3xl leading-none ${color}`}>{card.suit}</span>
      <span
        className={`rounded-full bg-felt px-1.5 text-[9px] font-semibold leading-[14px] text-ground ${held && !isWinning ? '' : 'invisible'}`}
      >
        Held
      </span>
    </button>
  )
}

const HAND_RANK_COLOR: Record<PokerHandRank, string> = {
  'royal-flush': 'text-gold glow-gold',
  'straight-flush': 'text-gold glow-gold',
  'four-of-a-kind': 'text-felt glow-felt',
  'full-house': 'text-felt glow-felt',
  flush: 'text-felt glow-felt',
  straight: 'text-felt glow-felt',
  'three-of-a-kind': 'text-felt glow-felt',
  'two-pair': 'text-felt glow-felt',
  'jacks-or-better': 'text-felt glow-felt',
  none: 'text-loss glow-loss',
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
        <span className="text-[13px] text-dim">{state.message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 h-full w-full flex-col items-center justify-center px-4 py-4 gap-4"
        entries={matchHistory}
        gameLabel="1 Player Poker"
      >
        <GameDockBackButton mode={mode} visible={isBetting && !showGameOver} />
        {mode === 'survival' && holdProc.perkActive && isSelecting && (
          <PerkHint className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Hold Harmony — draw favors held ranks
          </PerkHint>
        )}
        <GameActiveBetBadge
          betAmount={!isBetting ? state.betAmount : 0}
          visible={!isBetting && state.betAmount > 0}
        />

        {isBetting && (
          <div className={`w-full max-w-xs overflow-hidden shrink-0 ${BOARD_PANEL}`}>
            <div className="px-4 py-2 border-b border-white/5">
              <p className={`${BOARD_LABEL} text-center`}>Pay table</p>
            </div>
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {HAND_ORDER.map((rank) => (
                <div key={rank} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-soft">{HAND_LABELS[rank]}</span>
                  <span className="num text-xs text-ink">{HAND_PAYOUTS[rank]}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(isSelecting || isSettled) && (
          <div className="flex flex-col items-center gap-3 shrink-0">
            <div className={`text-center min-h-[1.5rem] ${!isSettled ? 'invisible' : ''}`}>
              <p className={`text-base font-semibold ${HAND_RANK_COLOR[state.handRank]}`}>
                {HAND_LABELS[state.handRank]}
                {state.multiplier > 0 && ` — ${state.multiplier}×`}
              </p>
            </div>

            <div className="flex gap-2 sm:gap-2.5">
              {state.hand.map((card, i) => (
                <CardView
                  key={i}
                  card={card}
                  held={state.held[i] ?? false}
                  isWinning={isSettled && state.winningIndices.includes(i)}
                  selectable={isSelecting}
                  onToggle={() => handleToggleHold(i)}
                />
              ))}
            </div>

            <p className={`text-[13px] text-soft min-h-5 ${!isSelecting ? 'invisible' : ''}`}>
              Tap cards to hold · {heldCount} held · then draw
            </p>
          </div>
        )}

        <div className="min-h-10 flex w-full max-w-sm items-center justify-center px-2 shrink-0">
          <p className={BOARD_HINT}>
            {isBetting
              ? 'Place chips and deal. Pair of jacks or better pays.'
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
              <p className="text-sm text-soft">
                Potential total winnings:{' '}
                <span className="font-semibold text-felt">{formatChips(potentialWinnings)}</span>
                <span className="text-dim ml-1">(max)</span>
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
