'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useSurvivalStore } from '@/store/survival-store'
import { useDailyStore } from '@/store/daily-store'
import type { GameName } from '@/store/types'
import { applyResolveModifiers } from '@/lib/survival/apply-modifiers'
import { evaluateMissionsOnGame } from '@/lib/survival/mission-evaluator'
import { useOpeningTicketActive } from '@/hooks/use-opening-ticket'
import {
  getOpeningTicketCapMultiplier,
  hasFreeFirstBet,
  survivalWagerCap,
} from '@/lib/survival/survival-perks'

export interface GameResolvePayload {
  outcome: 'win' | 'loss' | 'push'
  betAmount: number
  payout: number
  multiplier?: number
  /**
   * When false, only credits payout (e.g. Plinko balls before the last in a drop).
   * Floor bet count, missions, streak, and history run on the settling resolve.
   */
  settleFloorBet?: boolean
  /** Payout was already bankrolled on prior resolves in the same drop. */
  payoutAlreadyCredited?: boolean
  /** Any ball in the drop lost (Plinko multi-ball — streak / flawless). */
  subRoundLoss?: boolean
}

export interface ResolvedGamePayload extends GameResolvePayload {
  payoutBoostMult?: number
  firstBetWasFree?: boolean
}

/** Game `onResolve` prop — bankroll hooks may return boosted payout fields. */
export type GameResolveFn<R extends GameResolvePayload = GameResolvePayload> = (
  result: R,
) => R | ResolvedGamePayload | void

export function useFreeplayGameBankroll() {
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const bust = useFreeplayStore((s) => s.bust)
  const reset = useFreeplayStore((s) => s.reset)
  const setBankroll = useFreeplayStore((s) => s.setBankroll)
  const markBust = useFreeplayStore((s) => s.markBust)

  const handleBet = useCallback(
    (amount: number) => {
      const b = useFreeplayStore.getState().bankroll
      setBankroll(b - amount)
    },
    [setBankroll],
  )

  const handleResolve = useCallback(
    <R extends GameResolvePayload>(result: R): R => {
      const b = useFreeplayStore.getState().bankroll
      const newB = b + result.payout
      setBankroll(newB)
      if (newB <= 10) markBust()
      return result
    },
    [setBankroll, markBust],
  )

  return {
    bankroll: Math.max(0, bankroll),
    bust,
    reset,
    handleBet,
    handleResolve,
  }
}

