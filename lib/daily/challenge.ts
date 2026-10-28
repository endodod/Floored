import type { GameName } from '@/store/types'
import { GAMES } from '@/lib/game-catalog'
import { createRng, seedFromString } from '@/utils/rng'

export const DAILY_GAME_COUNT = 3
export const DAILY_MIN_BETS = 1
export const DAILY_MAX_BETS = 3
/** Possible shared starting bankrolls — one is picked per day. */
export const DAILY_BANKROLLS = [1_000, 1_500, 2_000, 2_500, 3_000, 4_000, 5_000] as const

/** Possible min bets as a share of the day's bankroll. */
export const DAILY_MIN_BET_SHARES = [0.01, 0.02, 0.03] as const

/** Day #1 of the daily challenge (UTC). */
const EPOCH_UTC = Date.UTC(2026, 9, 25)
const DAY_MS = 86_400_000

export interface DailyGameSlot {
  game: GameName
  /** Number of bets the player may place on this game today. */
  bets: number
}

export interface DailyChallenge {
  /** UTC date key, YYYY-MM-DD. */
  date: string
  /** 1-based day number since launch. */
  number: number
  /** Shared bankroll for all the day's games. */
  bankroll: number
  /** Smallest allowed stake per bet. Dropping below it with bets left fails the day. */
  minBet: number
  games: DailyGameSlot[]
}

/** UTC date key — the daily rolls over at 00:00 UTC so every player gets the same challenge. */
export function dailyDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function dailyNumber(date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - EPOCH_UTC) / DAY_MS) + 1
}

/** Milliseconds until the next UTC midnight. */
export function msUntilNextDaily(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return next - now.getTime()
}

/** Deterministic per date: same bankroll, games and bet counts for everyone. */
export function generateDailyChallenge(date: string): DailyChallenge {
  const rng = createRng(seedFromString(`floored-daily-${date}`))

  const pool = GAMES.map((g) => g.name)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }

  const bankroll = DAILY_BANKROLLS[Math.floor(rng() * DAILY_BANKROLLS.length)]!
  const games = pool.slice(0, DAILY_GAME_COUNT).map((game) => ({
    game,
    bets: DAILY_MIN_BETS + Math.floor(rng() * (DAILY_MAX_BETS - DAILY_MIN_BETS + 1)),
  }))

  const share = DAILY_MIN_BET_SHARES[Math.floor(rng() * DAILY_MIN_BET_SHARES.length)]!
  const minBet = Math.max(5, Math.round((bankroll * share) / 5) * 5)

  return { date, number: dailyNumber(date), bankroll, minBet, games }
}

export function totalDailyBets(challenge: DailyChallenge): number {
  return challenge.games.reduce((sum, g) => sum + g.bets, 0)
}
