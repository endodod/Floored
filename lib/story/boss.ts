import type { Bot } from '@/lib/bots/types'
import type { Standings } from '@/lib/tables/types'
import { placeIn } from '@/lib/tables/standings'

/** Dustwater's boss: kept out of the general bot pool so no Tables seat ever draws him. */
export const CUTTER_HALE: Bot = {
  profile: { id: 'cutter', name: 'Cutter Hale', style: 'rock', tightness: 0.9, aggression: 0.7, bluff: 0.06, risk: 0.2, tiltProne: 0.05 },
  skill: 'shark',
}

/** Seats at the boss table: you (0), Cutter (1) and two regulars. */
export const BOSS_SEATS = 4
export const BOSS_CUTTER_SEAT = 1

/**
 * Beat Cutter: you win when his seat is knocked out before yours, lose when
 * yours goes first. Null while both are still in. Standings list the seats
 * still in as the first group until the table is over.
 */
export function bossOutcome(standings: Standings, over: boolean): 'won' | 'lost' | null {
  const alive = over ? [] : (standings[0] ?? [])
  const cutterOut = !alive.includes(BOSS_CUTTER_SEAT)
  const youOut = !alive.includes(0)
  if (!cutterOut && !youOut) return null
  if (cutterOut && !youOut) return 'won'
  if (youOut && !cutterOut) return 'lost'
  // Both decided (knocked out together, or the table ended): the better place wins; a tie is a loss.
  return (placeIn(standings, BOSS_CUTTER_SEAT) ?? 9) < (placeIn(standings, 0) ?? 9) ? 'lost' : (placeIn(standings, BOSS_CUTTER_SEAT) ?? 9) > (placeIn(standings, 0) ?? 9) ? 'won' : 'lost'
}
