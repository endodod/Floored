'use client'

import { useCallback, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FLOOR_BET_LIMIT, MAX_FLOORS } from '@/lib/survival/balance'
import { useSurvivalStore } from '@/store/survival-store'
import { useLadderStore } from '@/store/ladder-store'
import { useFreeplayStore } from '@/store/freeplay-store'
import type { GameMode } from '@/store/types'

export interface RunEndStatus {
  /** What the round meant for the run — shown after the round's own result, e.g. "Ladder run lost". */
  text: string
  tone: 'win' | 'loss' | 'neutral'
  /** Replaces the dock's Leave / Next once the game is idle. Absent when play carries on as usual. */
  action?: { label: string; tone: 'primary' | 'danger' }
}

const MODES: GameMode[] = ['survival', 'freeplay', 'daily', 'ladder']

/** Game mode from the route — for shared dock parts that don't receive it. */
export function useRouteMode(): GameMode | null {
  const segment = usePathname()?.split('/')[1]
  return MODES.find((m) => m === segment) ?? null
}

/**
 * Run status after the last round: survival defeat or floor cleared, ladder rung outcome, freeplay bust.
 * Read from the stores alone, so the dock's result row and its action button always agree.
 */
export function useRunEndStatus(mode: GameMode | null): RunEndStatus | null {
  const floorComplete = useSurvivalStore((s) => s.floorComplete)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const endlessMode = useSurvivalStore((s) => s.endlessMode)
  const pendingDefeatReason = useSurvivalStore((s) => s.pendingDefeatReason)
  const busted = useSurvivalStore((s) => s.bankroll < s.floorMinBet)
  const noBetsLeft = useSurvivalStore(
    (s) => s.floorBetsPlaced >= FLOOR_BET_LIMIT && !s.floorComplete && s.bankroll < s.quotaTarget,
  )
  const lastResult = useLadderStore((s) => s.lastResult)
  const rung = useLadderStore((s) => s.rung)
  const lives = useLadderStore((s) => s.lives)
  const freeplayBust = useFreeplayStore((s) => s.bust)

  if (mode === 'survival') {
    if (floorComplete) {
      const final = currentFloor === MAX_FLOORS && !endlessMode
      return {
        text: final ? 'All floors cleared! 🏆' : `Quota met · Floor ${currentFloor} cleared`,
        tone: 'win',
        action: { label: 'Continue →', tone: 'primary' },
      }
    }
    const reason = pendingDefeatReason ?? (busted ? 'bust' : noBetsLeft ? 'quota' : null)
    if (reason) {
      return {
        text: reason === 'bust' ? 'Out of chips · Run lost' : 'Quota missed · Run lost',
        tone: 'loss',
        action: { label: 'End run', tone: 'danger' },
      }
    }
  }

  if (mode === 'ladder' && lastResult) {
    switch (lastResult.kind) {
      case 'clear':
        return { text: `Rung ${rung} cleared`, tone: 'win', action: { label: 'Back to ladder', tone: 'primary' } }
      case 'checkpoint':
        return { text: `Checkpoint ${rung} reached`, tone: 'win', action: { label: 'Back to ladder', tone: 'primary' } }
      case 'topped':
        return { text: 'Ladder topped! 👑', tone: 'win', action: { label: 'See results', tone: 'primary' } }
      case 'push':
        return { text: 'Push · Play the rung again', tone: 'neutral' }
      case 'fall':
        return {
          text: `Fell · ${lives} ${lives === 1 ? 'life' : 'lives'} left`,
          tone: 'loss',
          action: { label: 'Back to ladder', tone: 'primary' },
        }
      case 'out':
        return { text: 'Out of lives · Ladder run lost', tone: 'loss', action: { label: 'See results', tone: 'danger' } }
    }
  }

  if (mode === 'freeplay' && freeplayBust) {
    return { text: 'Out of chips', tone: 'loss', action: { label: 'Refill chips', tone: 'primary' } }
  }

  return null
}

/**
 * Run-ending dock state for a game. Pass `idle: true` when the game is not mid-animation so the
 * run's action (End run / Continue / Back to ladder / Refill) can replace the dock's Leave / Next.
 */
export function useRunEnd(mode: GameMode, { idle }: { idle: boolean }) {
  const router = useRouter()
  const status = useRunEndStatus(mode)
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const actualBankroll = useSurvivalStore((s) => s.bankroll)
  const pendingDefeatReason = useSurvivalStore((s) => s.pendingDefeatReason)
  const queueDefeat = useSurvivalStore((s) => s.queueDefeat)

  const showGameOver = idle && !!status?.action

  useEffect(() => {
    if (mode !== 'survival' || !idle || pendingDefeatReason != null || actualBankroll >= floorMinBet) {
      return
    }
    queueDefeat('bust')
  }, [mode, idle, pendingDefeatReason, actualBankroll, floorMinBet, queueDefeat])

  const handleGameOver = useCallback(() => {
    if (mode === 'survival') {
      const state = useSurvivalStore.getState()
      if (state.floorComplete) {
        // Rewards and the next-floor choice are on the lobby.
        router.push('/survival')
        return
      }
      // Ends the run; the survival wrapper routes home once it's inactive.
      state.confirmDefeat()
      return
    }
    if (mode === 'ladder') {
      router.push('/ladder')
      return
    }
    if (mode === 'freeplay') useFreeplayStore.getState().reset()
  }, [mode, router])

  return { status, showGameOver, handleGameOver }
}
