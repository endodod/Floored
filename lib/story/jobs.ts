import type { City, CityId } from './cities'
import type { Character, JobGoal } from './types'
import { CHARACTERS, WRITTEN_JOBS } from './content'
import { JOB_LIMIT } from './economy'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import type { GameName } from '@/store/types'
import { createRng, seedFromString } from '@/utils/rng'

/**
 * Jobs (owner decision 2026-11-04). The rules, all enforced here and in the store:
 *
 *  - Each night in a town, one new offer turns up at a random person there who
 *    holds no job, while the town has fewer than JOB_LIMIT jobs (offered or taken).
 *    The first night in every town starts with one, so a story starts with exactly
 *    one offer.
 *  - An offer is only taken by talking to its giver ("I'll do it"); "Not now", or
 *    never talking to them, leaves it waiting with them for as long as it takes.
 *  - A person holds one job at a time, offered or taken, until it is finished.
 *  - A town never hands out the same task twice (`goalKey`): its written jobs come
 *    first, giver by giver in content order, then generated ones from the
 *    templates below with a goal the town has not given yet.
 *  - Every job pays its `pay` in minimum bets and earns JOB_STANDING (capped).
 *  - Jobs belong to their town: leave and they wait there for your return.
 *
 * Givers are the town's people with a minigame (the one without is the boss) and
 * Jo, who travels with you. A new city gets jobs for free.
 */

export interface Job {
  /** `city:night:giver`; unique, as a town gets at most one offer a night. */
  id: string
  /** The task's identity (`goalKey`): a town never gives the same one twice. */
  key: string
  city: CityId
  giver: string
  title: string
  task: string
  goal: JobGoal
  /** In minimum bets. */
  pay: number
  /** What the giver says when they offer it. */
  pitch: string[]
  /** Offered: waiting at the giver until you talk to them. Open: you took it. */
  status: 'offered' | 'open'
  /** The global night it was offered. */
  night: number
}

/** People who give jobs in every town (they travel with you). */
export const TRAVELLING_GIVERS = ['jo'] as const

/** Who gives jobs in a town, in a stable order. */
export function jobGivers(city: CityId): Character[] {
  const local = CHARACTERS.filter((c) => c.city === city && !!c.minigame)
  const travelling = CHARACTERS.filter((c) => (TRAVELLING_GIVERS as readonly string[]).includes(c.id))
  return [...local, ...travelling]
}

/** A task's identity: same kind, same game or minigame, same numbers. */
export function goalKey(goal: JobGoal): string {
  switch (goal.kind) {
    case 'minigame':
      return `minigame:${goal.minigame}:${goal.score}`
    case 'streak':
      return `streak:${goal.game}:${goal.wins}`
    case 'night-up':
      return `night-up:${goal.atLeast ?? 0}`
    case 'big-win':
      return `big-win:${goal.mult}`
  }
}

type Rng = () => number
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!
function shuffled<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

interface Made {
  goal: JobGoal
  title: string
  task: string
  pay: number
}

interface Template {
  kind: JobGoal['kind']
  /** Whether a player who never bets can do it (the sim uses this). */
  noBet: boolean
  make: (ctx: { rng: Rng; giver: Character; games: GameName[] }) => Made | null
}

const label = (g: GameName) => GAME_BY_NAME.get(g)?.label ?? g

