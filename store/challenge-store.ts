'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameName } from '@/store/types'
import {
  CHALLENGE_START_BANKROLL,
  challengeKey,
  type ChallengeDef,
  type ChallengeSource,
} from '@/lib/challenges/types'

export interface ChallengeGameProgress {
  betsUsed: number
  wagered: number
  returned: number
}

/** `complete` = every bet placed; `failed` = bankroll fell below the min bet; `gave-up` = ended by the player. */
export type ChallengeEndReason = 'complete' | 'failed' | 'gave-up'

/** The challenge being played right now. Only one at a time; starting another replaces it. */
export interface ChallengeAttempt {
  key: string
  source: ChallengeSource
  /** A copy of the challenge, so a community challenge plays the same even if it can't be fetched again. */
  def: ChallengeDef
  bankroll: number
  progress: Partial<Record<GameName, ChallengeGameProgress>>
  openRound: GameName | null
  finished: boolean
  endReason: ChallengeEndReason | null
  /** ISO date string. */
  startedAt: string
}

/** What the profile shows per challenge. */
export interface ChallengeStats {
  source: ChallengeSource
  id: string
  /** Name at the last attempt (community challenges have no local catalog). */
  name: string
  tries: number
  /** Highest bankroll at the end of a completed attempt (every bet placed). */
  best: number | null
  completions: number
  /** ISO date string of the last attempt. */
  lastPlayed: string
}

interface ChallengeStore {
  attempt: ChallengeAttempt | null
  stats: Record<string, ChallengeStats>

  /** Start a fresh attempt (counts as a try). Replaces any attempt in progress. */
  start: (source: ChallengeSource, def: ChallengeDef) => void
  /** End the attempt now. Counts as a try, not as a best. */
  giveUp: () => void
  /** Leave the result screen. */
  dismiss: () => void
  /** A round left mid-way (navigated away) is forfeited: its stake is gone, its bet stays used. */
  abandonOpenRound: () => void
  placeBet: (game: GameName, amount: number) => void
  resolve: (game: GameName, payout: number, settle: boolean) => void
}

/**
 * Community challenges keep shared figures on the server (tries, best result).
 * Fire-and-forget: one request when an attempt starts and one when it ends, so
 * the database isn't woken per bet. Failures are ignored; the local stats stay.
 */
function reportCommunity(id: string, body: { event: 'try' } | { event: 'result'; endReason: ChallengeEndReason; endBankroll: number }) {
  if (typeof window === 'undefined') return
  void fetch(`/api/community/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {})
}

export const useChallengeStore = create<ChallengeStore>()(
  persist(
    (set, get) => ({
      attempt: null,
      stats: {},

      start: (source, def) => {
        const key = challengeKey(source, def.id)
        const now = new Date().toISOString()
        const prev = get().stats[key]
        set({
          attempt: {
            key,
            source,
            def,
            bankroll: CHALLENGE_START_BANKROLL,
            progress: {},
            openRound: null,
            finished: false,
            endReason: null,
            startedAt: now,
          },
          stats: {
            ...get().stats,
            [key]: {
              source,
              id: def.id,
              name: def.name,
              tries: (prev?.tries ?? 0) + 1,
              best: prev?.best ?? null,
              completions: prev?.completions ?? 0,
              lastPlayed: now,
            },
          },
        })
        if (source === 'community') reportCommunity(def.id, { event: 'try' })
      },

      giveUp: () => {
        const a = get().attempt
        if (!a || a.finished) return
        set({ attempt: { ...a, openRound: null } })
        finish('gave-up')
      },

      dismiss: () => {
        const a = get().attempt
        if (a?.finished) set({ attempt: null })
      },

      abandonOpenRound: () => {
        const a = get().attempt
        if (!a?.openRound) return
        set({ attempt: { ...a, openRound: null } })
        maybeFinish()
      },

      placeBet: (game, amount) => {
        const a = get().attempt
        if (!a || a.finished) return
        const prev = a.progress[game] ?? { betsUsed: 0, wagered: 0, returned: 0 }
        // Extra stakes inside an open round (double, split) don't use up another bet.
        const newRound = a.openRound !== game
        set({
          attempt: {
            ...a,
            bankroll: a.bankroll - amount,
            openRound: game,
            progress: {
              ...a.progress,
              [game]: {
                betsUsed: prev.betsUsed + (newRound ? 1 : 0),
                wagered: prev.wagered + amount,
                returned: prev.returned,
              },
            },
          },
        })
      },

      resolve: (game, payout, settle) => {
        const a = get().attempt
        if (!a) return
        const prev = a.progress[game] ?? { betsUsed: 0, wagered: 0, returned: 0 }
        set({
          attempt: {
            ...a,
            bankroll: a.bankroll + payout,
            openRound: settle && a.openRound === game ? null : a.openRound,
            progress: { ...a.progress, [game]: { ...prev, returned: prev.returned + payout } },
          },
        })
        if (settle) maybeFinish()
      },
    }),
    { name: 'floored-challenges', version: 1 },
  ),
)

// Keep open tabs in sync — otherwise a second tab's stale state could overwrite a finished attempt.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === useChallengeStore.persist.getOptions().name) void useChallengeStore.persist.rehydrate()
  })
}

function finish(endReason: ChallengeEndReason) {
  const { attempt: a, stats } = useChallengeStore.getState()
  if (!a || a.finished) return
  const prev = stats[a.key]
  const complete = endReason === 'complete'
  useChallengeStore.setState({
    attempt: { ...a, finished: true, endReason },
    stats: prev
      ? {
          ...stats,
          [a.key]: {
            ...prev,
            best: complete ? Math.max(prev.best ?? 0, a.bankroll) : prev.best,
            completions: prev.completions + (complete ? 1 : 0),
          },
        }
      : stats,
  })
  if (a.source === 'community') reportCommunity(a.def.id, { event: 'result', endReason, endBankroll: a.bankroll })
}

/** Fails the attempt once the bankroll can't cover the min bet; completes it once every bet is placed. */
function maybeFinish() {
  const a = useChallengeStore.getState().attempt
  if (!a || a.finished || a.openRound) return
  const allUsed = a.def.games.every(({ game, bets }) => (a.progress[game]?.betsUsed ?? 0) >= bets)
  if (allUsed) return finish('complete')
  if (a.bankroll < a.def.minBet) finish('failed')
}

export function challengeBetsLeft(attempt: ChallengeAttempt, game: GameName): number {
  const bets = attempt.def.games.find((g) => g.game === game)?.bets ?? 0
  return Math.max(0, bets - (attempt.progress[game]?.betsUsed ?? 0))
}
