import type { GameName } from '@/store/types'
import { GAME_BY_NAME } from '@/lib/game-catalog'

/** Every challenge, preset or community, starts from the same bankroll. */
export const CHALLENGE_START_BANKROLL = 1_000
export const CHALLENGE_MIN_GAMES = 2
export const CHALLENGE_MAX_GAMES = 6
export const CHALLENGE_MIN_BETS = 1
export const CHALLENGE_MAX_BETS = 6
/** Min bets a community creator can pick from. */
export const CHALLENGE_MIN_BET_OPTIONS = [5, 10, 20, 25, 50, 100] as const
export const CHALLENGE_NAME_MAX = 40
export const CHALLENGE_THEME_MAX = 24
export const CHALLENGE_DESCRIPTION_MAX = 160

export interface ChallengeSlot {
  game: GameName
  /** Bets the player must place on this game. */
  bets: number
}

export interface ChallengeDef {
  id: string
  name: string
  /** Short theme tag shown on the card: "Cards", "Dice", "Risky". */
  theme: string
  description: string
  /** Smallest stake per bet; dropping below it with bets left fails the attempt. */
  minBet: number
  games: ChallengeSlot[]
  /** Community challenges: the creator's display name. */
  author?: string
}

export type ChallengeSource = 'preset' | 'community'

/** Stats and attempts are keyed by source and id, so a community id can never collide with a preset. */
export function challengeKey(source: ChallengeSource, id: string): string {
  return `${source}:${id}`
}

export function totalChallengeBets(def: Pick<ChallengeDef, 'games'>): number {
  return def.games.reduce((sum, g) => sum + g.bets, 0)
}

export interface ChallengeInput {
  name: string
  theme: string
  description: string
  minBet: number
  games: ChallengeSlot[]
}

/**
 * Checks a challenge a player wants to publish. Shared by the create form and
 * the API route. Returns the cleaned input, or the first problem found.
 */
export function validateChallengeInput(raw: unknown): { ok: true; value: ChallengeInput } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Invalid challenge.' }
  const b = raw as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''
  const theme = typeof b.theme === 'string' ? b.theme.trim().replace(/\s+/g, ' ') : ''
  const description = typeof b.description === 'string' ? b.description.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 3 || name.length > CHALLENGE_NAME_MAX) {
    return { ok: false, error: `Name must be 3–${CHALLENGE_NAME_MAX} characters.` }
  }
  if (theme.length < 2 || theme.length > CHALLENGE_THEME_MAX) {
    return { ok: false, error: `Theme must be 2–${CHALLENGE_THEME_MAX} characters.` }
  }
  if (description.length > CHALLENGE_DESCRIPTION_MAX) {
    return { ok: false, error: `Description can be at most ${CHALLENGE_DESCRIPTION_MAX} characters.` }
  }
  const minBet = b.minBet
  if (typeof minBet !== 'number' || !(CHALLENGE_MIN_BET_OPTIONS as readonly number[]).includes(minBet)) {
    return { ok: false, error: 'Pick a min bet from the list.' }
  }
  if (!Array.isArray(b.games)) return { ok: false, error: 'Pick the games.' }
  if (b.games.length < CHALLENGE_MIN_GAMES || b.games.length > CHALLENGE_MAX_GAMES) {
    return { ok: false, error: `Pick ${CHALLENGE_MIN_GAMES}–${CHALLENGE_MAX_GAMES} games.` }
  }
  const seen = new Set<string>()
  const games: ChallengeSlot[] = []
  for (const g of b.games) {
    if (typeof g !== 'object' || g === null) return { ok: false, error: 'Invalid game.' }
    const { game, bets } = g as Record<string, unknown>
    if (typeof game !== 'string' || !GAME_BY_NAME.has(game as GameName)) return { ok: false, error: 'Unknown game.' }
    if (seen.has(game)) return { ok: false, error: 'Each game can only be picked once.' }
    seen.add(game)
    if (typeof bets !== 'number' || !Number.isInteger(bets) || bets < CHALLENGE_MIN_BETS || bets > CHALLENGE_MAX_BETS) {
      return { ok: false, error: `Each game needs ${CHALLENGE_MIN_BETS}–${CHALLENGE_MAX_BETS} bets.` }
    }
    games.push({ game: game as GameName, bets })
  }
  return { ok: true, value: { name, theme, description, minBet, games } }
}
