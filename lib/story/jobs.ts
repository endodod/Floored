import type { City } from './cities'
import type { Character, Errand, ErrandGoal } from './types'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import type { GameName } from '@/store/types'
import { createRng, seedFromString } from '@/utils/rng'

/**
 * Spawned jobs: once a town's story errands are all out, one new job turns up each
 * night for someone who has nothing open with you. A job you don't finish stays
 * on the board, and each person holds at most one, so a town has at most as many
 * open jobs as it has errand givers (three in Dustwater: Marta, Pike, Jo). Owner
 * decision 2026-11-04.
 *
 * A job is drawn from the templates below, seeded by city and night, so a reload
 * shows the same one; the kind, the numbers, the game and the wording all vary.
 * It pays its own `pay` (in m) and earns ERRAND_STANDING like an errand, capped at
 * STANDING_MAX, so a town where you went bust can be worked back up.
 *
 * Nothing here is per city: givers are the people who hand out the city's story
 * errands, the games are the city's own, and minigame jobs go to givers with a
 * minigame. A new city gets jobs for free.
 */

export interface Job extends Errand {
  /** The global night it turned up. */
  spawned: number
}

/** Jobs carry this prefix in their id (they live in the save's `jobs`, never in `errands`). */
export const JOB_PREFIX = 'job:'
export const isJob = (id: string) => id.startsWith(JOB_PREFIX)

/** What a job pays, in m: 3 for an easy one, up to 5 for a hard one. */
export const JOB_PAY_M = { min: 3, max: 5 } as const

type Rng = () => number
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!

interface Template {
  kind: ErrandGoal['kind']
  /** Whether a player who never bets can do it (the sim uses this). */
  noBet: boolean
  make: (ctx: { rng: Rng; giver: Character; games: GameName[] }) => { goal: ErrandGoal; title: string; task: string; pay: number } | null
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
      const mult = pick(rng, [2.5, 3, 4, 5] as const)
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
      const atLeast = pick(rng, [0, 5, 10, 20] as const)
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

/**
 * The night's new job, or null when every giver already has one open (or the city
 * has no givers). `open` is every job open now, story errands included: a giver
 * with any open job gets nothing new. At most one open streak job, so the dive
 * keeps room for its own games.
 */
export function spawnJob(args: {
  city: City
  night: number
  givers: Character[]
  open: Errand[]
  games: GameName[]
}): Job | null {
  const busy = new Set(args.open.map((e) => e.giver))
  const free = args.givers.filter((g) => !busy.has(g.id))
  if (!free.length) return null
  const rng = createRng(seedFromString(`job:${args.city.id}:${args.night}`))
  const giver = pick(rng, free)
  const streakOpen = args.open.some((e) => e.goal.kind === 'streak')
  const usable = JOB_TEMPLATES.filter((t) => !(t.kind === 'streak' && streakOpen))
  // Try templates in a seeded order until one fits this giver.
  const order = [...usable]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  for (const t of order) {
    const made = t.make({ rng, giver, games: args.games })
    if (!made) continue
    return {
      id: `${JOB_PREFIX}${args.city.id}:${args.night}`,
      city: args.city.id,
      giver: giver.id,
      night: 0,
      spawned: args.night,
      rep: 1,
      ...made,
    }
  }
  return null
}

/** Share of a giver's possible job kinds a player who never bets can do (for the sim). */
export function noBetShare(hasMinigame: boolean): number {
  const fit = JOB_TEMPLATES.filter((t) => hasMinigame || t.kind !== 'minigame')
  return fit.filter((t) => t.noBet).length / fit.length
}
