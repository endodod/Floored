import type { Rng, TableTier } from '@/lib/tables/types'

/**
 * The bot system's shared core. A bot is a profile (who it is and how it
 * likes to play) plus a skill tier (how well it plays), and a policy per game
 * turns a seat's view into an action. Bots never see more than a human in
 * their seat would: a policy only ever receives `viewFor(state, seat)`.
 */
export type BotSkill = TableTier

export type BotStyle = 'rock' | 'maniac' | 'station' | 'regular' | 'trickster' | 'nit'

export interface BotProfile {
  id: string
  name: string
  style: BotStyle
  /** 0 = plays almost anything, 1 = only premium spots. */
  tightness: number
  /** 0 = checks and calls, 1 = bets and raises. */
  aggression: number
  /** How often it represents a hand it doesn't have. */
  bluff: number
  /** Appetite for variance: big bets, thin calls, bold bids. */
  risk: number
  /** How much a big loss shakes it (tilt plays looser and wilder for a while). */
  tiltProne: number
}

export interface Bot {
  profile: BotProfile
  skill: BotSkill
}

/** What a bot has seen another seat do, counted from public actions only. */
export interface SeatReads {
  hands: number
  /** Hands where it put chips in voluntarily before the flop. */
  vpip: number
  /** Hands where it raised before the flop. */
  pfr: number
  /** Bets and raises after the flop… */
  aggressive: number
  /** …and calls after the flop. */
  passive: number
  /** Liar's Dice: "Liar!" calls, and how many were right. */
  liarCalls: number
  liarCallsRight: number
  /** Liar's Dice: bids that were called, and how many were short (bluffs caught). */
  bidsCalled: number
  bidsShort: number
}

/** Per-table memory of one bot. */
export interface BotMind {
  seat: number
  reads: SeatReads[]
  /** 0 = calm; decays each hand / round. */
  tilt: number
  /** Log entries already read. */
  seen: number
  /** Hand / round already counted. */
  lastCounted: number
  /** Per-hand marks ("vpip:3" = seat 3 already counted this hand); cleared each hand. */
  marks: Record<string, true>
}

export interface BotPolicy<View, Action> {
  decide: (view: View, bot: Bot, mind: BotMind, rng: Rng) => Action
  /** Updates the mind from the public part of a view (called after every step). */
  observe: (view: View, bot: Bot, mind: BotMind) => void
  /** How long the bot appears to think, in ms. */
  thinkMs: (view: View, bot: Bot, rng: Rng) => number
}