export function useSurvivalGameBankroll(game: GameName) {
  const bankroll = useSurvivalStore((s) => s.bankroll)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)
  const openingBetFree = useOpeningTicketActive()
  const deductBet = useSurvivalStore((s) => s.deductBet)
  const recordResultPayout = useSurvivalStore((s) => s.recordResultPayout)
  const applyMissionResults = useSurvivalStore((s) => s.applyMissionResults)

  const openingTicketFreeCap = useMemo(
    () => floorMinBet * getOpeningTicketCapMultiplier(purchasedUpgrades),
    [floorMinBet, purchasedUpgrades],
  )

  const wagerCap = useMemo(
    () => survivalWagerCap(bankroll, openingBetFree, openingTicketFreeCap),
    [bankroll, openingBetFree, openingTicketFreeCap],
  )

  const handleBet = useCallback(
    (amount: number) => {
      const before = useSurvivalStore.getState()
      const isFirstBetThisFloor = before.history.filter((h) => h.floor === currentFloor).length === 0
      const isFree =
        isFirstBetThisFloor &&
        !before.firstBetInsuranceUsed &&
        hasFreeFirstBet(before.purchasedUpgrades)

      if (isFree) {
        useSurvivalStore.setState({ firstBetInsuranceUsed: true })
        const freeCap = before.floorMinBet * getOpeningTicketCapMultiplier(before.purchasedUpgrades)
        const excess = Math.max(0, amount - freeCap)
        if (excess > 0) deductBet(excess)
        return
      }
      deductBet(amount)
    },
    [currentFloor, deductBet],
  )

  const handleResolve = useCallback(
    <R extends GameResolvePayload>(result: R): R & ResolvedGamePayload => {
      const settleFloorBet = result.settleFloorBet !== false

      if (!settleFloorBet) {
        recordResultPayout(
          {
            id: `${game}-${Date.now()}`,
            game,
            floor: currentFloor,
            betAmount: result.betAmount,
            payout: result.payout,
            outcome: result.outcome === 'push' ? 'push' : result.outcome,
            multiplier: result.multiplier,
            playedAt: new Date(),
          },
          { settleFloorBet: false },
        )
        return result as R & ResolvedGamePayload
      }

      const before = useSurvivalStore.getState()
      const isFirstBetThisFloor = before.history.filter((h) => h.floor === currentFloor).length === 0
      const wasFreeBet =
        isFirstBetThisFloor &&
        before.firstBetInsuranceUsed &&
        hasFreeFirstBet(before.purchasedUpgrades)

      const adjusted = applyResolveModifiers(
        { ...result, game },
        {
          purchasedUpgrades: before.purchasedUpgrades,
          difficulty: before.difficulty,
          wasFreeBet,
        },
      )

      const bankrollDelta = result.payoutAlreadyCredited
        ? adjusted.payout - result.payout
        : adjusted.payout

      recordResultPayout(
        {
          id: `${game}-${Date.now()}`,
          game,
          floor: currentFloor,
          betAmount: result.betAmount,
          payout: adjusted.payout,
          outcome: result.outcome === 'push' ? 'push' : result.outcome,
          multiplier: adjusted.multiplier ?? result.multiplier,
          playedAt: new Date(),
        },
        { settleFloorBet: true, bankrollDelta },
      )

      const after = useSurvivalStore.getState()
      const gamesPlayedThisFloor = after.history.filter((h) => h.floor === currentFloor).length

      const updatedMissions = evaluateMissionsOnGame(after.missions, {
        game,
        floor: currentFloor,
        betAmount: result.betAmount,
        payout: adjusted.payout,
        outcome: result.outcome === 'push' ? 'push' : result.outcome,
        multiplier: adjusted.multiplier ?? result.multiplier,
        bankroll: after.bankroll,
        floorStartBankroll: after.floorStartBankroll,
        streak: after.streak,
        gamesPlayedThisFloor,
        subRoundLoss: result.subRoundLoss,
      })

      applyMissionResults(updatedMissions)

      const finalBankroll = useSurvivalStore.getState().bankroll
      if (finalBankroll < after.floorMinBet) useSurvivalStore.getState().queueDefeat('bust')

      return {
        ...result,
        payout: adjusted.payout,
        multiplier: adjusted.multiplier ?? result.multiplier,
        payoutBoostMult: adjusted.payoutBoostMult,
        firstBetWasFree: adjusted.firstBetWasFree,
      }
    },
    [game, currentFloor, recordResultPayout, applyMissionResults],
  )

  return { bankroll, wagerCap, openingBetFree, handleBet, handleResolve }
}

export function useDailyGameBankroll(game: GameName, bets: number) {
  const bankroll = useDailyStore((s) => s.bankroll)
  const finished = useDailyStore((s) => s.finished)
  const openRound = useDailyStore((s) => s.openRound)
  const used = useDailyStore((s) => s.progress[game]?.betsUsed ?? 0)
  const placeBet = useDailyStore((s) => s.placeBet)
  const resolve = useDailyStore((s) => s.resolve)

  const betsRemaining = Math.max(0, bets - used)
  const roundOpen = openRound === game
  // With no bets left the game sees an empty wallet, so it can't start another round.
  const wagerCap = !finished && (betsRemaining > 0 || roundOpen) ? Math.max(0, bankroll) : 0

  // Payout already credited by partial resolves (Plinko balls) in the current round.
  const roundCreditedRef = useRef(0)

  const handleBet = useCallback(
    (amount: number) => {
      if (useDailyStore.getState().openRound !== game) roundCreditedRef.current = 0
      placeBet(game, amount)
    },
    [game, placeBet],
  )

  const handleResolve = useCallback(
    <R extends GameResolvePayload>(result: R): R => {
      const settle = result.settleFloorBet !== false
      const credit = result.payoutAlreadyCredited
        ? result.payout - roundCreditedRef.current
        : result.payout
      roundCreditedRef.current = settle ? 0 : roundCreditedRef.current + result.payout
      resolve(game, credit, settle)
      return result
    },
    [game, resolve],
  )

  return { bankroll, wagerCap, betsRemaining, roundOpen, finished, handleBet, handleResolve }
}
