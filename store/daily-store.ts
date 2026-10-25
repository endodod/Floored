'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameName } from '@/store/types'
import { dailyDateKey, generateDailyChallenge } from '@/lib/daily/challenge'

export interface DailyGameProgress {
  /** Bets placed on this game today. */
  betsUsed: number
  /** Total chips wagered on this game. */
  wagered: number
  /** Total chips returned by this game. */
  returned: number
}

export type DailyEndReason = 'complete' | 'bust' | 'cashout'

export interface DailyRecord {
  date: string
  number: number
  startBankroll: number
  endBankroll: number
  endReason: DailyEndReason
  /** Net result per game, in challenge order. `null` = never played. */
  gameNets: { game: GameName; net: number | null }[]
}

interface DailyStore {
  /** UTC date key the in-progress state below belongs to. */
  date: string | null
  bankroll: number
  progress: Partial<Record<GameName, DailyGameProgress>>
  /** Game with a bet placed but not yet settled. */
  openRound: GameName | null
  finished: boolean
  endReason: DailyEndReason | null
  /** Completed dailies keyed by date. */
  history: Record<string, DailyRecord>

  /** Reset in-progress state when the UTC day has rolled over. */
  syncToday: () => void
  /** A round left mid-way (navigated away) is forfeited: its stake is gone, its bet stays used. */
  abandonOpenRound: () => void
  placeBet: (game: GameName, amount: number) => void
  /** Credits a payout; `settle` closes the round and may end the day. */
  resolve: (game: GameName, payout: number, settle: boolean) => void
  cashOut: () => void
}

function emptyDay(date: string) {
  return {
    date,
    bankroll: generateDailyChallenge(date).bankroll,
    progress: {},
    openRound: null,
    finished: false,
    endReason: null,
  }
}

function buildRecord(
  date: string,
  bankroll: number,
  progress: DailyStore['progress'],
  endReason: DailyEndReason,
): DailyRecord {
  const challenge = generateDailyChallenge(date)
  return {
    date,
    number: challenge.number,
    startBankroll: challenge.bankroll,
    endBankroll: bankroll,
    endReason,
    gameNets: challenge.games.map(({ game }) => {
      const p = progress[game]
      return { game, net: p && p.betsUsed > 0 ? p.returned - p.wagered : null }
    }),
  }
}

export const useDailyStore = create<DailyStore>()(
  persist(
    (set, get) => ({
      date: null,
      bankroll: 0,
      progress: {},
      openRound: null,
      finished: false,
      endReason: null,
      history: {},

      syncToday: () => {
        const today = dailyDateKey()
        if (get().date === today) return
        set(emptyDay(today))
      },

      abandonOpenRound: () => {
        const s = get()
        if (!s.openRound) return
        set({ openRound: null })
        maybeFinish()
      },

      placeBet: (game, amount) => {
        const s = get()
        if (s.finished) return
        const prev = s.progress[game] ?? { betsUsed: 0, wagered: 0, returned: 0 }
        // Extra stakes inside an open round (double, split) don't use up another bet.
        const newRound = s.openRound !== game
        set({
          bankroll: s.bankroll - amount,
          openRound: game,
          progress: {
            ...s.progress,
            [game]: {
              betsUsed: prev.betsUsed + (newRound ? 1 : 0),
              wagered: prev.wagered + amount,
              returned: prev.returned,
            },
          },
        })
      },

      resolve: (game, payout, settle) => {
        const s = get()
        const prev = s.progress[game] ?? { betsUsed: 0, wagered: 0, returned: 0 }
        set({
          bankroll: s.bankroll + payout,
          openRound: settle && s.openRound === game ? null : s.openRound,
          progress: { ...s.progress, [game]: { ...prev, returned: prev.returned + payout } },
        })
        if (settle) maybeFinish()
      },

      cashOut: () => {
        const s = get()
        if (s.finished || s.openRound || !s.date) return
        finish('cashout')
      },
    }),
    { name: 'floored-daily' },
  ),
)

function finish(endReason: DailyEndReason) {
  const s = useDailyStore.getState()
  if (!s.date) return
  useDailyStore.setState({
    finished: true,
    endReason,
    history: { ...s.history, [s.date]: buildRecord(s.date, s.bankroll, s.progress, endReason) },
  })
}

/** Ends the day once every bet is used or the bankroll can't cover a $1 bet. */
function maybeFinish() {
  const s = useDailyStore.getState()
  if (s.finished || s.openRound || !s.date) return
  if (s.bankroll < 1) return finish('bust')
  const challenge = generateDailyChallenge(s.date)
  const allUsed = challenge.games.every(({ game, bets }) => (s.progress[game]?.betsUsed ?? 0) >= bets)
  if (allUsed) finish('complete')
}

export function betsLeft(progress: DailyStore['progress'], game: GameName, bets: number): number {
  return Math.max(0, bets - (progress[game]?.betsUsed ?? 0))
}
