'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import type { GameMode } from '@/store/types'

/** True on ladder routes — for shared dock parts that don't receive the game mode. */
export function useIsLadderRoute(): boolean {
  return usePathname()?.startsWith('/ladder') ?? false
}

/**
 * Ladder rounds always stake the whole pot: keeps the game's bet at its wallet (the pot) while it can bet.
 * The wallet is empty during a round and after it settles, so a game resetting its bet to 0 is left alone then.
 */
export function useLadderAllIn(
  mode: GameMode,
  bankroll: number,
  currentBet: number,
  setCurrentBet: (bet: number) => void,
) {
  const ladder = mode === 'ladder'
  useEffect(() => {
    if (ladder && bankroll > 0 && currentBet !== bankroll) setCurrentBet(bankroll)
  }, [ladder, bankroll, currentBet, setCurrentBet])
}
