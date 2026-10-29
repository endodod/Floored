import { evaluate, fullDeck, rankValue, sameCard } from '@/games/holdem/evaluator'
import type { Card, HoldemAction, HoldemView } from '@/games/holdem/types'
import type { Rng } from '@/lib/tables/types'
import { SKILL, clamp, gauss, playingProfile, shrunk, thinkTime } from './core'
import type { Bot, BotMind, BotPolicy } from './types'

/**
 * Hold'em bot. Pre-flop it ranks its two cards with the Chen formula and
 * opens, calls or 3-bets by position and profile; short-stacked it switches to
 * push / fold. After the flop it estimates its equity by Monte Carlo against
 * the ranges it puts opponents on (from what it has seen them do), weighs it
 * against the pot odds and stack-to-pot ratio, sizes bets from its style's
 * family, and bluffs at its profile's rate — more on dry boards.
 */

// ── Hand strength ────────────────────────────────────────────────────────────

/** Chen formula: about −1 (7-2 offsuit) to 20 (aces). */
export function chen(a: Card, b: Card): number {
  const hi = Math.max(rankValue(a), rankValue(b))
  const lo = Math.min(rankValue(a), rankValue(b))
  const points = (v: number) => (v === 14 ? 10 : v === 13 ? 8 : v === 12 ? 7 : v === 11 ? 6 : v / 2)
  if (hi === lo) return Math.max(5, points(hi) * 2)
  let score = points(hi)
  if (a.suit === b.suit) score += 2
  const gap = hi - lo - 1
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  if (gap <= 1 && hi < 12) score += 1
  return Math.ceil(score)
}

/**
 * Share of the pot this hand wins on average against `opponents` hands, each
 * drawn at random but only from hands with at least that Chen score.
 */
export function estimateEquity(hole: Card[], board: Card[], opponents: number[], samples: number, rng: Rng): number {
  const known = [...hole, ...board]
  const deck = fullDeck().filter((c) => !known.some((k) => sameCard(k, c)))
  let total = 0
  for (let s = 0; s < samples; s++) {
    const d = [...deck]
    let top = d.length
    const take = () => {
      const j = Math.floor(rng() * top)
      top--
      ;[d[j], d[top]] = [d[top]!, d[j]!]
      return d[top]!
    }
    const hands: Card[][] = []
    for (const minChen of opponents) {
      let hand = [take(), take()]
      // Rejection sampling into the range, a few tries before settling for any hand.
      for (let t = 0; t < 6 && chen(hand[0]!, hand[1]!) < minChen; t++) {
        top += 2
        hand = [take(), take()]
      }
      hands.push(hand)
    }
    const full = [...board]
    while (full.length < 5) full.push(take())
    const mine = evaluate([...hole, ...full])
    let best = true
    let ties = 1
    for (const h of hands) {
      const theirs = evaluate([...h, ...full])
      if (theirs > mine) {
        best = false
        break
      }
      if (theirs === mine) ties++
    }
    if (best) total += 1 / ties
  }
  return total / samples
}

/** Flush or straight draws on board make it wet; bluffs work better on dry boards. */
function boardWetness(board: Card[]): number {
  if (board.length < 3) return 0.5
  const suits: Record<string, number> = {}
  for (const c of board) suits[c.suit] = (suits[c.suit] ?? 0) + 1
  const flushy = Math.max(...Object.values(suits)) >= 3 ? 0.5 : Math.max(...Object.values(suits)) === 2 ? 0.15 : 0
  const ranks = [...new Set(board.map(rankValue))].sort((x, y) => x - y)
  let connected = 0
  for (let i = 0; i + 2 < ranks.length; i++) if (ranks[i + 2]! - ranks[i]! <= 4) connected = 0.4
  return clamp(flushy + connected, 0, 1)
}

// ── Table reading ────────────────────────────────────────────────────────────

/** 0 = first to act pre-flop, 1 = the button. */
function lateness(view: HoldemView): number {
  const n = view.seats.length
  const order: number[] = []
  for (let k = 1; k <= n; k++) {
    const i = (view.button + k) % n
    if (!view.seats[i]!.out) order.push(i)
  }
  const idx = order.indexOf(view.seat)
  const count = order.length
  if (idx === count - 1) return 1
  if (count === 2) return 0.4
  if (idx === 0) return 0.3
  if (idx === 1) return 0.4
  return count > 3 ? (idx - 2) / (count - 3) : 1
}

function handLog(view: HoldemView) {
  return view.log.filter((e) => e.hand === view.hand)
}

/** Lowest Chen score an opponent's range allows, from what it did this hand and what the bot has seen of it. */
function rangeFloor(view: HoldemView, seat: number, bot: Bot, mind: BotMind): number {
  const reads = SKILL[bot.skill].reads
  const acts = handLog(view).filter((e) => e.seat === seat && e.street === 'preflop')
  const raised = acts.some((e) => e.kind === 'raise' || e.kind === 'bet' || e.kind === 'all-in')
  const called = acts.some((e) => e.kind === 'call')
  const r = mind.reads[seat]!
  if (raised) {
    const pfr = shrunk(r.pfr, r.hands, 0.18)
    return 8 * (1 - reads) + clamp(13 - pfr * 25, 4, 12) * reads
  }
  if (called) {
    const vpip = shrunk(r.vpip, r.hands, 0.35)
    return 4 * (1 - reads) + clamp(9 - vpip * 12, 0, 8) * reads
  }
  return -Infinity
}

