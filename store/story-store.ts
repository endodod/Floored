'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CITIES, CITY_BY_ID, REMOVED_CITIES, type CityId } from '@/lib/story/cities'
import { SCENES, SCENE_BY_ID, WRITTEN_JOBS } from '@/lib/story/content'
import { choose, holds, nextAfterLine, stepAt, type DialogueStep, type StoryContext } from '@/lib/story/dialogue'
import {
  BOSS_BUYIN_M, BOSS_PURSE_M, BOSS_REMATCH_NIGHTS, COMPS_CAP_M, COMPS_RATE, HUSTLE_PAY_M, JOB_OFFER_NIGHTS, JOB_STANDING,
  DEBT_WARN_M, MARKER_GARNISH, MARKER_M, MARKER_REPAY, MARKER_REPAY_STEP, MARKER_STANDING, MEAL_BETS, MEAL_M, NIGHT_BETS, SLEEP_BETS, SLEEP_REP, STANDING_MAX, START_BETS, START_MONEY, sleepCostM, type SleepPlace,
  VENUE_MAX_M, VENUE_REP, standingBonus, STANDING_BONUS,
} from '@/lib/story/economy'
import { hustlesFor, type NightRound } from '@/lib/story/hustles'
import { goalKey, kindOf, makeOffers, NIGHT_KINDS, type Job, type JobKind } from '@/lib/story/jobs'
import { CHARACTERS } from '@/lib/story/content/characters'
import type { Effect, FactionId, MinigameId, Scene, SceneTrigger } from '@/lib/story/types'
import type { GameName } from './types'

/**
 * Story mode save: one per player (owner decision). Money is in dollars; the
 * rules work in multiples of the current city's minimum bet (lib/story/economy.ts).
 * The persisted shape is versioned from the start: bump STORY_SAVE_VERSION and
 * extend `migrate` for any change to it, and never rename a content id.
 *
 * Version 2: `rep` (one figure for the whole circuit) became `standing`, a map
 * of city id to standing, so every town judges you on its own jobs.
 * Version 3: every errand earns standing (minigame jobs gave none before); a save
 * that already finished a minigame errand gets that standing in its town.
 * Version 4: errands come out night by night and most are handed over in a scene
 * (they opened on a flag before); a job a save already had open stays open, and
 * the scene that now hands it over counts as played.
 * Version 5: `jobs`, the spawned jobs (lib/story/jobs.ts); older saves start with none.
 * Version 6: one job system (lib/story/jobs.ts): `errands` is gone, `jobs` holds every
 * offered and taken job, `jobsGiven` the tasks each town has handed out and
 * `jobOffered` the night of each town's last offer (version 7 replaces it). Open errands and old jobs are
 * dropped; finished written jobs count as given, so they never come back.
 * Version 7: two offers a night (a minigame job and a table job): `jobOffered`
 * became `jobNight`, the kinds each town has offered on its last offer night.
 * Minigames are only played as jobs, so `minigameNight` (their nightly pay) is gone.
 * Version 8: you choose where to sleep (the car or a room); `nextBets` is the next
 * night's bets (8 after the car, 12 after a room) and `tonight.limit` tonight's.
 * Older saves get 12 for their next night (they slept under the old rules).
 * Version 9: 5 bets after the car, 10 after a room; a save's next night is capped at 10.
 * Version 10: seven cities (five cut). A save in a cut city moves to the next city that's
 * left (`REMOVED_CITIES`), starting there fresh; cut cities drop out of `visited`,
 * `cleared`, standing and jobs. Nothing a save earned in Dustwater moves.
 */
export const STORY_SAVE_VERSION = 10

/** 0 dive, 1 main floor, 2 high-roller room. */
export type VenueTier = 0 | 1 | 2
export const VENUE_NAMES = ['The dive', 'The main floor', 'The high-roller room'] as const

/** Standing after a change, clamped to 0..STANDING_MAX, in one town only. */
function shiftStanding(all: StorySave['standing'], city: CityId, delta: number): StorySave['standing'] {
  return { ...all, [city]: Math.max(0, Math.min(STANDING_MAX, (all[city] ?? 0) + delta)) }
}

