'use client'

import { usePathname } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'

/** Read and control the player's blessed status. Never applies in the daily challenge, the ladder, Challenges or Story. */
export function useBless() {
  const path       = usePathname()
  const inDaily    = (path?.startsWith('/daily') || path?.startsWith('/ladder') || path?.startsWith('/challenge') || path?.startsWith('/story')) ?? false
  const blessed    = useSurvivalStore((s) => s.blessed)
  const setBlessed = useSurvivalStore((s) => s.setBlessed)
  return { blessed: blessed && !inDaily, setBlessed }
}