/** How often a seat bets or raises after the flop rather than calls. */
function aggressionOf(mind: BotMind, seat: number): number {
  const r = mind.reads[seat]!
  return shrunk(r.aggressive, r.aggressive + r.passive, 0.45)
}

/** Solid Sit & Go play: fairly loose and aggressive, bluffs now and then. */
const IDEAL = { tightness: 0.45, aggression: 0.8, bluff: 0.25, risk: 0.55 }

// ── Decisions ────────────────────────────────────────────────────────────────

function raiseTo(view: HoldemView, to: number): HoldemAction {
  const legal = view.legal!
  if (legal.minRaiseTo == null || legal.maxRaiseTo == null) return legal.canCheck ? { type: 'check' } : { type: 'call' }
  let amount = Math.round(clamp(to, legal.minRaiseTo, legal.maxRaiseTo))
  // Close to all-in anyway: just shove.
  if (amount >= legal.maxRaiseTo * 0.8) amount = legal.maxRaiseTo
  return { type: 'raise', to: amount }
}

const passive = (view: HoldemView): HoldemAction => (view.legal!.canCheck ? { type: 'check' } : { type: 'fold' })

function decideHoldem(view: HoldemView, bot: Bot, mind: BotMind, rng: Rng): HoldemAction {
  const legal = view.legal
  if (!legal) throw new Error('Hold’em bot asked to act out of turn')
  const skill = SKILL[bot.skill]
  const me = view.seats[view.seat]!
  const hole = me.hole!

  // A plain misplay now and then (rookies mostly).
  if (rng() < skill.mistakes) {
    const roll = rng()
    if (roll < 0.4) return legal.canCheck ? { type: 'check' } : { type: 'call' }
    if (roll < 0.7) return passive(view)
  }

  const tilt = mind.tilt
  const profile = playingProfile(bot, IDEAL)
  // Rookies call too much.
  const loose = bot.skill === 'rookie' ? 0.08 : 0
  const tightness = clamp(profile.tightness - tilt * 0.35, 0, 1)
  const aggression = clamp(profile.aggression + tilt * 0.3, 0, 1)
  const bluff = clamp(profile.bluff + tilt * 0.2, 0, 1)
  const bb = view.bigBlind
  const others = view.seats.filter((s, i) => i !== view.seat && !s.out && !s.folded)
  const effective = Math.min(me.stack + me.bet, Math.max(...others.map((s) => s.stack + s.bet)))
  const stackBB = effective / bb
  const late = lateness(view)

  if (view.street === 'preflop') {
    const strength = chen(hole[0]!, hole[1]!) + gauss(rng) * skill.noise * 12
    const raiseLevel = view.currentBet / bb
    const facingRaise = raiseLevel > 1

    if (stackBB <= 12) {
      // Push / fold.
      const callers = others.filter((s) => !s.allIn).length
      if (facingRaise) {
        const need = 9.5 + tightness * 2.5 - (stackBB < 6 ? 2 : 0) - (legal.toCall < me.stack * 0.3 ? 2 : 0)
        return strength >= need ? (legal.toCall >= me.stack ? { type: 'call' } : raiseTo(view, me.bet + me.stack)) : passive(view)
      }
      const need = 10.5 - (12 - stackBB) * 0.4 - late * 2.5 - aggression * 1.5 + tightness * 2 + Math.max(0, callers - 2) * 0.6
      return strength >= need ? raiseTo(view, me.bet + me.stack) : passive(view)
    }

    if (!facingRaise) {
      const open = 7 + tightness * 4 - late * 3 - aggression * 1.5
      const limpers = handLog(view).filter((e) => e.street === 'preflop' && e.kind === 'call').length
      if (strength >= open) return raiseTo(view, bb * (2.5 + limpers + (profile.style === 'maniac' ? 1 : 0)))
      if (legal.canCheck) return { type: 'check' }
      // Calling stations limp along.
      if (strength >= open - 2.5 + aggression * 2 && legal.toCall <= bb) return { type: 'call' }
      if (rng() < bluff * 0.25 * late) return raiseTo(view, bb * 3)
      return { type: 'fold' }
    }

    const threeBet = 11 + tightness * 3 - aggression * 2.5 + Math.min(raiseLevel / 6, 3)
    const callBar =
      7.5 - loose * 25 + tightness * 3 + Math.log2(Math.max(raiseLevel / 2.5, 1)) * 1.5 - (profile.style === 'station' ? 2.5 : 0) - late
    if (strength >= threeBet) return raiseTo(view, view.currentBet * 3)
    if (strength >= callBar && legal.toCall <= me.stack) return legal.canCheck ? { type: 'check' } : { type: 'call' }
    if (rng() < bluff * 0.12 * late && raiseLevel < 4) return raiseTo(view, view.currentBet * 3)
    return passive(view)
  }

  // ── After the flop ──
  const opponents = others.map((o) => view.seats.indexOf(o))
  // Rookies play against random hands; the others narrow each opponent to a range.
  const floors = opponents.map((i) => (bot.skill === 'rookie' ? -Infinity : rangeFloor(view, i, bot, mind)))
  const equity = clamp(estimateEquity(hole, view.board, floors, skill.samples, rng) + gauss(rng) * skill.noise, 0, 1)
  const fair = 1 / (others.length + 1)
  const rel = equity / fair
  const pot = view.pot
  const spr = me.stack / Math.max(pot, 1)
  const dry = 1 - boardWetness(view.board)
  const family = profile.style === 'maniac' ? 0.85 : profile.style === 'station' ? 0.4 : profile.style === 'rock' ? 0.66 : 0.55

  if (legal.canCheck) {
    if (rel >= 1.35 - aggression * 0.25) {
      if (spr < 1.2 && rel >= 1.5) return raiseTo(view, me.bet + me.stack)
      const size = pot * (rel > 1.7 ? family + 0.2 : family) * (dry > 0.6 ? 0.8 : 1)
      return raiseTo(view, Math.max(bb, size))
    }
    const bluffChance = bluff * (0.35 + dry * 0.65) * (others.length === 1 ? 1 : 0.4) * (view.street === 'river' ? 0.8 : 1)
    if (rng() < bluffChance) return raiseTo(view, Math.max(bb, pot * family))
    return { type: 'check' }
  }

  // Facing a bet: pot odds, adjusted for who is betting.
  const odds = legal.toCall / (pot + legal.toCall)
  const bettor = [...handLog(view)].reverse().find((e) => e.kind === 'bet' || e.kind === 'raise' || e.kind === 'all-in')
  const bettorAgg = bettor ? aggressionOf(mind, bettor.seat) : 0.45
  // A seat that bets everything gets called lighter; sharks lean on this most.
  const readEdge = (bettorAgg - 0.45) * 0.25 * skill.reads
  const margin = 0.04 + tightness * 0.06 - (profile.style === 'station' ? 0.1 : 0) - readEdge - loose
  if (rel >= 1.6 - aggression * 0.2 && legal.minRaiseTo != null) {
    if (spr < 1.5) return raiseTo(view, me.bet + me.stack)
    return raiseTo(view, view.currentBet * 3)
  }
  if (equity >= odds + margin) return { type: 'call' }
  if (rng() < bluff * 0.1 * dry && legal.minRaiseTo != null && others.length === 1) return raiseTo(view, view.currentBet * 3)
  return { type: 'fold' }
}

