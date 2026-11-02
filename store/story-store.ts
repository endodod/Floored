'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CITIES, CITY_BY_ID, type CityId } from '@/lib/story/cities'
import { SCENE_BY_ID } from '@/lib/story/content'
import { choose, nextAfterLine, stepAt, type DialogueStep, type StoryContext } from '@/lib/story/dialogue'
import {
  BOSS_BUYIN_M, BOSS_PURSE_M, BOSS_REMATCH_NIGHTS, CAR_BELOW_M, ERRAND_PAY_M, LODGING_M, MARKER_GARNISH, MARKER_M,
  MARKER_REPAY, MARKER_REPAY_STEP, MINIGAME_MAX_M, START_MONEY, TRAVEL_FARE_M,
} from '@/lib/story/economy'
import type { Effect, FactionId } from '@/lib/story/types'
import { ERRAND_BY_ID } from '@/lib/story/content'
import type { GameName } from './types'

/**
 * Story mode save: one per player (owner decision). Money is in dollars; the
 * rules work in multiples of the current city's minimum bet (lib/story/economy.ts).
 * The persisted shape is versioned from the start: bump STORY_SAVE_VERSION and
 * extend `migrate` for any change to it, and never rename a content id.
 */
export const STORY_SAVE_VERSION = 1

export interface StorySave {
  started: boolean
  startedAt: string | null
  city: CityId
  /** Cities reached, in order. */
  visited: CityId[]
  /** Cities whose boss you beat. */
  cleared: CityId[]
  /** Nights since the story began, and since arriving in this city. */
  night: number
  cityNight: number
  money: number
  /** The Notary's marker: dollars still owed (repaid from half of every win's profit). */
  owed: number
  /** Markers taken in this city (each costs more to repay). */
  markersHere: number
  /** Reputation tier 0–5: opens the high-roller room and the better hustles. */
  rep: number
  factions: Record<FactionId, number>
  flags: Record<string, true>
  /** Scenes that played (for once-only scenes). */
  seen: string[]
  errands: Record<string, 'started' | 'done'>
  /** Minigame giver → the night their minigame last paid. */
  minigameNight: Record<string, number>
  /** The night the rival is back after a boss loss (null: they're here). */
  bossBackOn: number | null
  seenGames: GameName[]
  stats: { busts: number; bossTries: number; bossWins: number; markers: number }
  /** A scene in progress. */
  scene: { id: string; node: string } | null
}

const STARTING_CITY: CityId = 'dustwater'

const fresh = (): StorySave => ({
  started: false,
  startedAt: null,
  city: STARTING_CITY,
  visited: [],
  cleared: [],
  night: 0,
  cityNight: 0,
  money: START_MONEY,
  owed: 0,
  markersHere: 0,
  rep: 1,
  factions: { syndicate: 0, 'old-guard': 0, underground: 0 },
  flags: {},
  seen: [],
  errands: {},
  minigameNight: {},
  bossBackOn: null,
  seenGames: [],
  stats: { busts: 0, bossTries: 0, bossWins: 0, markers: 0 },
  scene: null,
})

interface StoryActions {
  /** Starts over (the page asks first). */
  newStory: () => void
  /** The current city's minimum bet in dollars. */
  minBet: () => number
  context: () => StoryContext

  // Scenes
  startScene: (id: string) => boolean
  /** The step to show, or null when no scene plays. */
  currentStep: () => DialogueStep | null
  /** Past a line: on to the next node. */
  advance: () => void
  /** Takes a choice by its index in the node's own option list. */
  pick: (index: number) => void

  // Money
  /** Winnings and payouts: half of the profit repays a marker first. */
  receive: (dollars: number, opts?: { profit?: boolean }) => void
  spend: (dollars: number) => boolean
  takeMarker: () => boolean

  // Nights
  /** Ends the night (after playing, or resting): lodging, or the car below 10m. */
  endNight: () => void
  /** Pays a minigame by score (0–1); once per giver per night. Returns the dollars paid. */
  payMinigame: (giver: string, score: number) => number
  completeErrand: (id: string) => number

  // Boss and travel
  bossAvailable: () => boolean
  /** Pays the buy-in; false if you can't. */
  enterBoss: () => boolean
  bossResult: (won: boolean) => void
  /** The fare to the next city, in dollars (null at the Summit). */
  fareToNext: () => number | null
  travelNext: () => boolean
  noteGame: (game: GameName) => void
}

export type StoryStore = StorySave & StoryActions

