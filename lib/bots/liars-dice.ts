import { countFor, legalBids } from '@/games/liars-dice/engine'
import type { LiarsAction, LiarsBid, LiarsView } from '@/games/liars-dice/types'
import type { Rng } from '@/lib/tables/types'
import { SKILL, clamp, gauss, playingProfile, shrunk, thinkTime } from './core'
import type { Bot, BotMind, BotPolicy } from './types'

/**
 * Liar's Dice bot. It works out how likely a bid is from its own dice and the
 * unknown ones (binomial; a die matches a face with odds 1/3 counting wild 1s,
 * 1/6 for a bid on 1s), reads the bid history (a player who bid a face
 * probably holds some, discounted by how often that player has been caught
 * bluffing), keeps its own bids above its risk threshold, bluffs at its
 * profile's rate, and calls "Liar!" when the bid on the table is unlikely.
 */

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function atLeast(k: number, n: number, p: number): number {
  if (k <= 0) return 1
  if (k > n) return 0
  let prob = 0
  let term = Math.pow(1 - p, n)
  for (let i = 0; i <= n; i++) {
    if (i >= k) prob += term
    term = (term * (n - i) * p) / ((i + 1) * (1 - p))
  }
  return clamp(prob, 0, 1)
}

/** Own dice that count toward a bid on `face`. */
export function ownMatches(dice: number[], face: number): number {
  return countFor([dice], face)
}

/**
 * How likely `bid` is to be true from this seat's point of view. `lean` is the
 * extra dice of the face it believes others hold (from their bids).
 */
export function bidOdds(view: LiarsView, bid: LiarsBid, lean = 0): number {
  const unknown = view.totalDice - view.dice.length
  const p = bid.face === 1 ? 1 / 6 : 1 / 3
  const need = bid.count - ownMatches(view.dice, bid.face)
  const whole = Math.floor(lean)
  const frac = lean - whole
  // Mix the two neighbouring whole leans so a fractional belief moves the odds smoothly.
  return (1 - frac) * atLeast(need - whole, unknown, p) + frac * atLeast(need - whole - 1, unknown, p)
}

/** Dice of `face` the bot believes the other players hold beyond chance, from this round's bids. */
function leanFor(view: LiarsView, face: number, bot: Bot, mind: BotMind): number {
  const reads = SKILL[bot.skill].reads
  if (!reads) return 0
  const lastBid = new Map<number, LiarsBid>()
  for (const e of view.log) if (e.round === view.round && e.action.type === 'bid' && e.seat !== view.seat) lastBid.set(e.seat, e.action.bid)
  let lean = 0
  for (const [seat, bid] of lastBid) {
    if (bid.face !== face && !(face !== 1 && bid.face === 1)) continue
    const r = mind.reads[seat]!
    // A player often caught short earns less trust.
    const honest = 1 - shrunk(r.bidsShort, r.bidsCalled, 0.35)
    lean += 0.7 * honest * reads
  }
  return lean
}

/** Solid play: bids only what the odds support, calls when they turn. */
const IDEAL = { tightness: 0.5, aggression: 0.5, bluff: 0.15, risk: 0.4 }