// ── Watching the table ───────────────────────────────────────────────────────

function observeHoldem(view: HoldemView, bot: Bot, mind: BotMind) {
  for (let k = mind.seen; k < view.log.length; k++) {
    const e = view.log[k]!
    if (e.hand > mind.lastCounted) {
      mind.lastCounted = e.hand
      mind.marks = {}
      mind.tilt *= 0.6
      view.seats.forEach((s, i) => {
        if (!s.out) mind.reads[i]!.hands++
      })
    }
    const r = mind.reads[e.seat]!
    const voluntary = e.kind === 'call' || e.kind === 'raise' || e.kind === 'bet' || e.kind === 'all-in'
    if (e.street === 'preflop') {
      if (voluntary && !mind.marks[`v${e.seat}`]) {
        mind.marks[`v${e.seat}`] = true
        r.vpip++
      }
      if ((e.kind === 'raise' || e.kind === 'all-in') && !mind.marks[`r${e.seat}`]) {
        mind.marks[`r${e.seat}`] = true
        r.pfr++
      }
    } else if (e.kind === 'bet' || e.kind === 'raise' || e.kind === 'all-in') r.aggressive++
    else if (e.kind === 'call') r.passive++
  }
  mind.seen = view.log.length

  // A big loss tilts it for a few hands.
  const result = view.lastResult
  if (result && !mind.marks[`t${result.hand}`] && view.phase !== 'betting') {
    mind.marks[`t${result.hand}`] = true
    const net = result.net[view.seat] ?? 0
    const before = view.seats[view.seat]!.stack - net
    if (net < 0 && -net > before * 0.3) mind.tilt = Math.max(mind.tilt, bot.profile.tiltProne)
  }
}

function thinkHoldem(view: HoldemView, bot: Bot, rng: Rng): number {
  const legal = view.legal
  const me = view.seats[view.seat]!
  const weight = legal ? clamp((legal.toCall / Math.max(me.stack, 1)) * 2, 0, 1) * 0.7 + (view.street === 'river' ? 0.3 : view.street === 'preflop' ? 0 : 0.15) : 0
  return thinkTime(weight, rng, bot.profile)
}

export const holdemPolicy: BotPolicy<HoldemView, HoldemAction> = {
  decide: decideHoldem,
  observe: observeHoldem,
  thinkMs: thinkHoldem,
}
