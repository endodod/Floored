'use client'

import { usePathname } from 'next/navigation'
import { useSurvivalStore } from '@/store/survival-store'

/** Read and control the player's blessed status. Never applies in the daily challenge. */
export function useBless() {
  const inDaily    = usePathname()?.startsWith('/daily') ?? false
  const blessed    = useSurvivalStore((s) => s.blessed)
  const setBlessed = useSurvivalStore((s) => s.setBlessed)
  return { blessed: blessed && !inDaily, setBlessed }
}
