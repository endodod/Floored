import type { Rng } from '@/lib/tables/types'
import type { Bot, BotMind, BotProfile, BotSkill, SeatReads } from './types'
import { BOT_ROSTER } from './roster'

/** How far each tier strays from its policy's best answer, and how hard it reads the table. */
export const SKILL: Record<BotSkill, { label: string; noise: number; samples: number; reads: number; mistakes: number }> = {
  // noise: spread added to its estimates · samples: Monte Carlo deals per decision
  // reads: weight given to what it has seen opponents do · mistakes: chance of a plain misplay
  rookie: { label: 'For fun', noise: 0.2, samples: 90, reads: 0, mistakes: 0.2 },
  regular: { label: 'Regular player', noise: 0.065, samples: 320, reads: 0.65, mistakes: 0.025 },
  shark: { label: 'Expert', noise: 0.012, samples: 800, reads: 1, mistakes: 0 },
}

/**
 * The profile a bot actually plays: its own style, pulled toward the game's
 * solid baseline the better it is (a Shark keeps its flavour but plugs the
 * leaks). Rookies drift the other way: looser, more passive, fewer bluffs.
 */
export const SKILL_BLEND: Record<BotSkill, number> = { rookie: 0, regular: 0.3, shark: 0.72 }

export function playingProfile(bot: Bot, ideal: Pick<BotProfile, 'tightness' | 'aggression' | 'bluff' | 'risk'>): BotProfile {
  const w = SKILL_BLEND[bot.skill]
  const p = bot.profile
  const mix = (a: number, b: number) => a * (1 - w) + b * w
  const out = { ...p, tightness: mix(p.tightness, ideal.tightness), aggression: mix(p.aggression, ideal.aggression), bluff: mix(p.bluff, ideal.bluff), risk: mix(p.risk, ideal.risk) }
  if (bot.skill === 'rookie') {
    out.tightness = clamp(out.tightness - 0.2, 0, 1)
    out.aggression = clamp(out.aggression - 0.2, 0, 1)
    out.bluff *= 0.5
  }
  return out
}

export function emptyReads(): SeatReads {
  return { hands: 0, vpip: 0, pfr: 0, aggressive: 0, passive: 0, liarCalls: 0, liarCallsRight: 0, bidsCalled: 0, bidsShort: 0 }
}

export function createMind(seat: number, seats: number): BotMind {
  return { seat, reads: Array.from({ length: seats }, emptyReads), tilt: 0, seen: 0, lastCounted: 0, shoeCount: 0, lastCardsLeft: 0, marks: {} }
}

/** Roughly normal noise in about [-1, 1]. */
export function gauss(rng: Rng): number {
  return (rng() + rng() + rng() - 1.5) / 1.5
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Rate with a prior: a few observations only nudge the default. */
export function shrunk(hits: number, total: number, prior: number, weight = 6): number {
  return (hits + prior * weight) / (total + weight)
}

/** Draws distinct personalities; each independently gets a random skill for this table. */
export function seatBots(count: number, rng: Rng): Bot[] {
  const pool = [...BOT_ROSTER]
  const bots: Bot[] = []
  for (let i = 0; i < count && pool.length; i++) {
    const j = Math.floor(rng() * pool.length)
    const skill: BotSkill = (['rookie', 'regular', 'shark'] as const)[Math.floor(rng() * 3)]!
    bots.push({ profile: pool.splice(j, 1)[0]!, skill })
  }
  return bots
}

/**
 * Think time: a base, more for a bigger decision (`weight` 0–1), some jitter.
 * Capped so the table stays snappy.
 */
export function thinkTime(weight: number, rng: Rng, profile: BotProfile): number {
  const base = 520 + clamp(weight, 0, 1) * 1100 + rng() * 380
  // Maniacs snap, rocks and nits take their time.
  const pace = profile.style === 'maniac' ? 0.75 : profile.style === 'rock' || profile.style === 'nit' ? 1.15 : 1
  return Math.round(clamp(base * pace, 380, 2200))
}

export function initialsOf(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
