import { calculateHandValue } from '@/games/blackjack/engine'
import type { Card, ShowdownAction, ShowdownView } from '@/games/blackjack-showdown/types'
import type { Rng } from '@/lib/tables/types'
import { SKILL, clamp, gauss, playingProfile, thinkTime } from './core'
import type { Bot, BotMind, BotPolicy } from './types'

/**
 * Blackjack Showdown bot. Plays its hands by basic strategy (for this table:
 * dealer stands on all 17s, double on two cards, no split) and sizes its bets
 * from where it stands: the leader bets small or mirrors the chasers so the
 * cards hit everyone alike, chasers swing bigger as the hands run out, and the
 * secret final bet is made against the stacks it can see.
 */

function cardValue(c: Card): number {
  return c.rank === 'A' ? 11 : c.rank === 'J' || c.rank === 'Q' || c.rank === 'K' ? 10 : parseInt(c.rank, 10)
}

/** Total and whether an ace still counts 11. */
function handShape(cards: Card[]): { total: number; soft: boolean } {
  const hard = cards.reduce((sum, c) => sum + (c.rank === 'A' ? 1 : cardValue(c)), 0)
  const soft = cards.some((c) => c.rank === 'A') && hard + 10 <= 21
  return { total: soft ? hard + 10 : hard, soft }
}

export type BasicMove = 'hit' | 'stand' | 'double'

/** Basic strategy for the solo game's rules. `up` is the dealer's up card (2–11). */
export function basicStrategy(cards: Card[], up: number): BasicMove {
  const { total, soft } = handShape(cards)
  const two = cards.length === 2
  const dbl = (fallback: BasicMove): BasicMove => (two ? 'double' : fallback)
  if (soft) {
    if (total >= 19) return 'stand'
    if (total === 18) return up >= 3 && up <= 6 ? dbl('stand') : up <= 8 ? 'stand' : 'hit'
    if (total === 17) return up >= 3 && up <= 6 ? dbl('hit') : 'hit'
    if (total >= 15) return up >= 4 && up <= 6 ? dbl('hit') : 'hit'
    return up >= 5 && up <= 6 ? dbl('hit') : 'hit'
  }
  if (total >= 17) return 'stand'
  if (total >= 13) return up <= 6 ? 'stand' : 'hit'
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit'
  if (total === 11) return up <= 10 ? dbl('hit') : 'hit'
  if (total === 10) return up <= 9 ? dbl('hit') : 'hit'
  if (total === 9) return up >= 3 && up <= 6 ? dbl('hit') : 'hit'
  return 'hit'
}

/** Solid tournament play: steady bets, bold only when the standings call for it. */
const IDEAL = { tightness: 0.5, aggression: 0.5, bluff: 0, risk: 0.5 }

const round10 = (n: number) => Math.round(n / 10) * 10

function decideBet(view: ShowdownView, bot: Bot, mind: BotMind, rng: Rng): number {
  const legal = view.legal!.bet!
  const skill = SKILL[bot.skill]
  const risk = clamp(playingProfile(bot, IDEAL).risk + mind.tilt * 0.3, 0, 1)
  const me = view.seats[view.seat]!
  const others = view.seats.filter((s, i) => i !== view.seat && !s.out)
  const left = view.config.hands - view.hand + 1
  const max = legal.max
  const clampBet = (n: number) => clamp(round10(n), legal.min, max)

  // Rookies often bet what feels right, whatever the standings say.
  if (bot.skill === 'rookie' && rng() < 0.5) return clampBet(me.stack * (0.05 + rng() * 0.2))
  if (rng() < skill.mistakes * 2) return clampBet(legal.min + rng() * (max - legal.min))
  // What it likes to bet when nothing presses: more for a bolder player.
  const base = me.stack * (0.04 + risk * 0.12)

  const stacks = others.map((s) => s.stack).sort((a, b) => b - a)
  const leader = stacks[0] ?? 0
  const second = stacks[1] ?? 0
  const lead = me.stack - leader
  // The paid places: aim for the top, settle for the cash if the top is out of reach.
  const paid = 2

  if (view.secretBets) {
    // The final hand: nobody sees anyone else's bet.
    if (lead > 0) {
      // Leading: if a chaser's best (a max-bet blackjack) can't catch us, sit tight.
      const chaserMax = Math.min(view.config.maxBet, leader) * 1.5
      if (lead > chaserMax) return legal.min
      // Otherwise bet so that winning keeps us ahead of a chaser who also wins.
      return clampBet(Math.min(view.config.maxBet, leader) - lead + 20)
    }
    const deficit = -lead + 10
    if (deficit <= max) return clampBet(deficit + (risk > 0.5 ? max * 0.3 : 0))
    // Can't catch the leader: protect or chase the last paid place.
    const rank = stacks.filter((s) => s > me.stack).length + 1
    if (rank <= paid && me.stack - (stacks[paid - 1] ?? 0) > view.config.maxBet * 1.5) return legal.min
    return max
  }

  // Leader protects: copy the biggest bet already placed so the cards treat both alike.
  const placed = others.filter((s) => s.bet != null && s.bet > 0).map((s) => s.bet!)
  if (lead > 0) {
    const cushion = lead / Math.max(left, 1)
    if (cushion > view.config.maxBet * 0.6) return legal.min
    if (placed.length) return clampBet(Math.max(...placed))
    return clampBet(base * 0.6)
  }

  // Chasing: the gap spread over the hands left, swinging harder as they run out.
  const target = me.stack < second ? second : leader
  const deficit = target - me.stack + 10
  const perHand = deficit / Math.max(left, 1)
  const urgency = 1 + (1 - left / view.config.hands) * 1.5
  const bet = perHand * urgency * (0.8 + risk * 0.8) + gauss(rng) * skill.noise * max
  return clampBet(Math.max(bet, base))
}

