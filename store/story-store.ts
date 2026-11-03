'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CITIES, CITY_BY_ID, type CityId } from '@/lib/story/cities'
import { ERRAND_BY_ID, ERRANDS, SCENES, SCENE_BY_ID } from '@/lib/story/content'
import { choose, holds, nextAfterLine, stepAt, type DialogueStep, type StoryContext } from '@/lib/story/dialogue'
import {
  BOSS_BUYIN_M, BOSS_PURSE_M, BOSS_REMATCH_NIGHTS, CAR_BELOW_M, COMPS_CAP_M, COMPS_RATE, ERRAND_PAY_M, HUSTLE_PAY_M,
  LODGING_M, MARKER_GARNISH, MARKER_M, MARKER_REPAY, MARKER_REPAY_STEP, MINIGAME_MAX_M, NIGHT_BETS, START_MONEY,
  TRAVEL_FARE_M, VENUE_MAX_M,
} from '@/lib/story/economy'
import { hustlesFor, type NightRound } from '@/lib/story/hustles'
import type { Effect, Errand, FactionId, MinigameId, SceneTrigger } from '@/lib/story/types'
import type { GameName } from './types'

/**
 * Story mode save: one per player (owner decision). Money is in dollars; the
 * rules work in multiples of the current city's minimum bet (lib/story/economy.ts).
 * The persisted shape is versioned from the start: bump STORY_SAVE_VERSION and
 * extend `migrate` for any change to it, and never rename a content id.
 */
export const STORY_SAVE_VERSION = 1

/** 0 dive, 1 main floor, 2 high-roller room. */
export type VenueTier = 0 | 1 | 2
export const VENUE_NAMES = ['The dive', 'The main floor', 'The high-roller room'] as const
/** Reputation each venue asks for. */
export const VENUE_REP: readonly [number, number, number] = [0, 1, 3]

export interface Tonight {
  venue: VenueTier
  bets: number
  /** A round in progress (its stake is already taken). */
  openRound: { game: GameName; bet: number; credited: number } | null
  rounds: NightRound[]
  startMoney: number
}

export interface NightSummary {
  night: number
  played: boolean
  comps: number
  hustles: { text: string; paid: number }[]
  lodging: number
  car: boolean
  /** Money change over the night, all in. */
  net: number
  bust: boolean
}

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
  /** Reputation 0–5: opens the main floor (1) and the high-roller room (3). */
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
  /** A boss table you sat down at (the buy-in is paid); leaving it loses. */
  bossTable: { seed: number } | null
  seenGames: GameName[]
  stats: { busts: number; bossTries: number; bossWins: number; markers: number; bestWin: number }
  tonight: Tonight | null
  lastNight: NightSummary | null
  /** Scenes waiting to play when the hub is next shown. */
  queue: string[]
  /** Short messages for the hub ("Errand done: +$30"), newest first. */
  news: { id: number; text: string }[]
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
  bossTable: null,
  seenGames: [],
  stats: { busts: 0, bossTries: 0, bossWins: 0, markers: 0, bestWin: 0 },
  tonight: null,
  lastNight: null,
  queue: [],
  news: [],
  scene: null,
})

const STATE_KEYS = Object.keys(fresh()) as (keyof StorySave)[]

interface StoryActions {
  /** Starts over (the page asks first). */
  newStory: () => void
  /** The current city's minimum bet in dollars. */
  minBet: () => number
  context: () => StoryContext

  // Scenes
  /** The first scene for a trigger in this city whose condition holds and that may still play. */
  sceneFor: (trigger: SceneTrigger) => string | null
  startScene: (id: string) => boolean
  /** Plays the next queued scene, if any. */
  playQueued: () => boolean
  currentStep: () => DialogueStep | null
  /** Past a line: on to the next node (or out of the scene at its end). */
  advance: () => void
  /** Takes a choice by its index in the node's own option list. */
  pick: (index: number) => void

