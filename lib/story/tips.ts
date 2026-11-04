import { GAME_BY_NAME } from '@/lib/game-catalog'
import { rtpOf, storyOdds, type BetProfile } from './odds'
import type { GameName } from '@/store/types'
import { createRng, seedFromString } from '@/utils/rng'

/**
 * Jo's read on tonight's games (owner decision 2026-11-04): a nudge, not a table of
 * odds. From the games on in your room tonight, Jo names the one that is kindest to a
 * player (its best bet returns the most) with a hint at how to play it, and the one
 * the house built for itself. No numbers, and the wording changes night to night.
 */

const label = (g: GameName) => GAME_BY_NAME.get(g)?.label ?? g

/** Each game's best bet in story mode (poker's needs a slow measurement, so Jo skips it). */
function bestBet(game: GameName): BetProfile | null {
  const bets = storyOdds(game, [])
  if (!bets?.length) return null
  return bets.reduce((a, b) => (rtpOf(b) > rtpOf(a) ? b : a))
}

/** A hint at how to play the best bet, read from its name, without saying why. */
function howTo(bet: BetProfile): string {
  const l = bet.label.toLowerCase()
  if (/cash out|then cash out/.test(l)) return 'Take your money early and walk.'
  if (/basic strategy/.test(l)) return 'Play it by the book.'
  if (/low risk|safe zone|red|big|banker|andar|colour/.test(l)) return 'Stick to the plain bets.'
  return ''
}

const GOOD = [
  (g: string) => `${g} has been treating people fair tonight.`,
  (g: string) => `If I had to sit somewhere tonight, ${g}.`,
  (g: string) => `${g}'s the honest one in the room.`,
]
const BAD = [
  (g: string) => `${g}? The house built that one for itself.`,
  (g: string) => `I'd walk past ${g}. Pretty lights, empty pockets.`,
  (g: string) => `${g} eats beginners. Leave it to the tourists.`,
]

/** Jo's two lines on tonight's games, or none when there's nothing to tell apart. Seeded by town and night. */
export function joTips(games: GameName[], city: string, night: number): string[] {
  const rated = games.flatMap((g) => {
    const bet = bestBet(g)
    return bet ? [{ game: g, bet, rtp: rtpOf(bet) }] : []
  })
  if (rated.length < 2) return []
  rated.sort((a, b) => b.rtp - a.rtp)
  const kind = rated[0]!
  const harsh = rated[rated.length - 1]!
  if (kind.rtp - harsh.rtp < 0.01) return []
  const rng = createRng(seedFromString(`tips:${city}:${night}`))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]!
  return [`${pick(GOOD)(label(kind.game))} ${howTo(kind.bet)}`.trim(), pick(BAD)(label(harsh.game))]
}
