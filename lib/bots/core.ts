export type BotTier = 'Rookie' | 'Regular' | 'Shark'
export interface BotProfile { name: string; tier: BotTier; tightness: number; aggression: number; bluffRate: number; risk: number }
export interface BotMind { handsSeen: number; raisesSeen: number; bluffsCaught: number; tilt: number }
export type BotPolicy<View, Action> = (view: View, mind: BotMind, rng: () => number) => Action

export const freshBotMind = (): BotMind => ({ handsSeen: 0, raisesSeen: 0, bluffsCaught: 0, tilt: 0 })
export function noiseFor(tier: BotTier): number { return tier === 'Rookie' ? 0.4 : tier === 'Regular' ? 0.18 : 0.06 }
export function thinkDelay(rng: () => number, important = false): number { return 250 + Math.floor(rng() * (important ? 750 : 350)) }