  // Money
  /** Winnings and payouts; with `profit`, half of it repays a marker first. */
  receive: (dollars: number, opts?: { profit?: boolean }) => void
  spend: (dollars: number) => boolean
  takeMarker: () => boolean

  // Errands
  openErrands: () => Errand[]

  // Nights
  venueOpen: (venue: VenueTier) => boolean
  /** Starts a night at a venue (once per night). */
  startNight: (venue: VenueTier) => boolean
  /** The most one bet may be tonight: money, capped by the venue. */
  wagerCap: () => number
  betsLeft: () => number
  placeBet: (game: GameName, amount: number) => void
  /** A round's payout; `settle` false for partial payouts within one round (Plinko balls). */
  resolve: (game: GameName, payout: number, settle: boolean) => void
  /** Ends the night: comps, hustles, lodging (or the car), and a bust check. */
  endNight: () => NightSummary
  /** Pays a minigame by score (0–1); the first play each night pays. Returns the dollars paid. */
  playMinigame: (giver: string, minigame: MinigameId, score: number) => number
  minigamePaidTonight: (giver: string) => boolean
  dismissNews: (id: number) => void

  // Boss and travel
  bossAvailable: () => boolean
  /** Pays the buy-in and seats you; false if you can't. */
  enterBoss: () => boolean
  bossResult: (won: boolean) => void
  /** The fare to the next city, in dollars (null at the Summit). */
  fareToNext: () => number | null
  travelNext: () => boolean
}

export type StoryStore = StorySave & StoryActions

let newsId = 0

