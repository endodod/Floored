'use client'

import { usePathname } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'

/** Read and control the player's cursed status. Never applies in the daily challenge or the ladder. */
export function useCurse() {
  const path = usePathname()
  const inDaily = (path?.startsWith('/daily') || path?.startsWith('/ladder')) ?? false
  const cursed = useSurvivalStore((s) => s.cursed)
  const setCursed = useSurvivalStore((s) => s.setCursed)
  return { cursed: cursed && !inDaily, setCursed }
}
