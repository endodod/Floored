'use client'

import { useMemo } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { useDailyStore } from '@/store/daily-store'
import { generateDailyChallenge } from '@/lib/daily/challenge'
import { useStore } from 'zustand'
import { useActiveLadderStore } from '@/lib/ladder/active'
import { useChallengeStore } from '@/store/challenge-store'
import { useStoryStore } from '@/store/story-store'
import type { GameMode } from '@/store/types'

/**
 * Minimum stake for a round: the floor min bet in survival, today's min bet in the daily,
 * the challenge's min bet in Challenges, the city's min bet in Story, and the whole pot in the ladder (every rung is all-in).
 */
export function useGameMinBet(mode: GameMode, freeplayMinBet = 1): number {
  const floorMinBet = useSurvivalStore((s) => s.floorMinBet)
  const dailyDate = useDailyStore((s) => s.date)
  const ladderPot = useStore(useActiveLadderStore(), (s) => s.pot)
  const challengeMinBet = useChallengeStore((s) => s.attempt?.def.minBet ?? freeplayMinBet)
  const storyMinBet = useStoryStore((s) => s.minBet())
  const dailyMinBet = useMemo(
    () => (dailyDate ? generateDailyChallenge(dailyDate).minBet : freeplayMinBet),
    [dailyDate, freeplayMinBet],
  )
  if (mode === 'ladder') return Math.max(1, ladderPot)
  if (mode === 'survival') return floorMinBet
  if (mode === 'daily') return dailyMinBet
  if (mode === 'challenge') return challengeMinBet
  if (mode === 'story') return storyMinBet
  return freeplayMinBet
}
