import type { Action, View } from '@/games/liars-dice/types'
import type { BotMind } from './core'
import type { BotProfile } from './core'
import { noiseFor } from './core'

export function decideLiarsDice(view: View, mind: BotMind, profile:BotProfile, rng: () => number): Action {
  const own = view.ownDice
  const unknown = view.diceCounts.reduce((n, count, seat) => n + (view.active[seat] && seat !== view.seat ? count : 0), 0)
  const face = [...own].sort((a,b) => own.filter(x => x === b).length - own.filter(x => x === a).length)[0] ?? 2
  const odds = face === 1 ? 1 / 6 : 1 / 3
  const expected = own.filter(d => d === face || face !== 1 && d === 1).length + unknown * odds
  const bid = view.bid
  const noise=noiseFor(profile.tier)
  if (bid && expected < bid.count - (0.8 + rng() * (1+noise)) && rng() > profile.bluffRate + noise*.12) return { type: 'liar' }
  const target = Math.max(bid?.count ?? 1, Math.round(expected + (rng() < profile.bluffRate*(1+noise) ? 2 : 0)))
  for (let count = target; count <= 30; count++) for (let f = face; f <= 6; f++) {
    const raise = !bid || (f === 1 ? (bid.face === 1 ? count > bid.count : count >= Math.ceil(bid.count / 2)) : bid.face === 1 ? count >= bid.count * 2 + 1 : count > bid.count || count === bid.count && f > bid.face)
    if (raise) return { type: 'bid', count, face: f as 1|2|3|4|5|6 }
  }
  return { type: 'liar' }
}
