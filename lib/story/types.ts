import type { CityId } from './cities'

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

export interface Errand {
  id: string
  city: CityId
  giver: string
  title: string
  /** What to do, in the player's words. */
  task: string
  /** Pays this many of the city's minimum bets when done (ERRAND_PAY_M by default). */
  pay?: number
}