export interface Tonight {
  venue: VenueTier
  bets: number
  /** A round in progress (its stake is already taken). */
  openRound: { game: GameName; bet: number; credited: number } | null
  rounds: NightRound[]
  startMoney: number
  /** Bets this night has (from where you slept); NIGHT_BETS when missing (saves from before version 8). */
  limit?: number
}

export interface NightSummary {
  night: number
  played: boolean
  comps: number
  /** The standing bonus on a night up at the tables, and its rate (STANDING_BONUS). */
  bonus: number
  bonusRate: number
  hustles: { text: string; paid: number }[]
  /** What sleeping cost, and where. */
  lodging: number
  car: boolean
  /** Bets the next night has (5 after the car, 10 after a room). */
  nextBets: number
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
  /** Loans from the town's lender: dollars still owed (repaid from half of every win's profit). */
  owed: number
  /** Markers taken in this city (each costs more to repay). */
  markersHere: number
  /** Standing in each town (0–5): opens the main floor (1) and the high-roller room (3); 2, 4 and 5 raise the night bonus. */
  standing: Partial<Record<CityId, number>>
  factions: Record<FactionId, number>
  flags: Record<string, true>
  /** Scenes that played (for once-only scenes). */
  seen: string[]
  /** Every job offered or taken and not yet finished, in every town (lib/story/jobs.ts). */
  jobs: Job[]
  /** The task keys (`goalKey`) each town has handed out: it never gives one twice. */
  jobsGiven: Partial<Record<CityId, string[]>>
  /** Each town's last offer night and the kinds offered on it (one minigame and one table job a night). */
  jobNight: Partial<Record<CityId, { night: number; kinds: JobKind[] }>>
  /** The night the rival is back after a boss loss (null: they're here). */
  bossBackOn: number | null
  /** A boss table you sat down at (the buy-in is paid); leaving it loses. */
  bossTable: { seed: number } | null
  seenGames: GameName[]
  stats: { busts: number; bossTries: number; bossWins: number; markers: number; bestWin: number }
  tonight: Tonight | null
  /** Bets the next night will have, set by where you slept (START_BETS on a new story). */
  nextBets: number
  /** The night you last ate at the diner (MEAL_BETS more that night). */
  mealNight: number | null
  /** You've seen the deep-debt warning (shown again once you drop under it and go back over). */
  debtWarned: boolean
  lastNight: NightSummary | null
  /** Scenes waiting to play when the hub is next shown. */
  queue: string[]
  /** Short messages for the hub ("Job done: +$30"), newest first. */
  news: { id: number; text: string }[]
  /** A scene in progress. */
  scene: { id: string; node: string } | null
}

const STARTING_CITY: CityId = 'dustwater'

