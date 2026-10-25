'use client'
import type { GameMode } from '@/store/types'

import { useEffect, useRef, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useSettingsStore } from '@/store/settings-store'
import { buildPendingResult, type GamePendingResult } from '@/lib/game-result-labels'
import { survivalAfterNext } from '@/lib/survival/survival-round'
import { pickQuote } from '@/lib/gambling-quotes'
import { useBetGuard } from '@/hooks/use-bet-guard'
import type { GameResolveFn } from '@/hooks/use-game-bankroll'
import { resolveGame } from '@/lib/survival/game-resolve'
import { useSurvivalPerks } from '@/hooks/use-survival-perks'
import { useSurvivalGameOver } from '@/hooks/use-survival-game-over'
import type { BlackjackCard, BlackjackOutcome, BlackjackState } from '@/games/blackjack/types'
import {
  calculateHandValue,
  doubleDownBlackjack,
  hitBlackjack,
  initBlackjack,
  loseDouble,
  loseGame,
  loseHit,
  loseStand,
  commitPreviewBlackjack,
  previewBlackjackDeal,
  startBlackjackRound,
  standBlackjack,
  winDouble,
  winGame,
  winHit,
  winStand,
} from '@/games/blackjack/engine'
import { useCurse } from '@/hooks/use-curse'
import { useBless } from '@/hooks/use-bless'
import type { MatchHistoryEntry } from '@/components/game-match-history'

export interface BlackjackResult {
  outcome: BlackjackOutcome
  betAmount: number
  payout: number
  multiplier: number
}

const DEALER_CARD_DELAY = 700
const RESULT_DELAY = 600