export const useStoryStore = create<StoryStore>()(
  persist(
    (set, get) => {
      const city = () => CITY_BY_ID.get(get().city)!
      const m = () => city().minBet

      const apply = (effects: Effect[]) => {
        for (const e of effects) {
          const s = get()
          if ('set' in e) set({ flags: { ...s.flags, [e.set]: true } })
          else if ('clear' in e) {
            const flags = { ...s.flags }
            delete flags[e.clear]
            set({ flags })
          } else if ('faction' in e) set({ factions: { ...s.factions, [e.faction]: (s.factions[e.faction] ?? 0) + e.delta } })
          else if ('money' in e) {
            if (e.money >= 0) get().receive(e.money * m())
            else set({ money: Math.max(0, s.money + e.money * m()) })
          } else if ('rep' in e) set({ rep: Math.max(0, Math.min(5, s.rep + e.rep)) })
          else if ('errand' in e) set({ errands: { ...s.errands, [e.errand]: e.step === 'start' ? 'started' : 'done' } })
        }
      }

      return {
        ...fresh(),

        newStory: () => set({ ...fresh(), started: true, startedAt: new Date().toISOString(), visited: [STARTING_CITY] }),
        minBet: m,
        context: () => {
          const s = get()
          return { flags: s.flags, factions: s.factions, moneyM: s.money / m() }
        },

        startScene: (id) => {
          const scene = SCENE_BY_ID.get(id)
          const s = get()
          if (!scene || s.scene) return false
          if (scene.once !== false && s.seen.includes(id)) return false
          set({ scene: { id, node: scene.start } })
          return true
        },
        currentStep: () => {
          const cur = get().scene
          if (!cur) return null
          const scene = SCENE_BY_ID.get(cur.id)
          return scene ? stepAt(scene, cur.node, get().context()) : null
        },
        advance: () => {
          const cur = get().scene
          const scene = cur && SCENE_BY_ID.get(cur.id)
          if (!cur || !scene) return
          const node = scene.nodes[cur.node]
          if (node?.kind === 'line') set({ scene: { ...cur, node: nextAfterLine(scene, cur.node) } })
          else if (node?.kind === 'end') {
            apply(node.effects ?? [])
            const s = get()
            set({ scene: null, seen: s.seen.includes(cur.id) ? s.seen : [...s.seen, cur.id] })
          }
        },
        pick: (index) => {
          const cur = get().scene
          const scene = cur && SCENE_BY_ID.get(cur.id)
          if (!cur || !scene) return
          const { next, effects } = choose(scene, cur.node, index, get().context())
          apply(effects)
          set({ scene: { ...cur, node: next } })
        },

        receive: (dollars, opts) => {
          const s = get()
          const amount = Math.max(0, Math.round(dollars))
          // Half of a win's profit repays a marker first.
          const toMarker = opts?.profit && s.owed > 0 ? Math.min(s.owed, Math.floor(amount * MARKER_GARNISH)) : 0
          set({ money: s.money + amount - toMarker, owed: s.owed - toMarker })
        },
        spend: (dollars) => {
          const s = get()
          const amount = Math.round(dollars)
          if (amount < 0 || amount > s.money) return false
          set({ money: s.money - amount })
          return true
        },
        takeMarker: () => {
          const s = get()
          if (s.money >= m()) return false
          const lent = MARKER_M * m()
          const repay = Math.round(lent * (MARKER_REPAY + MARKER_REPAY_STEP * s.markersHere))
          set({ money: s.money + lent, owed: s.owed + repay, markersHere: s.markersHere + 1, stats: { ...s.stats, markers: s.stats.markers + 1 } })
          return true
        },

        endNight: () => {
          const s = get()
          const lodging = s.money >= CAR_BELOW_M * m() ? Math.min(s.money, LODGING_M * m()) : 0
          set({ money: s.money - lodging, night: s.night + 1, cityNight: s.cityNight + 1, bossBackOn: s.bossBackOn != null && s.night + 1 >= s.bossBackOn ? null : s.bossBackOn })
        },
        payMinigame: (giver, score) => {
          const s = get()
          if (s.minigameNight[giver] === s.night) return 0
          const pay = Math.round(Math.max(0, Math.min(1, score)) * MINIGAME_MAX_M * m())
          set({ minigameNight: { ...s.minigameNight, [giver]: s.night } })
          get().receive(pay)
          return pay
        },
        completeErrand: (id) => {
          const s = get()
          const errand = ERRAND_BY_ID.get(id)
          if (!errand || s.errands[id] === 'done') return 0
          const pay = (errand.pay ?? ERRAND_PAY_M) * m()
          set({ errands: { ...s.errands, [id]: 'done' } })
          get().receive(pay)
          return pay
        },

        bossAvailable: () => {
          const s = get()
          return !s.cleared.includes(s.city) && s.bossBackOn == null
        },
        enterBoss: () => {
          const s = get()
          if (!get().bossAvailable() || !get().spend(BOSS_BUYIN_M * m())) return false
          set({ stats: { ...s.stats, bossTries: s.stats.bossTries + 1 } })
          return true
        },
        bossResult: (won) => {
          const s = get()
          if (won) {
            set({ cleared: [...s.cleared, s.city], stats: { ...s.stats, bossWins: s.stats.bossWins + 1 } })
            get().receive(BOSS_PURSE_M * m(), { profit: true })
          } else set({ bossBackOn: s.night + BOSS_REMATCH_NIGHTS })
        },
        fareToNext: () => {
          const i = CITIES.findIndex((c) => c.id === get().city)
          const next = CITIES[i + 1]
          return next ? TRAVEL_FARE_M * next.minBet : null
        },
        travelNext: () => {
          const s = get()
          const i = CITIES.findIndex((c) => c.id === s.city)
          const next = CITIES[i + 1]
          const fare = get().fareToNext()
          if (!next || fare == null || !s.cleared.includes(s.city) || !get().spend(fare)) return false
          set({ city: next.id, visited: s.visited.includes(next.id) ? s.visited : [...s.visited, next.id], cityNight: 0, markersHere: 0, bossBackOn: null })
          return true
        },
        noteGame: (game) => {
          const s = get()
          if (!s.seenGames.includes(game)) set({ seenGames: [...s.seenGames, game] })
        },
      }
    },
    {
      name: 'floored-story',
      version: STORY_SAVE_VERSION,
      // Only the save itself is persisted (and synced), never the functions.
      partialize: (s) => {
        const out: Partial<StorySave> = {}
        for (const key of Object.keys(fresh()) as (keyof StorySave)[]) (out as Record<string, unknown>)[key] = s[key]
        return out as StorySave
      },
      migrate: (persisted, version) => {
        // Version 1 is the first shape; later versions extend this, filling new fields from fresh().
        if (!persisted || typeof persisted !== 'object' || version > STORY_SAVE_VERSION) return fresh()
        return { ...fresh(), ...(persisted as Partial<StorySave>) }
      },
      merge: (persisted, current) => ({ ...current, ...fresh(), ...(persisted as Partial<StorySave>) }),
    },
  ),
)
