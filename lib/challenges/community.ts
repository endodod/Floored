import type { ChallengeDef, ChallengeSlot } from './types'
import { GAME_BY_NAME } from '@/lib/game-catalog'

/** A community challenge as the API sends it. */
export interface CommunityChallengeDto extends ChallengeDef {
  author: string
  /** Attempts started by anyone. */
  tries: number
  /** Best completed result by a signed-in player. */
  top: { name: string; best: number } | null
  /** ISO date string. */
  createdAt: string
}

export interface CommunityChallengeDetailDto extends CommunityChallengeDto {
  leaderboard: { name: string; best: number }[]
}

export type CommunitySort = 'new' | 'popular'

/** The games column is JSON; trust only well-formed slots for games that still exist. */
export function parseSlots(raw: unknown): ChallengeSlot[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (g): g is ChallengeSlot =>
      typeof g === 'object' && g !== null && typeof (g as ChallengeSlot).game === 'string' &&
      GAME_BY_NAME.has((g as ChallengeSlot).game) &&
      typeof (g as ChallengeSlot).bets === 'number',
  )
}
