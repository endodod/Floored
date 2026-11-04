import type { City, CityId } from './cities'
import type { Character, JobGoal } from './types'
import { CHARACTERS, WRITTEN_JOBS } from './content'
import { JOB_LIMIT, JOB_STANDING } from './economy'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import type { GameName } from '@/store/types'
import { createRng, seedFromString } from '@/utils/rng'

/**
 * Jobs (owner decisions 2026-11-04). The rules, all enforced here and in the store:
 *
 *  - Two kinds: a **minigame job** (a score at the giver's own minigame) and a
 *    **table job** (a goal at the casino).
 *  - Each night in a town, one of each kind turns up, at two different random
 *    people who hold no job, while the town has room: it holds at most JOB_LIMIT
 *    jobs, offered or taken. With only one place free, a coin flip picks the kind
 *    (and a place freed later that night brings the kind still missing). The first
 *    night in every town works the same way, so a story starts with two offers.
 *  - An offer is only taken by talking to its giver ("I'll do it"); "Not now", or
 *    never talking to them, leaves it waiting with them for as long as it takes.
 *  - A person holds one job at a time, offered or taken, until it is finished.
 *  - Each giver's written jobs come first, in content order. A town never hands out
 *    the same **table** task twice (`goalKey`); **minigame** jobs may repeat, but a
 *    giver never offers the same one twice in a row.
 *  - A table job pays 3m-5m and earns JOB_STANDING (capped). A minigame job is one
 *    attempt: hit the target and it pays 6m-8m (no standing); miss and it is gone.
 *    Minigames are only played as jobs.
 *  - Jobs belong to their town: leave and they wait there for your return.
 *
 * Givers are the town's people with a minigame (the one without is the boss) and
 * Jo, who travels with you and runs Chip Count. A new city gets jobs for free.
 */

/** A minigame job or a table job (`kindOf`). */
export type JobKind = 'minigame' | 'table'
export const kindOf = (goal: JobGoal): JobKind => (goal.kind === 'minigame' ? 'minigame' : 'table')
/** The kinds a night brings, in the order they are placed. */
export const NIGHT_KINDS: readonly JobKind[] = ['minigame', 'table']

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
  /** A minigame job whose one attempt has started: leaving before the end loses it. */
  started?: boolean
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
  make: (ctx: { rng: Rng; giver: Character; games: GameName[] }) => Made | null
}

const label = (g: GameName) => GAME_BY_NAME.get(g)?.label ?? g

export const JOB_TEMPLATES: Template[] = [
  {
    kind: 'streak',
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
    make: ({ rng, giver }) => {
      if (!giver.minigame) return null
      const score = pick(rng, [0.6, 0.8, 1] as const)
      const title = pick(rng, ['A favour', 'Another shift', 'Show me again', 'Busy night'])
      const pctText = score === 1 ? 'a perfect score' : `at least ${Math.round(score * 100)}%`
      const task = pick(rng, [`Play ${giver.name}'s game once and score ${pctText}.`, `${giver.name} is short-handed tonight. One go at their game: score ${pctText}.`])
      return { goal: { kind: 'minigame', minigame: giver.minigame, score }, title, task, pay: score === 1 ? 8 : score >= 0.8 ? 7 : 6 }
    },
  },
]

/** How a generated job is pitched: an opener, then the task. */
const OPENERS = ['Got a minute? I have work.', 'You looking for work? I could use a hand.', "Here's one for you, if you want it.", 'I need somebody I can count on tonight.']

/** Draws a generated task per template before giving up on that template. */
const DRAWS_PER_TEMPLATE = 24

/**
 * The job of a kind a giver would offer next in a town: their first written job of
 * that kind the town has not given yet, else a generated one. A table job's goal must
 * be new to the town (`given`); a minigame job only differs from the giver's last one.
 * Null when they have nothing of that kind (no minigame, or no new table task left).
 */
function nextFor(args: { rng: Rng; city: City; giver: Character; kind: JobKind; games: GameName[]; given: readonly string[]; held: Job[] }): Made & { pitch: string[] } | null {
  const { rng, city, giver, kind, games, given, held } = args
  const givenSet = new Set([...given, ...held.map((j) => j.key)])
  const written = WRITTEN_JOBS.find((w) => w.city === city.id && w.giver === giver.id && kindOf(w.goal) === kind && !givenSet.has(goalKey(w.goal)))
  if (written) return { goal: written.goal, title: written.title, task: written.task, pay: written.pay, pitch: written.pitch }
  // A minigame job may repeat, just not the one this giver gave last.
  const last = kind === 'minigame' && giver.minigame ? [...given].reverse().find((k) => k.startsWith(`minigame:${giver.minigame}:`)) : undefined
  const fresh = (key: string) => (kind === 'minigame' ? key !== last : !givenSet.has(key))
  for (const t of shuffled(rng, JOB_TEMPLATES.filter((x) => (x.kind === 'minigame') === (kind === 'minigame')))) {
    for (let d = 0; d < DRAWS_PER_TEMPLATE; d++) {
      const made = t.make({ rng, giver, games })
      if (!made) break
      if (fresh(goalKey(made.goal))) return { ...made, pitch: [pick(rng, OPENERS), made.task] }
    }
  }
  return null
}

/**
 * Offers to make in a town now, or none. `kinds` are the kinds still due tonight
 * (both at nightfall; the missing one after a coin-flip night). Each goes to a
 * different random giver who holds nothing, while the town holds fewer than
 * JOB_LIMIT; with fewer places than kinds due, a coin flip picks which comes.
 * `held` is the town's jobs now (offered and taken); `given` every task key the town
 * has handed out, in order. Seeded by town, night and what is due, so a reload
 * makes the same offers.
 */
export function makeOffers(args: { city: City; night: number; kinds: readonly JobKind[]; held: Job[]; given: readonly string[]; games: GameName[] }): Job[] {
  const { city, night, held, games } = args
  const rng = createRng(seedFromString(`offer:${city.id}:${night}:${args.kinds.join('+')}:${held.length}`))
  const room = JOB_LIMIT - held.length
  if (room <= 0 || !args.kinds.length) return []
  // Fewer places than kinds due: a coin flip picks the kind.
  const kinds = room >= args.kinds.length ? [...args.kinds] : shuffled(rng, args.kinds).slice(0, room)
  const out: Job[] = []
  const given = [...args.given]
  for (const kind of kinds) {
    const busy = new Set([...held, ...out].map((j) => j.giver))
    for (const giver of shuffled(rng, jobGivers(city.id).filter((g) => !busy.has(g.id)))) {
      const made = nextFor({ rng, city, giver, kind, games, given, held: [...held, ...out] })
      if (!made) continue
      const key = goalKey(made.goal)
      out.push({ id: `${city.id}:${night}:${giver.id}`, key, city: city.id, giver: giver.id, ...made, status: 'offered', night })
      given.push(key)
      break
    }
  }
  return out
}

/** "minigame job" or "table job", for labels. */
export const jobKindName = (job: Pick<Job, 'goal'> | null | undefined) => (job && kindOf(job.goal) === 'minigame' ? 'minigame job' : 'table job')

/** What a job gives, for labels: "$35 · one go · no standing" or "$20 · +1 standing". */
export function jobReward(job: Pick<Job, 'goal' | 'pay'>, minBet: number): string {
  const pay = `$${Math.round(job.pay * minBet).toLocaleString('en-US')}`
  return kindOf(job.goal) === 'minigame' ? `${pay} · one go · no standing` : `${pay} · +${JOB_STANDING} standing`
}


