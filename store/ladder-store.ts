'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameName } from '@/store/types'
import {
  LADDER_LIVES,
  LADDER_RUNGS,
  START_POT,
  TOP_BONUS,
  isCheckpoint,
} from '@/lib/ladder/rules'

export interface ClearedRung {
  game: GameName
  /** Round multiplier the rung was cleared with. */
  multiplier: number
}

/** One entry per settled round, used for the share grid. */
export type LadderEvent = 'clear' | 'checkpoint' | 'fall'

/** `cashed` = player took the pot; `out` = last life lost; `topped` = cleared every rung. */
export type LadderEndReason = 'cashed' | 'out' | 'topped'

export interface LadderLastResult {
  kind: 'clear' | 'checkpoint' | 'fall' | 'push' | 'topped' | 'out'
  game: GameName
  multiplier: number
}

export interface LadderRecord {
  endedAt: string
  endReason: LadderEndReason
  finalPot: number
  peakRung: number
  falls: number
  log: LadderEvent[]
}

interface OpenRound {
  game: GameName
  staked: number
  returned: number
}

interface LadderStore {
  status: 'idle' | 'climbing' | 'over'
  /** Rungs cleared so far. */
  rung: number
  pot: number
  checkpointRung: number
  checkpointPot: number
  /** Game used on each cleared rung, bottom first — doubles as the set of used games. */
  cleared: ClearedRung[]
  /** Game picked for the rung being climbed. */
  currentGame: GameName | null
  openRound: OpenRound | null
  lives: number
  peakRung: number
  log: LadderEvent[]
  lastResult: LadderLastResult | null
  endReason: LadderEndReason | null
  finalPot: number
  /** Finished runs, newest first. */
  history: LadderRecord[]

  startRun: () => void
  pickGame: (game: GameName | null) => void
  placeBet: (game: GameName, amount: number) => void
  /** Credits a payout; `settle` closes the round: profit clears the rung, a loss falls, a push replays it. */
  resolve: (game: GameName, payout: number, settle: boolean) => void
  /** A round left mid-way (navigated away) counts as a fall. */
  abandonOpenRound: () => void
  cashOut: () => void
  /** Gives up the current run between rounds: nothing is banked or recorded, back to the start screen. */
  abandonRun: () => void
  dismissResult: () => void
}

const HISTORY_LIMIT = 50

function freshRun() {
  return {
    status: 'climbing' as const,
    rung: 0,
    pot: START_POT,
    checkpointRung: 0,
    checkpointPot: START_POT,
    cleared: [],
    currentGame: null,
    openRound: null,
    lives: LADDER_LIVES,
    peakRung: 0,
    log: [],
    lastResult: null,
    endReason: null,
    finalPot: 0,
  }
}

export const useLadderStore = create<LadderStore>()(
  persist(
    (set, get) => {
      function end(endReason: LadderEndReason, finalPot: number) {
        const s = get()
        const record: LadderRecord = {
          endedAt: new Date().toISOString(),
          endReason,
          finalPot,
          peakRung: s.peakRung,
          falls: LADDER_LIVES - s.lives,
          log: s.log,
        }
        set({
          status: 'over',
          endReason,
          finalPot,
          currentGame: null,
          openRound: null,
          history: [record, ...s.history].slice(0, HISTORY_LIMIT),
        })
      }

      function fall(game: GameName, multiplier: number) {
        const s = get()
        const lives = s.lives - 1
        // Back to the checkpoint: its pot is restored and the games used since then unlock.
        set({
          rung: s.checkpointRung,
          pot: s.checkpointPot,
          cleared: s.cleared.slice(0, s.checkpointRung),
          currentGame: null,
          openRound: null,
          lives,
          log: [...s.log, 'fall'],
          lastResult: { kind: lives === 0 ? 'out' : 'fall', game, multiplier },
        })
        if (lives === 0) end('out', s.checkpointPot)
      }

      function settle(round: OpenRound) {
        const s = get()
        const multiplier = round.staked > 0 ? round.returned / round.staked : 0

        if (round.returned === round.staked) {
          set({ openRound: null, lastResult: { kind: 'push', game: round.game, multiplier } })
          return
        }
        // Any profit clears the rung; getting back less than the stake is a fall.
        if (round.returned < round.staked) return fall(round.game, multiplier)

        const rung = s.rung + 1
        const checkpoint = isCheckpoint(rung)
        const topped = rung === LADDER_RUNGS
        set({
          rung,
          peakRung: Math.max(s.peakRung, rung),
          cleared: [...s.cleared, { game: round.game, multiplier }],
          currentGame: null,
          openRound: null,
          checkpointRung: checkpoint ? rung : s.checkpointRung,
          checkpointPot: checkpoint ? s.pot : s.checkpointPot,
          log: [...s.log, checkpoint ? 'checkpoint' : 'clear'],
          lastResult: {
            kind: topped ? 'topped' : checkpoint ? 'checkpoint' : 'clear',
            game: round.game,
            multiplier,
          },
        })
        if (topped) end('topped', s.pot * TOP_BONUS)
      }

      return {
        ...freshRun(),
        status: 'idle',
        history: [],

        startRun: () => set({ ...freshRun() }),

        pickGame: (game) => {
          const s = get()
          if (s.status !== 'climbing' || s.openRound) return
          if (game && s.cleared.some((c) => c.game === game)) return
          set({ currentGame: game, lastResult: null })
        },

        placeBet: (game, amount) => {
          const s = get()
          if (s.status !== 'climbing' || s.currentGame !== game) return
          const round = s.openRound ?? { game, staked: 0, returned: 0 }
          set({
            pot: s.pot - amount,
            openRound: { ...round, staked: round.staked + amount },
            // A new round replaces the last result (a push replays the rung in place).
            lastResult: null,
          })
        },

        resolve: (game, payout, doSettle) => {
          const s = get()
          if (!s.openRound || s.openRound.game !== game) return
          const round = { ...s.openRound, returned: s.openRound.returned + payout }
          set({ pot: s.pot + payout, openRound: round })
          if (doSettle) settle(round)
        },

        abandonOpenRound: () => {
          const s = get()
          if (!s.openRound) return
          fall(s.openRound.game, 0)
        },

        cashOut: () => {
          const s = get()
          if (s.status !== 'climbing' || s.openRound) return
          set({ lastResult: null })
          end('cashed', s.pot)
        },

        abandonRun: () => {
          const s = get()
          if (s.status !== 'climbing' || s.openRound) return
          set({ ...freshRun(), status: 'idle' })
        },

        dismissResult: () => set({ lastResult: null }),
      }
    },
    {
      name: 'floored-ladder',
      version: 0,
    },
  ),
)

// Keep open tabs in sync — otherwise a stale tab could overwrite a run in progress.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === useLadderStore.persist.getOptions().name) void useLadderStore.persist.rehydrate()
  })
}

/** Games that can't be picked: used on a cleared rung this run. */
export function usedGames(cleared: ClearedRung[]): Set<GameName> {
  return new Set(cleared.map((c) => c.game))
}