/** Scene ids for job offers: `offer:<job id>`, built from the save (never in content or `seen`). */
const OFFER_PREFIX = 'offer:'

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
  standing: {},
  factions: { syndicate: 0, 'old-guard': 0, underground: 0 },
  flags: {},
  seen: [],
  jobs: [],
  jobsGiven: {},
  jobNight: {},
  bossBackOn: null,
  bossTable: null,
  seenGames: [],
  stats: { busts: 0, bossTries: 0, bossWins: 0, markers: 0, bestWin: 0 },
  tonight: null,
  nextBets: START_BETS,
  mealNight: null,
  debtWarned: false,
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
  /** Standing in the town you are in (0–STANDING_MAX); a new town starts at 0. */
  rep: () => number
  /** Games taken jobs name: the dive always deals them while the job is open. */
  openJobGames: () => GameName[]

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
  /** Borrows from the town's lender (any time); false where nobody lends. */
  takeMarker: () => boolean
  /** The town's lender, if it has one. */
  lenderHere: () => string | null
  /** Eats at the diner: MEAL_M for MEAL_BETS more bets tonight, once a night. */
  buyMeal: () => boolean
  ateTonight: () => boolean
  /** Owing this much brings the warning (DEBT_WARN_M minimum bets). */
  debtWarning: () => boolean
  dismissDebtWarning: () => void

  // Jobs
  /** Jobs you took in this town and haven't finished. */
  openJobs: () => Job[]
  /** The job a person in this town holds (offered or taken), if any. */
  jobAt: (character: string) => Job | null
  /** Whether talking to someone has something new: a scene, or a job to offer. */
  canTalk: (character: string) => boolean
  /** Talks to someone: their next scene, then their job offer (or the offer alone). */
  talkTo: (character: string) => boolean
  /** Drops a job you took: no pay, no standing, and its giver is free again. */
  dropJob: (id: string) => void
  /**
   * Tonight's offers in this town (a minigame job and a table job) still due, where
   * there is room; first, offers left alone for JOB_OFFER_NIGHTS leave (safe to call any time).
   */
  offerTonight: () => void

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
  /** What sleeping there costs tonight, in dollars. */
  sleepCost: (place: SleepPlace) => number
  /** Whether standing here lets you sleep there (SLEEP_REP); money is checked apart. */
  sleepOpen: (place: SleepPlace) => boolean
  /**
   * Ends the night (played or rested): comps, hustles, where you sleep (the car, or a
   * room you can afford; it sets the next night's bets), and a bust check.
   */
  endNight: (place?: SleepPlace) => NightSummary
  /** The minigame job you took from this person, if any: the only way to play their minigame. */
  minigameJobAt: (giver: string) => Job | null
  /**
   * The one attempt at a taken minigame job, with its score (0–1). At the target it pays
   * the job (no standing); short of it the job is lost. Returns the dollars paid; 0 and
   * nothing changes without such a job.
   */
  playMinigame: (giver: string, minigame: MinigameId, score: number) => number
  /** Pressing Start: the taken minigame job's one attempt is used from here on. */
  beginMinigame: (giver: string) => void
  /** Any started attempt that never finished (you left mid-game) is a miss: the job is lost. */
  forfeitStartedMinigames: () => void
  dismissNews: (id: number) => void

  // Boss and travel
  bossAvailable: () => boolean
  /** Pays the buy-in and seats you; false if you can't. */
  enterBoss: () => boolean
  bossResult: (won: boolean) => void
  travelNext: () => boolean
}

export type StoryStore = StorySave & StoryActions

let newsId = 0