export function useBlackjackGame({
  mode,
  bankroll,
  onBet,
  onResolve,
}: {
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: GameResolveFn<BlackjackResult>
}) {
  const { floorMinBet } = useSurvivalStore()
  const { autoReBet } = useSettingsStore()
  const { lock, unlock } = useBetGuard()
  const { cursed } = useCurse()
  const { blessed } = useBless()
  const minBet = mode === 'survival' ? floorMinBet : 1
  const { peekDealer, peekDealerLevel } = useSurvivalPerks('blackjack')
  const showDealerHole = mode === 'survival' && peekDealer

  const [round, setRound] = useState<BlackjackState>(initBlackjack())
  const [currentBet, setCurrentBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [quoteIdx, setQuoteIdx] = useState(() => pickQuote())
  const [pendingResult, setPendingResult] = useState<GamePendingResult | null>(null)
  const [dealerDisplayHand, setDealerDisplayHand] = useState<BlackjackCard[] | null>(null)
  const [settling, setSettling] = useState(false)
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([])
  const [bettingPreview, setBettingPreview] = useState<BlackjackState | null>(null)
  const cancelDealerAnim = useRef<(() => void) | null>(null)

  // Scores only appear after deal animation completes (~300ms)
  const [playerVisibleLen, setPlayerVisibleLen] = useState(0)
  const [dealerVisibleLen, setDealerVisibleLen] = useState(0)

  useEffect(() => {
    if (
      mode === 'survival' &&
      peekDealerLevel >= 2 &&
      round.stage === 'betting' &&
      !bettingPreview
    ) {
      setBettingPreview(previewBlackjackDeal())
    }
  }, [mode, peekDealerLevel, round.stage, bettingPreview])

  useEffect(() => {
    const t = setTimeout(() => setPlayerVisibleLen(round.playerHand.length), 300)
    return () => clearTimeout(t)
  }, [round.playerHand.length])

  const isBetting    = round.stage === 'betting'
  const isInProgress = round.stage === 'inProgress'
  const playerCanAct = isInProgress && !settling

  const { showGameOver, handleGameOver } = useSurvivalGameOver(mode, {
    idle: isBetting || (round.stage === 'settled' && pendingResult != null),
  })

  const previewDealerHand =
    isBetting && mode === 'survival' && peekDealerLevel >= 2 && bettingPreview
      ? bettingPreview.dealerHand
      : null
  const displayedDealerHand = dealerDisplayHand ?? previewDealerHand ?? round.dealerHand

  useEffect(() => {
    const len = displayedDealerHand.length
    const t = setTimeout(() => setDealerVisibleLen(len), 300)
    return () => clearTimeout(t)
  }, [displayedDealerHand.length])

  const canDouble =
    round.canDouble &&
    round.betAmount * 2 <= bankroll &&
    (round.playerHand.length === 2 || (mode === 'survival' && peekDealerLevel >= 4))
  const canDeal = currentBet >= minBet && currentBet <= bankroll

  function addChip(value: number) {
    setCurrentBet((prev) => Math.min(prev + value, bankroll))
  }

  function applyHoleCardPerks(state: BlackjackState): BlackjackState {
    if (mode !== 'survival' || peekDealerLevel <= 0 || state.stage !== 'settled' || !state.outcome) {
      return state
    }
    if (
      peekDealerLevel >= 3 &&
      state.dealerBlackjack &&
      !state.playerBlackjack &&
      state.outcome === 'loss'
    ) {
      return {
        ...state,
        outcome: 'push',
        payoutMultiplier: 1,
        message: 'Dealer blackjack — bet refunded.',
      }
    }
    if (peekDealerLevel >= 5 && state.playerBlackjack && state.outcome === 'win') {
      return {
        ...state,
        payoutMultiplier: 3,
        message: 'Blackjack! Pays 3×.',
      }
    }
    return state
  }

  function settleRound(state: BlackjackState, resultDelay = RESULT_DELAY) {
    const adjusted = applyHoleCardPerks(state)
    setRound(adjusted)
    if (adjusted.stage === 'settled' && adjusted.outcome) {
      const payout = Math.round(adjusted.betAmount * adjusted.payoutMultiplier)
      const resolved = resolveGame(onResolve, {
        outcome: adjusted.outcome,
        betAmount: adjusted.betAmount,
        payout,
        multiplier: adjusted.payoutMultiplier,
      })
      const o = adjusted.outcome!
      const resultKind =
        o === 'push' ? 'Push' : o === 'loss' ? 'Loss' : adjusted.payoutMultiplier >= 2.5 ? 'Blackjack' : 'Win'
      const built = buildPendingResult(
        { outcome: o, betAmount: adjusted.betAmount, payout: resolved.payout },
        { result: resultKind },
        { freeBet: resolved.firstBetWasFree },
      )
      setTimeout(() => setPendingResult(built), resultDelay)
    }
  }

  function animateDealerThenSettle(finalState: BlackjackState) {
    const fullHand = finalState.dealerHand
    setRound(prev => ({ ...prev, stage: 'settled' as BlackjackState['stage'], outcome: null }))
    setDealerDisplayHand(fullHand.slice(0, 2))

    const ids: ReturnType<typeof setTimeout>[] = []
    let delay = 0

    for (let i = 2; i < fullHand.length; i++) {
      const count = i + 1
      delay += DEALER_CARD_DELAY
      ids.push(setTimeout(() => setDealerDisplayHand(fullHand.slice(0, count)), delay))
    }

    delay += DEALER_CARD_DELAY
    ids.push(setTimeout(() => {
      setDealerDisplayHand(null)
      settleRound(finalState, 200)
    }, delay))

    cancelDealerAnim.current = () => ids.forEach(clearTimeout)
  }

  function handleDeal() {
    if (!canDeal || !lock()) return
    onBet?.(currentBet)
    setQuoteIdx((prev) => pickQuote(prev))
    setLastBet(currentBet)
    const started = blessed
      ? winGame(currentBet)
      : cursed
        ? loseGame(currentBet)
        : mode === 'survival' && peekDealerLevel >= 2 && bettingPreview
          ? commitPreviewBlackjack(bettingPreview, currentBet)
          : startBlackjackRound(currentBet)
    setBettingPreview(null)
    settleRound(started)
    setCurrentBet(0)
  }

  function handleHit() {
    const next = blessed ? winHit(round) : cursed ? loseHit(round) : hitBlackjack(round)
    if (next.stage === 'settled') {
      // Show busting card first; keep stage='inProgress' so dealer hole card stays hidden
      setSettling(true)
      setRound(prev => ({
        ...prev,
        playerHand: next.playerHand,
        deck: next.deck,
        canDouble: false,
        message: next.message,
      }))
      const t = setTimeout(() => {
        setSettling(false)
        settleRound(next)
      }, 600)
      cancelDealerAnim.current = () => clearTimeout(t)
      return
    }
    setRound(next)
  }

  function handleStand() {
    animateDealerThenSettle(blessed ? winStand(round) : cursed ? loseStand(round) : standBlackjack(round))
  }

  function handleDouble() {
    if (!canDouble) return
    onBet?.(round.betAmount)
    const finalState = blessed
      ? winDouble(round)
      : cursed
        ? loseDouble(round)
        : doubleDownBlackjack(round, {
            allowMultiCard: mode === 'survival' && peekDealerLevel >= 4,
          })
    const playerBusted = calculateHandValue(finalState.playerHand) > 21

    // Keep stage 'inProgress' so dealer hole card stays hidden while double card animates in
    setSettling(true)
    setRound(prev => ({
      ...prev,
      playerHand: finalState.playerHand,
      betAmount: finalState.betAmount,
      canDouble: false,
      message: 'Double down.',
    }))

    if (playerBusted) {
      const t = setTimeout(() => {
        setSettling(false)
        settleRound(finalState)
      }, 500)
      cancelDealerAnim.current = () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setSettling(false)
        animateDealerThenSettle(finalState)
      }, 400)
      cancelDealerAnim.current = () => clearTimeout(t)
    }
  }

  function handleNewHand() {
    unlock()
    cancelDealerAnim.current?.()
    cancelDealerAnim.current = null
    setDealerDisplayHand(null)
    setRound(initBlackjack())
    setBettingPreview(
      mode === 'survival' && peekDealerLevel >= 2 ? previewBlackjackDeal() : null,
    )
    setCurrentBet(autoReBet ? Math.min(lastBet, bankroll) : 0)
    setSettling(false)
    setPlayerVisibleLen(0)
    setDealerVisibleLen(0)
  }

  function handleNextHand() {
    unlock()
    if (pendingResult) {
      setMatchHistory(h => [pendingResult.entry, ...h].slice(0, 80))
      setPendingResult(null)
    }
    if (!survivalAfterNext(mode)) return
    handleNewHand()
  }

  return {
    round,
    currentBet,
    quoteIdx,
    pendingResult,
    dealerDisplayHand,
    matchHistory,
    playerVisibleLen,
    dealerVisibleLen,
    isBetting,
    isInProgress,
    playerCanAct,
    showGameOver,
    handleGameOver,
    showDealerHole,
    peekDealerLevel,
    bettingPreview,
    displayedDealerHand,
    canDouble,
    canDeal,
    minBet,
    calculateHandValue,
    addChip,
    handleDeal,
    handleHit,
    handleStand,
    handleDouble,
    handleNextHand,
  }
}
