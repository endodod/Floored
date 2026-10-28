'use client'

import { usePathname } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'

/** Read and control the player's blessed status. Never applies in the daily challenge or the ladder. */
export function useBless() {
  const path       = usePathname()
  const inDaily    = (path?.startsWith('/daily') || path?.startsWith('/ladder')) ?? false
  const blessed    = useSurvivalStore((s) => s.blessed)
  const setBlessed = useSurvivalStore((s) => s.setBlessed)
  return { blessed: blessed && !inDaily, setBlessed }
}