/** Moves a persisted save from an older version onto this one (exported for `pnpm check:story`). */
export function migrateStorySave(persisted: unknown, version: number): StorySave {
  // Later versions extend this, filling new fields from fresh().
  if (!persisted || typeof persisted !== 'object' || version > STORY_SAVE_VERSION) return fresh()
  // Fields older versions had and this one drops.
  type Legacy = { rep?: number; errands?: Record<string, 'started' | 'done'>; jobOffered?: unknown; minigameNight?: unknown }
  const old = persisted as Partial<StorySave> & Legacy
  const base = { ...fresh(), ...old } as StorySave & Legacy
  const errands = { ...(base.errands ?? {}) }
  // Written jobs keep the ids the old errands had; every one earns JOB_STANDING.
  if (version < 2) {
    // Version 1 kept one reputation figure for the whole circuit. Standing is per
    // town: move it into the town the save is in, capped by what that town's
    // finished table jobs would have given. Nothing else in the save moves.
    const cityId = (base.city ?? STARTING_CITY) as CityId
    const earned = WRITTEN_JOBS.filter((e) => e.city === cityId && errands[e.id] === 'done').length * JOB_STANDING
    const moved = Math.max(0, Math.min(old.rep ?? 0, earned, STANDING_MAX))
    base.standing = { ...(old.standing ?? {}), [cityId]: moved }
    delete base.rep
  }
  if (version < 3) {
    // Minigame errands earned no standing before version 3; credit the ones already done.
    let standing = base.standing
    for (const e of WRITTEN_JOBS) {
      if (e.goal.kind === 'minigame' && errands[e.id] === 'done') standing = shiftStanding(standing, e.city, JOB_STANDING)
    }
    base.standing = standing
  }
  if (version < 6) {
    // One job system. Open errands and spawned jobs are dropped (the town offers
    // afresh); finished written jobs count as given, so they never come back.
    const given: StorySave['jobsGiven'] = {}
    for (const e of WRITTEN_JOBS) {
      if (errands[e.id] === 'done') given[e.city] = [...(given[e.city] ?? []), goalKey(e.goal)]
    }
    base.jobs = []
    base.jobsGiven = given
    delete base.errands
    // Scenes that only handed out errands are gone: never resume or queue one.
    if (base.scene && !SCENE_BY_ID.has(base.scene.id)) base.scene = null
    base.queue = (base.queue ?? []).filter((id) => SCENE_BY_ID.has(id))
  }
  if (version < 7) {
    // Two offers a night now: the night's record starts afresh (tonight may bring both).
    base.jobNight = {}
    delete base.jobOffered
    // Minigames are only played as jobs: their nightly pay record is gone.
    delete base.minigameNight
  }
  if (version < 8) {
    // Where you sleep is a choice now; a save's next night keeps the most bets a night has.
    base.nextBets = NIGHT_BETS
  }
  if (version < 9) {
    // Nights are 5 or 10 bets now: nothing over the room's.
    base.nextBets = Math.min(base.nextBets ?? NIGHT_BETS, NIGHT_BETS)
    if (base.tonight) base.tonight = { ...base.tonight, limit: Math.min(base.tonight.limit ?? NIGHT_BETS, NIGHT_BETS) }
  }
  if (version < 10) {
    // Five cities were cut: a save in one moves on to the next city left, as if it had just arrived.
    const known = (id: string): id is CityId => CITY_BY_ID.has(id as CityId)
    const keep = <T,>(rec: Partial<Record<string, T>> | undefined) =>
      Object.fromEntries(Object.entries(rec ?? {}).filter(([id]) => known(id))) as Partial<Record<CityId, T>>
    if (!known(base.city)) {
      const to = REMOVED_CITIES[base.city as string] ?? CITIES[0]!.id
      base.city = to
      base.cityNight = 0
      base.markersHere = 0
      base.bossBackOn = null
      base.bossTable = null
      base.tonight = null
      base.scene = null
      base.queue = []
      if (!base.visited.includes(to)) base.visited = [...base.visited, to]
    }
    base.visited = base.visited.filter(known)
    base.cleared = base.cleared.filter(known)
    base.standing = keep(base.standing)
    base.jobs = (base.jobs ?? []).filter((j) => known(j.city))
    base.jobsGiven = keep(base.jobsGiven)
    base.jobNight = keep(base.jobNight)
  }
  return base
}

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
          } else if ('rep' in e) set({ standing: shiftStanding(s.standing, s.city, e.rep) })
          else if ('job' in e) {
            // Taking an offered job: it is yours from now on.
            if (s.jobs.some((j) => j.id === e.job && j.status === 'offered')) {
              set({ jobs: s.jobs.map((j) => (j.id === e.job ? { ...j, status: 'open' as const } : j)) })
              const j = get().jobs.find((x) => x.id === e.job)!
              say(`Job taken: ${j.title}`)
            }
          }
          else if ('marker' in e) get().takeMarker()
        }
      }

      /** A taken job is done: it pays, a table job earns standing (capped), and its giver is free. */
      const completeJob = (job: Job) => {
        const s = get()
        if (!s.jobs.some((j) => j.id === job.id && j.status === 'open')) return
        const pay = job.pay * CITY_BY_ID.get(job.city)!.minBet
        const gain = kindOf(job.goal) === 'table' && (s.standing[job.city] ?? 0) < STANDING_MAX ? JOB_STANDING : 0
        set({ jobs: s.jobs.filter((j) => j.id !== job.id), ...(gain ? { standing: shiftStanding(s.standing, job.city, gain) } : {}) })
        get().receive(pay)
        say(`Job done: ${job.title} · +$${pay.toLocaleString('en-US')}${gain ? ` · standing +${gain}` : ''}`)
        // Tonight's offers that had no room (the town was full) come now.
        get().offerTonight()
      }

      /**
       * The offer scene for a job: the giver's pitch, then "I'll do it" or "Not now".
       * It only starts while the job is on offer (startScene), but plays on to its end
       * once taken.
       */
      const offerJob = (id: string) => get().jobs.find((j) => `${OFFER_PREFIX}${j.id}` === id) ?? null
      const offerScene = (id: string): Scene | null => {
        const job = offerJob(id)
        if (!job) return null
        const pay = job.pay * CITY_BY_ID.get(job.city)!.minBet
        const nodes: Scene['nodes'] = {}
        job.pitch.forEach((text, i) => {
          nodes[`p${i}`] = { kind: 'line', speaker: job.giver, expression: i === 0 ? 'neutral' : 'pleased', text, next: i + 1 < job.pitch.length ? `p${i + 1}` : 'ask' }
        })
        nodes.ask = {
          kind: 'choice',
          prompt:
            kindOf(job.goal) === 'minigame'
              ? `${job.title} · one go · pays $${pay.toLocaleString('en-US')} · no standing`
              : `${job.title} · pays $${pay.toLocaleString('en-US')} · +${JOB_STANDING} standing`,
          options: [
            { text: '"I\'ll do it."', to: 'yes', effects: [{ job: job.id, step: 'accept' }] },
            { text: '"Not now."', to: 'no' },
          ],
        }
        nodes.yes = { kind: 'line', speaker: job.giver, expression: 'pleased', text: 'Good. Come find me when it\'s done.', next: 'end' }
        nodes.no = { kind: 'line', speaker: job.giver, text: 'Suit yourself. It keeps.', next: 'end' }
        nodes.end = { kind: 'end' }
        return { id, city: job.city, trigger: { on: 'talk', character: job.giver }, once: false, start: job.pitch.length ? 'p0' : 'ask', nodes }
      }
      /** A content scene, or an offer scene built from the save. */
      const sceneOf = (id: string): Scene | null => (id.startsWith(OFFER_PREFIX) ? offerScene(id) : (SCENE_BY_ID.get(id) ?? null))

      /** After a settled round: streak and big-win jobs. */
      const checkRoundJobs = (rounds: NightRound[]) => {
        const last = rounds[rounds.length - 1]
        if (!last) return
        for (const job of get().openJobs()) {
          const goal = job.goal
          if (goal.kind === 'big-win' && last.bet > 0 && last.payout >= goal.mult * last.bet) completeJob(job)
          if (goal.kind === 'streak') {
            const tail = rounds.filter((r) => r.game === goal.game).slice(-goal.wins)
            if (tail.length === goal.wins && tail.every((r) => r.payout > r.bet)) completeJob(job)
          }
          if (goal.kind === 'wins' && rounds.filter((r) => r.game === goal.game && r.payout > r.bet).length >= goal.wins) completeJob(job)
        }
      }

      return {
        ...fresh(),

        newStory: () => {
          set({ ...fresh(), started: true, startedAt: new Date().toISOString(), visited: [STARTING_CITY] })
          queue(get().sceneFor({ on: 'arrival' }))
          queue(get().sceneFor({ on: 'tutorial' }))
          // The story starts with tonight's offers: a minigame job and a table job.
          get().offerTonight()
        },
        minBet: m,
        context: () => {
          const s = get()
          return { flags: s.flags, factions: s.factions, moneyM: s.money / m() }
        },
        rep: () => get().standing[get().city] ?? 0,
        openJobGames: () => get().openJobs().flatMap((j) => (j.goal.kind === 'streak' || j.goal.kind === 'wins' ? [j.goal.game] : [])),

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
          const scene = sceneOf(id)
          const s = get()
          if (!scene || s.scene) return false
          if (id.startsWith(OFFER_PREFIX) && offerJob(id)?.status !== 'offered') return false
          if (scene.once !== false && s.seen.includes(id)) return false
          set({ scene: { id, node: scene.start } })
          return true
        },
        playQueued: () => {
          // Skips anything that can no longer play (an offer already taken, say).
          while (!get().scene && get().queue.length) {
            const [id, ...rest] = get().queue
            set({ queue: rest })
            if (get().startScene(id!)) return true
          }
          return false
        },
        currentStep: () => {
          const cur = get().scene
          if (!cur) return null
          const scene = sceneOf(cur.id)
          return scene ? stepAt(scene, cur.node, get().context()) : null
        },
        advance: () => {
          const cur = get().scene
          const scene = cur && sceneOf(cur.id)
          if (!cur || !scene) {
            // A scene that can't be found (an offer already taken): close it.
            if (cur) set({ scene: null })
            return
          }
          const node = scene.nodes[cur.node]
          if (node?.kind === 'line') set({ scene: { ...cur, node: nextAfterLine(scene, cur.node) } })
          else if (node?.kind === 'end') {
            apply(node.effects ?? [])
            const s = get()
            set({ scene: null, seen: s.seen.includes(cur.id) || cur.id.startsWith(OFFER_PREFIX) ? s.seen : [...s.seen, cur.id] })
            // The next queued scene follows (arrival, then Jo's walkthrough).
            get().playQueued()
          }
        },
        pick: (index) => {
          const cur = get().scene
          const scene = cur && sceneOf(cur.id)
          if (!cur || !scene) return
          const { next, effects } = choose(scene, cur.node, index, get().context())
          apply(effects)
          set({ scene: { ...cur, node: next } })
        },

        receive: (dollars, opts) => {
          const s = get()
          const amount = Math.max(0, Math.round(dollars))
          const toMarker = opts?.profit && s.owed > 0 ? Math.min(s.owed, Math.floor(amount * MARKER_GARNISH)) : 0
          const owed = s.owed - toMarker
          set({ money: s.money + amount - toMarker, owed, ...(owed < DEBT_WARN_M * m() ? { debtWarned: false } : {}) })
        },
        spend: (dollars) => {
          const s = get()
          const amount = Math.round(dollars)
          if (amount < 0 || amount > s.money) return false
          set({ money: s.money - amount })
          return true
        },
        lenderHere: () => CHARACTERS.find((c) => c.city === get().city && c.lends)?.id ?? null,
        takeMarker: () => {
          const s = get()
          const lender = get().lenderHere()
          if (!lender) return false
          const lent = MARKER_M * m()
          const repay = Math.round(lent * (MARKER_REPAY + MARKER_REPAY_STEP * s.markersHere))
          // The town hears about it: a marker costs standing here (going broke on its own doesn't).
          const lost = Math.min(MARKER_STANDING, s.standing[s.city] ?? 0)
          set({
            money: s.money + lent,
            owed: s.owed + repay,
            markersHere: s.markersHere + 1,
            stats: { ...s.stats, markers: s.stats.markers + 1 },
            standing: shiftStanding(s.standing, s.city, -MARKER_STANDING),
          })
          const name = CHARACTERS.find((c) => c.id === lender)?.name ?? 'The lender'
          say(`${name} lends $${lent.toLocaleString('en-US')} · you owe $${repay.toLocaleString('en-US')}${lost ? ` · standing -${lost}` : ''}`)
          return true
        },
        ateTonight: () => get().mealNight === get().night,
        buyMeal: () => {
          const s = get()
          if (get().ateTonight() || !CHARACTERS.some((c) => c.city === s.city && c.sells === 'meal')) return false
          if (!get().spend(MEAL_M * m())) return false
          set((x) => ({ mealNight: x.night, ...(x.tonight ? { tonight: { ...x.tonight, limit: (x.tonight.limit ?? NIGHT_BETS) + MEAL_BETS } } : {}) }))
          say(`A plate at the diner · +${MEAL_BETS} bets tonight`)
          return true
        },
        debtWarning: () => {
          const s = get()
          return s.owed >= DEBT_WARN_M * m() && !s.debtWarned
        },
        dismissDebtWarning: () => set({ debtWarned: true }),

        openJobs: () => get().jobs.filter((j) => j.city === get().city && j.status === 'open'),
        jobAt: (character) => get().jobs.find((j) => j.city === get().city && j.giver === character) ?? null,
        canTalk: (character) => !!get().sceneFor({ on: 'talk', character }) || get().jobAt(character)?.status === 'offered',
        talkTo: (character) => {
          const scene = get().sceneFor({ on: 'talk', character })
          const offer = get().jobAt(character)
          const offerId = offer?.status === 'offered' ? `${OFFER_PREFIX}${offer.id}` : null
          if (scene) {
            if (!get().startScene(scene)) return false
            // Their news first, then the job they have going.
            if (offerId) queue(offerId)
            return true
          }
          return offerId ? get().startScene(offerId) : false
        },
        dropJob: (id) => {
          const job = get().openJobs().find((j) => j.id === id)
          if (!job) return
          set((x) => ({ jobs: x.jobs.filter((j) => j.id !== id) }))
          say(`Job dropped: ${job.title}`)
          get().offerTonight()
        },
        offerTonight: () => {
          if (!get().started) return
          // Offers nobody took for JOB_OFFER_NIGHTS nights leave; their givers can offer again.
          const stale = get().jobs.filter((j) => j.city === get().city && j.status === 'offered' && get().night - j.night >= JOB_OFFER_NIGHTS)
          if (stale.length) {
            // Nobody took them, so they were never given: a giver may offer them again later.
            const given = [...(get().jobsGiven[get().city] ?? [])]
            for (const j of stale) {
              const at = given.lastIndexOf(j.key)
              if (at >= 0) given.splice(at, 1)
            }
            set((x) => ({ jobs: x.jobs.filter((j) => !stale.includes(j)), jobsGiven: { ...x.jobsGiven, [x.city]: given } }))
            for (const j of stale) say(`${CHARACTERS.find((x) => x.id === j.giver)?.name ?? 'Someone'} gave the job to someone else: ${j.title}`)
          }
          const s = get()
          const c = city()
          const last = s.jobNight[s.city]
          const done = last?.night === s.night ? last.kinds : []
          const kinds = NIGHT_KINDS.filter((k) => !done.includes(k))
          if (!kinds.length) return
          const given = s.jobsGiven[s.city] ?? []
          const jobs = makeOffers({
            city: c,
            night: s.night,
            kinds,
            held: s.jobs.filter((j) => j.city === s.city),
            given,
            games: c.games === 'all-seen' ? s.seenGames : c.games,
          })
          // No room (or nothing to give): what is still due comes later tonight, once a job is done.
          if (!jobs.length) return
          set({
            jobs: [...s.jobs, ...jobs],
            jobsGiven: { ...s.jobsGiven, [s.city]: [...given, ...jobs.map((j) => j.key)] },
            jobNight: { ...s.jobNight, [s.city]: { night: s.night, kinds: [...done, ...jobs.map((j) => kindOf(j.goal))] } },
          })
          for (const job of jobs) say(`${CHARACTERS.find((x) => x.id === job.giver)?.name ?? 'Someone'} has a job going. Go and talk to them.`)
        },

        venueOpen: (venue) => get().rep() >= VENUE_REP[venue],
        startNight: (venue) => {
          const s = get()
          if (s.tonight || !get().venueOpen(venue) || s.money < m()) return false
          // A meal eaten before sitting down adds its bets to the night.
          set({ tonight: { venue, bets: 0, openRound: null, rounds: [], startMoney: s.money, limit: s.nextBets + (get().ateTonight() ? MEAL_BETS : 0) } })
          return true
        },
        wagerCap: () => {
          const s = get()
          if (!s.tonight) return 0
          const max = VENUE_MAX_M[s.tonight.venue]
          if (s.tonight.openRound) return s.money + s.tonight.openRound.bet
          if (s.tonight.bets >= (s.tonight.limit ?? NIGHT_BETS)) return 0
          return max == null ? s.money : Math.min(s.money, max * m())
        },
        betsLeft: () => {
          const t = get().tonight
          return t ? Math.max(0, (t.limit ?? NIGHT_BETS) - t.bets) : 0
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
          checkRoundJobs(rounds)
        },
        sleepCost: (place) => sleepCostM(place, get().city === CITIES[0]!.id) * m(),
        sleepOpen: (place) => get().rep() >= SLEEP_REP[place],
        endNight: (choice = 'car') => {
          const s = get()
          const t = s.tonight
          const before = t ? t.startMoney : s.money
          let comps = 0
          let bonus = 0
          let bonusRate = 0
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
            const tableWinnings = t.rounds.reduce((sum, r) => sum + r.payout - r.bet, 0)
            if (tableWinnings > 0) {
              for (const j of get().openJobs()) if (j.goal.kind === 'night-up' && tableWinnings >= (j.goal.atLeast ?? 0) * m()) completeJob(j)
            }
            // Standing as the night closes (a job finished tonight counts) sets the bonus.
            bonusRate = STANDING_BONUS[get().rep()] ?? 0
            bonus = standingBonus(get().rep(), tableWinnings)
            if (bonus) get().receive(bonus)
          }
          const after = get()
          // A room you can't afford, or whose standing you lack, is the car; the car is paid
          // down to $0, never into debt.
          const place: SleepPlace = choice === 'room' && get().sleepOpen('room') && after.money >= get().sleepCost('room') ? 'room' : 'car'
          const lodging = Math.min(after.money, get().sleepCost(place))
          const money = after.money - lodging
          const bust = money < m()
          const nextBets = SLEEP_BETS[place]
          const summary: NightSummary = { night: after.night + 1, played: !!t, comps, bonus, bonusRate, hustles, lodging, car: place === 'car', nextBets, net: money - before, bust }
          set({
            money,
            nextBets,
            night: after.night + 1,
            cityNight: after.cityNight + 1,
            bossBackOn: after.bossBackOn != null && after.night + 1 >= after.bossBackOn ? null : after.bossBackOn,
            tonight: null,
            lastNight: summary,
            ...(bust ? { stats: { ...after.stats, busts: after.stats.busts + 1 } } : {}),
          })
          if (bust) queue(get().sceneFor({ on: 'bust' }))
          queue(get().sceneFor({ on: 'dawn' }))
          // A new night: a minigame job and a table job offered in this town, where there is room.
          get().offerTonight()
          return summary
        },
        beginMinigame: (giver) => {
          const job = get().minigameJobAt(giver)
          if (job) set((x) => ({ jobs: x.jobs.map((j) => (j.id === job.id ? { ...j, started: true } : j)) }))
        },
        forfeitStartedMinigames: () => {
          for (const j of get().openJobs()) {
            if (j.started && j.goal.kind === 'minigame') get().playMinigame(j.giver, j.goal.minigame, 0)
          }
        },
        minigameJobAt: (giver) => get().openJobs().find((j) => j.giver === giver && j.goal.kind === 'minigame') ?? null,
        playMinigame: (giver, minigame, score) => {
          const job = get().minigameJobAt(giver)
          if (!job || job.goal.kind !== 'minigame' || job.goal.minigame !== minigame) return 0
          if (score >= job.goal.score) {
            const before = get().money
            completeJob(job)
            return get().money - before
          }
          // One attempt: a miss (or leaving mid-game) loses the job, and its giver is free.
          set((x) => ({ jobs: x.jobs.filter((j) => j.id !== job.id) }))
          say(`Job lost: ${job.title} · you needed ${Math.round(job.goal.score * 100)}%`)
          get().offerTonight()
          return 0
        },
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
            set({ bossTable: null, cleared: [...s.cleared, s.city], stats: { ...s.stats, bossWins: s.stats.bossWins + 1 }, flags: { ...s.flags, [`${s.city}-cleared`]: true } })
            get().receive(BOSS_PURSE_M * m(), { profit: true })
            queue(get().sceneFor({ on: 'boss-win' }))
          } else {
            set({ bossTable: null, bossBackOn: s.night + BOSS_REMATCH_NIGHTS })
            queue(get().sceneFor({ on: 'boss-loss' }))
          }
        },
        travelNext: () => {
          const s = get()
          const i = CITIES.findIndex((c) => c.id === s.city)
          const next = CITIES[i + 1]
          // Beating the boss is the ticket out: the road costs nothing (owner decision 2026-11-04).
          if (!next || s.tonight || !s.cleared.includes(s.city)) return false
          set({ city: next.id, visited: s.visited.includes(next.id) ? s.visited : [...s.visited, next.id], cityNight: 0, markersHere: 0, bossBackOn: null, lastNight: null })
          queue(get().sceneFor({ on: 'arrival' }))
          // The first night in a new town starts with its offers too.
          get().offerTonight()
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
      migrate: (persisted, version) => migrateStorySave(persisted, version),
      merge: (persisted, current) => ({ ...current, ...fresh(), ...(persisted as Partial<StorySave>) }),
    },
  ),
)

export { NIGHT_BETS, BOSS_BUYIN_M }
