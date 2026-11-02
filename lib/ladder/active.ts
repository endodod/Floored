'use client'

import { usePathname } from 'next/navigation'
import { useDailyLadderStore, useLadderStore, type LadderStoreHook } from '@/store/ladder-store'

/** Hub route of each ladder; its games live under `<hub>/<game>`. */
export const LADDER_HUB = '/ladder'
export const DAILY_LADDER_HUB = '/daily-ladder'

export function isDailyLadderPath(pathname: string | null | undefined): boolean {
  return pathname?.startsWith(DAILY_LADDER_HUB) ?? false
}

/** The ladder store the current route plays: the daily ladder under /daily-ladder, the endless one elsewhere. */
export function useActiveLadderStore(): LadderStoreHook {
  return isDailyLadderPath(usePathname()) ? useDailyLadderStore : useLadderStore
}

/** The hub of the ladder the current route plays. */
export function useLadderHub(): string {
  return isDailyLadderPath(usePathname()) ? DAILY_LADDER_HUB : LADDER_HUB
}