function decideLiars(view: LiarsView, bot: Bot, mind: BotMind, rng: Rng): LiarsAction {
  if (view.toAct !== view.seat) throw new Error("Liar's Dice bot asked to act out of turn")
  const skill = SKILL[bot.skill]
  const profile = playingProfile(bot, IDEAL)
  const risk = clamp(profile.risk + mind.tilt * 0.3, 0, 1)
  const noise = () => gauss(rng) * skill.noise

  const current = view.bid
  const currentTrue = current ? clamp(bidOdds(view, current, leanFor(view, current.face, bot, mind)) + noise(), 0, 1) : 1

  // Raises worth considering: no more than two dice above the current bid (or the expected count when opening).
  const ceiling = current ? current.count + 2 : Math.max(2, Math.round(view.totalDice / 3) + 1)
  const options = legalBids(current, view.totalDice).filter((b) => b.count <= ceiling)
  const scored = options.map((bid) => ({
    bid,
    odds: clamp(bidOdds(view, bid, leanFor(view, bid.face, bot, mind)) + noise(), 0, 1),
    held: ownMatches(view.dice, bid.face),
  }))

  if (rng() < skill.mistakes) {
    // A rookie's wild guess: call or make the smallest raise.
    if (current && rng() < 0.5) return { type: 'liar' }
    const smallest = scored[0]
    if (smallest) return { type: 'bid', bid: smallest.bid }
  }

  // Bluff: bid a face it holds little of, as long as the bid isn't absurd.
  if (scored.length && rng() < profile.bluff * 0.5) {
    const bluffs = scored.filter((s) => s.held <= 1 && s.odds >= 0.38 - risk * 0.1)
    const pick = bluffs[Math.floor(rng() * bluffs.length)]
    if (pick && (!current || currentTrue > 0.35)) return { type: 'bid', bid: pick.bid }
  }

  const threshold = 0.55 - risk * 0.2
  // The safest raise; among near-equals prefer the smaller one so the bid climbs slowly.
  let best: (typeof scored)[number] | undefined
  for (const s of scored) {
    if (!best || s.odds > best.odds + 0.04 || (Math.abs(s.odds - best.odds) <= 0.04 && s.bid.count < best.bid.count)) best = s
  }

  if (!current) {
    // Opening: the boldest bid that still clears the threshold, on its best face.
    const safe = scored.filter((s) => s.odds >= threshold).sort((a, b) => b.bid.count - a.bid.count || b.held - a.held)
    const open = safe[Math.floor(rng() * Math.min(2, safe.length))] ?? best
    return { type: 'bid', bid: open!.bid }
  }

  if (!best) return { type: 'liar' }
  // Calling wins when the bid is short; raising wins if its own bid holds (or nobody calls it).
  // Tight players call sooner, aggressive ones would rather keep raising.
  const callBias = (profile.tightness - 0.5) * 0.3 - (profile.aggression - 0.5) * 0.2
  const callValue = 1 - currentTrue + callBias
  const raiseValue = best.odds * (1 + risk * 0.15) + 0.04
  if (callValue > raiseValue || currentTrue < 0.2) return { type: 'liar' }
  // Aggressive players jump the bid to put pressure on the next seat.
  if (rng() < profile.aggression * 0.35) {
    const jump = scored.find((s) => s.bid.face === best!.bid.face && s.bid.count === best!.bid.count + 1 && s.odds >= threshold - 0.15)
    if (jump) return { type: 'bid', bid: jump.bid }
  }
  return { type: 'bid', bid: best.bid }
}

function observeLiars(view: LiarsView, bot: Bot, mind: BotMind) {
  const reveal = view.lastReveal
  if (reveal && reveal.round > mind.lastCounted) {
    mind.lastCounted = reveal.round
    mind.tilt *= 0.7
    const short = reveal.actual < reveal.bid.count
    const caller = mind.reads[reveal.caller]!
    caller.liarCalls++
    if (short) caller.liarCallsRight++
    const bidder = mind.reads[reveal.bidder]!
    bidder.bidsCalled++
    if (short) bidder.bidsShort++
    if (reveal.loser === view.seat && view.diceCounts[view.seat]! <= 2) mind.tilt = Math.max(mind.tilt, bot.profile.tiltProne * 0.6)
  }
  mind.seen = view.log.length
}

function thinkLiars(view: LiarsView, bot: Bot, rng: Rng): number {
  // Bids late in a round, with few dice left, are the big decisions.
  const depth = view.bid ? clamp(view.bid.count / Math.max(view.totalDice / 2, 1), 0, 1) : 0.1
  return thinkTime(depth * 0.8 + (view.totalDice < 8 ? 0.2 : 0), rng, bot.profile)
}

export const liarsPolicy: BotPolicy<LiarsView, LiarsAction> = {
  decide: decideLiars,
  observe: observeLiars,
  thinkMs: thinkLiars,
}
