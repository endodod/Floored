'use client'

import { useMemo } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useDailyStore } from '@/store/daily-store'
import { generateDailyChallenge } from '@/lib/daily/challenge'
import type { GameMode } from '@/store/types'

/** Minimum stake for a round: the floor min bet in survival, today's min bet in the daily. */
export function useGameMinBet(mode: GameMode, freeplayMinBet = 1): number {
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const dailyDate = useDailyStore((s) => s.date)
  const dailyMinBet = useMemo(
    () => (dailyDate ? generateDailyChallenge(dailyDate).minBet : freeplayMinBet),
    [dailyDate, freeplayMinBet],
  )
  if (mode === 'survival') return floorMinBet
  if (mode === 'daily') return dailyMinBet
  return freeplayMinBet
}