function decidePlay(view: ShowdownView, bot: Bot, mind: BotMind, rng: Rng): ShowdownAction {
  const legal = view.legal!
  const me = view.seats[view.seat]!
  const skill = SKILL[bot.skill]
  const upCard = view.dealer[0]
  const up = upCard ? cardValue(upCard) : 10
  if (bot.skill === 'rookie' && rng() < 0.5) {
    // The rookie's "never bust": stand on any hard 12 or more, never double.
    const { total, soft } = handShape(me.cards)
    return total >= 12 && !soft ? { type: 'stand' } : total >= 18 ? { type: 'stand' } : { type: 'hit' }
  }
  if (rng() < skill.mistakes) {
    // A hunch.
    return calculateHandValue(me.cards) >= 15 ? { type: 'stand' } : { type: 'hit' }
  }
  let move = basicStrategy(me.cards, up)
  // Far behind on the last hands: double more freely to catch up.
  const others = view.seats.filter((s, i) => i !== view.seat && !s.out)
  const leader = Math.max(0, ...others.map((s) => s.stack))
  const behind = leader - me.stack
  const left = view.config.hands - view.hand
  const { total } = handShape(me.cards)
  if (move === 'hit' && legal.canDouble && left <= 1 && behind > (me.bet ?? 0) && total >= 8 && total <= 11 + Math.round(bot.profile.risk * 3)) {
    move = 'double'
  }
  if (mind.tilt > 0.4 && move === 'stand' && total <= 14 && rng() < mind.tilt * 0.3) move = 'hit'
  if (move === 'double' && !legal.canDouble) move = total >= 18 ? 'stand' : 'hit'
  return { type: move }
}

function decideShowdown(view: ShowdownView, bot: Bot, mind: BotMind, rng: Rng): ShowdownAction {
  const legal = view.legal
  if (!legal) throw new Error('Showdown bot asked to act out of turn')
  if (legal.bet) return { type: 'bet', amount: decideBet(view, bot, mind, rng) }
  return decidePlay(view, bot, mind, rng)
}

function observeShowdown(view: ShowdownView, bot: Bot, mind: BotMind) {
  if (view.phase !== 'handOver' && view.phase !== 'over') return
  if (view.hand <= mind.lastCounted) return
  mind.lastCounted = view.hand
  mind.tilt *= 0.6
  const me = view.seats[view.seat]!
  if (me.net < 0 && -me.net >= (me.stack - me.net) * 0.25) mind.tilt = Math.max(mind.tilt, bot.profile.tiltProne)
}

function thinkShowdown(view: ShowdownView, bot: Bot, rng: Rng): number {
  const weight = view.phase === 'betting' ? (view.secretBets ? 0.9 : 0.35) : 0.15
  return thinkTime(weight, rng, bot.profile)
}

export const showdownPolicy: BotPolicy<ShowdownView, ShowdownAction> = {
  decide: decideShowdown,
  observe: observeShowdown,
  thinkMs: thinkShowdown,
}
