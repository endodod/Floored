import type { CityId } from './cities'
import type { GameName } from '@/store/types'

/**
 * Story content types (.md/STORY_MODE_PLAN.md section 4). Content is data: typed
 * records with stable ids that saves refer to. Rename text freely; never rename
 * or reuse an id once it has shipped (`pnpm check:story` guards the rules).
 */

export type Expression = 'neutral' | 'pleased' | 'angry'

/** The three factions choices shift standing with; endings read them. */
export type FactionId = 'syndicate' | 'old-guard' | 'underground'

export type MinigameId =
  | 'chip-count'
  | 'shuffle-tracker'
  | 'last-orders'
  | 'spot-the-cheat'
  | 'payout-pro'
  | 'rack-em'
  | 'slot-mechanic'
  | 'dice-stack'
  | 'read-the-tell'
  | 'count-the-shoe'
  | 'odds-sense'
  | 'free-roll'

export interface Character {
  id: string
  name: string
  /** One line for the writers: who they are. Never shown. */
  note: string
  /** Home city, or null for those who travel the circuit (Jo, Sloane, Vale, the Notary). */
  city: CityId | null
  /** Their chip colour in the portrait frame (hex). */
  chip: string
  /** The minigame they offer, once per night. */
  minigame?: MinigameId
}

/** A test on the save. */
export type Condition =
  | { flag: string }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] }
  | { faction: FactionId; atLeast: number }
  /** Money in multiples of the current city's minimum bet. */
  | { moneyAtLeast: number }

/** A change to the save, applied when a choice is taken or a scene ends. */
export type Effect =
  | { set: string }
  | { clear: string }
  | { faction: FactionId; delta: number }
  /** Pay (positive) or charge (negative), in multiples of the current city's minimum bet. */
  | { money: number }
  | { rep: number }
  | { errand: string; step: 'start' | 'done' }
  /** Take a marker from the Notary (only when you're below the minimum bet). */
  | { marker: true }

export type Speaker = string | 'you' | 'narrator'

export type SceneNode =
  | { kind: 'line'; speaker: Speaker; expression?: Expression; text: string; next: string }
  | { kind: 'choice'; prompt?: string; options: ChoiceOption[] }
  | { kind: 'end'; effects?: Effect[] }

export interface ChoiceOption {
  text: string
  to: string
  /** Shown only when this holds. A choice node must always keep at least one option open. */
  if?: Condition
  effects?: Effect[]
}

export type SceneTrigger =
  /** Plays once on first arrival in the city. */
  | { on: 'arrival' }
  /** Talking to a character (the first scene whose condition holds plays). */
  | { on: 'talk'; character: string }
  | { on: 'boss-intro' }
  | { on: 'boss-win' }
  | { on: 'boss-loss' }
  /** After a bust in this city. */
  | { on: 'bust' }
  /**
   * The morning after a night in this city: plays once its errands are due. For
   * jobs from Jo, who travels with you and has no spot on the street.
   */
  | { on: 'dawn' }
  /** The how-the-nights-work walkthrough: queued after the arrival scene on a new story; replayable from the hub menu. */
  | { on: 'tutorial' }

export interface Scene {
  id: string
  city: CityId
  trigger: SceneTrigger
  /** The scene is available only while this holds. */
  if?: Condition
  /** Plays at most once (default true). */
  once?: boolean
  start: string
  nodes: Record<string, SceneNode>
}

/** What finishes an errand. Checked after every round at the casino and every minigame. */
export type ErrandGoal =
  /** Score at least this (0–1) in a character's minigame. */
  | { kind: 'minigame'; minigame: MinigameId; score: number }
  /** Win this many rounds in a row at one game. */
  | { kind: 'streak'; game: GameName; wins: number }
  /** End a night at the casino up (by at least `atLeast` minimum bets, when given). */
  | { kind: 'night-up'; atLeast?: number }
  /** Win this multiple or more of the stake on one bet. */
  | { kind: 'big-win'; mult: number }

export interface Errand {
  id: string
  city: CityId
  giver: string
  title: string
  /** What to do, in the player's words. */
  task: string
  goal: ErrandGoal
  /**
   * The night in this town it comes out (0 = the first night there). A scene that
   * starts it waits for this night, so the giver only wants a word from then on.
   * Two errands a city on night 0, then one a night (ERRANDS_FIRST_NIGHT).
   */
  night: number
  /** On the jobs board once this holds (or once a scene starts it), from its night on. */
  opens?: Condition
  /** Pays this many of the city's minimum bets when done (ERRAND_PAY_M by default). */
  pay?: number
  /**
   * Standing this job earns in its town. Defaults to ERRAND_STANDING (1) for
   * every errand, minigame jobs included.
   */
  rep?: number
}
