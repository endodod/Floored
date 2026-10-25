'use client'

import { usePathname } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'

/** Read and control the player's cursed status. Never applies in the daily challenge. */
export function useCurse() {
  const inDaily = usePathname()?.startsWith('/daily') ?? false
  const cursed = useSurvivalStore((s) => s.cursed)
  const setCursed = useSurvivalStore((s) => s.setCursed)
  return { cursed: cursed && !inDaily, setCursed }
}