export const useStoryStore = create<StoryStore>()(
  persist(
    (set, get) => {
      const city = () => CITY_BY_ID.get(get().city)!
      const m = () => city().minBet
      const say = (text: string) => set((s) => ({ news: [{ id: Date.now() + newsId++, text }, ...s.news].slice(0, 6) }))
      const queue = (id: string | null) => {
        if (id && !get().queue.includes(id)) set((s) => ({ queue: [...s.queue, id] }))
      }

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
          else if ('marker' in e) get().takeMarker()
        }
      }

      const completeErrand = (e: Errand) => {
        if (get().errands[e.id] === 'done') return
        const pay = (e.pay ?? ERRAND_PAY_M) * m()
        set((s) => ({ errands: { ...s.errands, [e.id]: 'done' } }))
        get().receive(pay)
        say(`Errand done: ${e.title} · +$${pay.toLocaleString('en-US')}`)
      }

      /** After a settled round: streak and big-win errands. */
      const checkRoundErrands = (rounds: NightRound[]) => {
        const last = rounds[rounds.length - 1]
        if (!last) return
        for (const e of get().openErrands()) {
          if (e.goal.kind === 'big-win' && last.bet > 0 && last.payout >= e.goal.mult * last.bet) completeErrand(e)
          if (e.goal.kind === 'streak') {
            const goal = e.goal
            const same = rounds.filter((r) => r.game === goal.game)
            const tail = same.slice(-goal.wins)
            if (tail.length === goal.wins && tail.every((r) => r.payout > r.bet)) completeErrand(e)
          }
        }
      }

      return {
        ...fresh(),

        newStory: () => {
          set({ ...fresh(), started: true, startedAt: new Date().toISOString(), visited: [STARTING_CITY] })
          queue(get().sceneFor({ on: 'arrival' }))
          queue(get().sceneFor({ on: 'tutorial' }))
        },
        minBet: m,
        context: () => {
          const s = get()
          return { flags: s.flags, factions: s.factions, moneyM: s.money / m() }
        },

        sceneFor: (trigger) => {
          const s = get()
          const ctx = get().context()
          const found = SCENES.find(
            (sc) =>
              sc.city === s.city &&
              sc.trigger.on === trigger.on &&
              (trigger.on !== 'talk' || (sc.trigger.on === 'talk' && sc.trigger.character === trigger.character)) &&
              (sc.once === false || !s.seen.includes(sc.id)) &&
              holds(sc.if, ctx),
          )
          return found?.id ?? null
        },
        startScene: (id) => {
          const scene = SCENE_BY_ID.get(id)
          const s = get()
          if (!scene || s.scene) return false
          if (scene.once !== false && s.seen.includes(id)) return false
          set({ scene: { id, node: scene.start } })
          return true
        },
        playQueued: () => {
          const s = get()
          if (s.scene || !s.queue.length) return false
          const [id, ...rest] = s.queue
          set({ queue: rest })
          return get().startScene(id!)
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
            // The next queued scene follows (arrival, then Jo's walkthrough).
            get().playQueued()
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
          say(`The Notary lends $${lent.toLocaleString('en-US')} · you owe $${repay.toLocaleString('en-US')}`)
          return true
        },

        openErrands: () => {
          const s = get()
          const ctx = get().context()
          return ERRANDS.filter((e) => e.city === s.city && s.errands[e.id] !== 'done' && (s.errands[e.id] === 'started' || holds(e.opens, ctx)))
        },

        venueOpen: (venue) => get().rep >= VENUE_REP[venue],
        startNight: (venue) => {
          const s = get()
          if (s.tonight || !get().venueOpen(venue) || s.money < m()) return false
          set({ tonight: { venue, bets: 0, openRound: null, rounds: [], startMoney: s.money } })
          return true
        },
        wagerCap: () => {
          const s = get()
          if (!s.tonight) return 0
          const max = VENUE_MAX_M[s.tonight.venue]
          if (s.tonight.openRound) return s.money + s.tonight.openRound.bet
          if (s.tonight.bets >= NIGHT_BETS) return 0
          return max == null ? s.money : Math.min(s.money, max * m())
        },
        betsLeft: () => {
          const t = get().tonight
          return t ? Math.max(0, NIGHT_BETS - t.bets) : 0
        },
        placeBet: (game, amount) => {
          const s = get()
          const t = s.tonight
          if (!t) return
          const bet = Math.max(0, Math.min(Math.round(amount), s.money))
          // A second stake in the same round (a double, more chips) adds to it without a new bet.
          if (t.openRound && t.openRound.game === game) {
            set({ money: s.money - bet, tonight: { ...t, openRound: { ...t.openRound, bet: t.openRound.bet + bet } } })
            return
          }
          set({
            money: s.money - bet,
            seenGames: s.seenGames.includes(game) ? s.seenGames : [...s.seenGames, game],
            tonight: { ...t, bets: t.bets + 1, openRound: { game, bet, credited: 0 } },
          })
        },
        resolve: (game, payout, settle) => {
          const s = get()
          const t = s.tonight
          const open = t?.openRound
          if (!t || !open || open.game !== game) return
          const credit = Math.max(0, Math.round(payout))
          const totalPaid = open.credited + credit
          // Half of a win's profit repays a marker; the stake itself never does.
          const profitPart = Math.max(0, Math.min(credit, totalPaid - open.bet) - Math.max(0, open.credited - open.bet))
          get().receive(credit - profitPart)
          get().receive(profitPart, { profit: true })
          if (!settle) {
            set((x) => ({ tonight: x.tonight && { ...x.tonight, openRound: { ...open, credited: totalPaid } } }))
            return
          }
          const rounds = [...t.rounds, { game, bet: open.bet, payout: totalPaid }]
          set((x) => ({
            tonight: x.tonight && { ...x.tonight, openRound: null, rounds },
            stats: { ...x.stats, bestWin: Math.max(x.stats.bestWin, totalPaid - open.bet) },
          }))
          checkRoundErrands(rounds)
        },
        endNight: () => {
          const s = get()
          const t = s.tonight
          const before = t ? t.startMoney : s.money
          let comps = 0
          const hustles: NightSummary['hustles'] = []
          if (t && t.rounds.length) {
            const turnover = t.rounds.reduce((sum, r) => sum + r.bet, 0)
            comps = Math.round(Math.min(COMPS_RATE[t.venue] * turnover, COMPS_CAP_M[t.venue] * m()))
            get().receive(comps)
            for (const h of hustlesFor(s.city, s.night)) {
              const paid = h.met(t.rounds) ? HUSTLE_PAY_M * m() : 0
              if (paid) get().receive(paid)
              hustles.push({ text: h.text, paid })
            }
            if (t.rounds.reduce((sum, r) => sum + r.payout - r.bet, 0) > 0) {
              for (const e of get().openErrands()) if (e.goal.kind === 'night-up') completeErrand(e)
            }
          }
          const after = get()
          const car = after.money < CAR_BELOW_M * m()
          const lodging = car ? 0 : Math.min(after.money, LODGING_M * m())
          const money = after.money - lodging
          const bust = money < m()
          const summary: NightSummary = { night: after.night + 1, played: !!t, comps, hustles, lodging, car, net: money - before, bust }
          set({
            money,
            night: after.night + 1,
            cityNight: after.cityNight + 1,
            bossBackOn: after.bossBackOn != null && after.night + 1 >= after.bossBackOn ? null : after.bossBackOn,
            tonight: null,
            lastNight: summary,
            ...(bust ? { rep: Math.max(0, after.rep - 1), stats: { ...after.stats, busts: after.stats.busts + 1 } } : {}),
          })
          if (bust) queue(get().sceneFor({ on: 'bust' }))
          return summary
        },
        playMinigame: (giver, minigame, score) => {
          const s = get()
          let pay = 0
          if (s.minigameNight[giver] !== s.night) {
            pay = Math.round(Math.max(0, Math.min(1, score)) * MINIGAME_MAX_M * m())
            set({ minigameNight: { ...s.minigameNight, [giver]: s.night } })
            get().receive(pay)
          }
          for (const e of get().openErrands()) if (e.goal.kind === 'minigame' && e.goal.minigame === minigame && score >= e.goal.score) completeErrand(e)
          return pay
        },
        minigamePaidTonight: (giver) => get().minigameNight[giver] === get().night,
        dismissNews: (id) => set((s) => ({ news: s.news.filter((n) => n.id !== id) })),

        bossAvailable: () => {
          const s = get()
          return !s.cleared.includes(s.city) && s.bossBackOn == null && !s.tonight
        },
        enterBoss: () => {
          const s = get()
          if (!get().bossAvailable() || s.bossTable || !get().spend(BOSS_BUYIN_M * m())) return false
          set({ bossTable: { seed: Math.floor(Math.random() * 2 ** 31) }, stats: { ...s.stats, bossTries: s.stats.bossTries + 1 } })
          return true
        },
        bossResult: (won) => {
          const s = get()
          if (!s.bossTable) return
          if (won) {
            set({ bossTable: null, cleared: [...s.cleared, s.city], rep: Math.min(5, s.rep + 1), stats: { ...s.stats, bossWins: s.stats.bossWins + 1 }, flags: { ...s.flags, [`${s.city}-cleared`]: true } })
            get().receive(BOSS_PURSE_M * m(), { profit: true })
            queue(get().sceneFor({ on: 'boss-win' }))
          } else {
            set({ bossTable: null, bossBackOn: s.night + BOSS_REMATCH_NIGHTS })
            queue(get().sceneFor({ on: 'boss-loss' }))
          }
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
          if (!next || fare == null || s.tonight || !s.cleared.includes(s.city) || !get().spend(fare)) return false
          set({ city: next.id, visited: s.visited.includes(next.id) ? s.visited : [...s.visited, next.id], cityNight: 0, markersHere: 0, bossBackOn: null, lastNight: null })
          queue(get().sceneFor({ on: 'arrival' }))
          return true
        },
      }
    },
    {
      name: 'floored-story',
      version: STORY_SAVE_VERSION,
      // Only the save itself is persisted (and synced), never the functions.
      partialize: (s) => {
        const out: Partial<StorySave> = {}
        for (const key of STATE_KEYS) (out as Record<string, unknown>)[key] = s[key]
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

export { MINIGAME_MAX_M, NIGHT_BETS, BOSS_BUYIN_M }
