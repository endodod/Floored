'use client'

import { useMemo } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useDailyStore } from '@/store/daily-store'
import { generateDailyChallenge } from '@/lib/daily/challenge'
import { useLadderStore } from '@/store/ladder-store'
import type { GameMode } from '@/store/types'

/**
 * Minimum stake for a round: the floor min bet in survival, today's min bet in the daily,
 * and the whole pot in the ladder (every rung is all-in).
 */
export function useGameMinBet(mode: GameMode, freeplayMinBet = 1): number {
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const dailyDate = useDailyStore((s) => s.date)
  const ladderPot = useLadderStore((s) => s.pot)
  const dailyMinBet = useMemo(
    () => (dailyDate ? generateDailyChallenge(dailyDate).minBet : freeplayMinBet),
    [dailyDate, freeplayMinBet],
  )
  if (mode === 'ladder') return Math.max(1, ladderPot)
  if (mode === 'survival') return floorMinBet
  if (mode === 'daily') return dailyMinBet
  return freeplayMinBet
}