export const JOB_TEMPLATES: Template[] = [
  {
    kind: 'streak',
    noBet: false,
    make: ({ rng, games }) => {
      if (!games.length) return null
      const game = pick(rng, games)
      const wins = pick(rng, [2, 3] as const)
      const title = pick(rng, ['Hot streak', 'Run it back', 'Show the room', 'Prove the table'])
      const task = pick(rng, [
        `Win ${wins} rounds of ${label(game)} in a row.`,
        `Somebody says ${label(game)} can't be beaten ${wins} times running. Beat it ${wins} times running.`,
        `Take ${wins} straight wins at ${label(game)}, no losses between.`,
      ])
      return { goal: { kind: 'streak', game, wins }, title, task, pay: wins === 3 ? 5 : 3 }
    },
  },
  {
    kind: 'big-win',
    noBet: false,
    make: ({ rng }) => {
      const mult = pick(rng, [2, 2.5, 3, 4, 5] as const)
      const title = pick(rng, ['One big hit', 'The long shot', 'Make them look', 'A story for the bar'])
      const task = pick(rng, [
        `Win ${mult}× your stake or more on one bet.`,
        `Land one bet that pays ${mult} times what you put down.`,
        `Hit a ${mult}× win in one go, any game.`,
      ])
      return { goal: { kind: 'big-win', mult }, title, task, pay: mult >= 4 ? 5 : mult >= 3 ? 4 : 3 }
    },
  },
  {
    kind: 'night-up',
    noBet: false,
    make: ({ rng }) => {
      const atLeast = pick(rng, [0, 5, 10, 15, 20] as const)
      const title = pick(rng, ['A good night', 'Walk out ahead', 'Bring something home', 'Count it at dawn'])
      const task = atLeast
        ? pick(rng, [`Finish a night up at the tables by ${atLeast}× the minimum bet or more.`, `End a night at least ${atLeast}× the minimum bet ahead at the tables.`])
        : pick(rng, ['Finish a night up at the tables, by any amount.', 'Walk out of the casino with more than you walked in with.'])
      return { goal: { kind: 'night-up', atLeast: atLeast || undefined }, title, task, pay: atLeast >= 10 ? 5 : atLeast ? 4 : 3 }
    },
  },
  {
    kind: 'minigame',
    noBet: true,
    make: ({ rng, giver }) => {
      if (!giver.minigame) return null
      const score = pick(rng, [0.6, 0.8, 1] as const)
      const title = pick(rng, ['A favour', 'Another shift', 'Show me again', 'Busy night'])
      const pctText = score === 1 ? 'a perfect score' : `at least ${Math.round(score * 100)}%`
      const task = pick(rng, [`Play ${giver.name}'s game and score ${pctText}.`, `${giver.name} is short-handed tonight. Score ${pctText} at their game.`])
      return { goal: { kind: 'minigame', minigame: giver.minigame, score }, title, task, pay: score === 1 ? 5 : score >= 0.8 ? 4 : 3 }
    },
  },
]

/** How a generated job is pitched: an opener, then the task. */
const OPENERS = ['Got a minute? I have work.', 'You looking for work? I could use a hand.', "Here's one for you, if you want it.", 'I need somebody I can count on tonight.']

/** Draws a generated task per template before giving up on that template. */
const DRAWS_PER_TEMPLATE = 24

/**
 * The job a giver would offer next in a town: their first written job the town has
 * not given yet, else a generated one whose goal the town has not given (`taken`).
 * Null when nothing new is left for them.
 */
function nextFor(args: { rng: Rng; city: City; giver: Character; games: GameName[]; taken: Set<string> }): Made & { pitch: string[] } | null {
  const { rng, city, giver, games, taken } = args
  const written = WRITTEN_JOBS.find((w) => w.city === city.id && w.giver === giver.id && !taken.has(goalKey(w.goal)))
  if (written) return { goal: written.goal, title: written.title, task: written.task, pay: written.pay, pitch: written.pitch }
  for (const t of shuffled(rng, JOB_TEMPLATES)) {
    for (let d = 0; d < DRAWS_PER_TEMPLATE; d++) {
      const made = t.make({ rng, giver, games })
      if (!made) break
      if (!taken.has(goalKey(made.goal))) return { ...made, pitch: [pick(rng, OPENERS), made.task] }
    }
  }
  return null
}

/**
 * Tonight's new offer in a town, or null: the town already holds JOB_LIMIT jobs,
 * everyone who gives jobs holds one, or nothing new is left to give. `held` is the
 * town's jobs now (offered and taken); `given` every task key the town has handed
 * out before. Seeded by town and night, so a reload makes the same offer.
 */
export function makeOffer(args: { city: City; night: number; held: Job[]; given: readonly string[]; games: GameName[] }): Job | null {
  const { city, night, held, given, games } = args
  if (held.length >= JOB_LIMIT) return null
  const busy = new Set(held.map((j) => j.giver))
  const rng = createRng(seedFromString(`offer:${city.id}:${night}`))
  const taken = new Set([...given, ...held.map((j) => j.key)])
  for (const giver of shuffled(rng, jobGivers(city.id).filter((g) => !busy.has(g.id)))) {
    const made = nextFor({ rng, city, giver, games, taken })
    if (!made) continue
    return { id: `${city.id}:${night}:${giver.id}`, key: goalKey(made.goal), city: city.id, giver: giver.id, ...made, status: 'offered', night }
  }
  return null
}

/** Share of a giver's possible job kinds a player who never bets can do (for the sim). */
export function noBetShare(hasMinigame: boolean): number {
  const fit = JOB_TEMPLATES.filter((t) => hasMinigame || t.kind !== 'minigame')
  return fit.filter((t) => t.noBet).length / fit.length
}
