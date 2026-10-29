import { HAND_LABELS } from '@/games/poker-1p/engine'
import type { Card } from './types'

/**
 * Best five-card hand out of up to seven cards, scored as one number so hands
 * compare with `>`: category × 16⁵ plus the five deciding ranks (kickers
 * included), each 2–14. Equal scores split the pot.
 */
export type HandCategory = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
}

export function rankValue(card: Card): number {
  return RANK_VALUE[card.rank]!
}

/** Category names; the 1-player Poker labels where the hand is the same. */
export const CATEGORY_LABELS: Record<HandCategory, string> = {
  0: 'High Card',
  1: 'One Pair',
  2: HAND_LABELS['two-pair'],
  3: HAND_LABELS['three-of-a-kind'],
  4: HAND_LABELS.straight,
  5: HAND_LABELS.flush,
  6: HAND_LABELS['full-house'],
  7: HAND_LABELS['four-of-a-kind'],
  8: HAND_LABELS['straight-flush'],
}

function pack(category: number, ranks: number[]): number {
  let score = category
  for (let i = 0; i < 5; i++) score = score * 16 + (ranks[i] ?? 0)
  return score
}

/** Highest straight in a rank bitmask (bit r set = rank r present), 5 for the wheel, 0 if none. */
function straightHigh(mask: number): number {
  for (let high = 14; high >= 6; high--) {
    const run = 0b11111 << (high - 4)
    if ((mask & run) === run) return high
  }
  // A-2-3-4-5: the ace plays low.
  const wheel = (1 << 14) | 0b111100
  return (mask & wheel) === wheel ? 5 : 0
}

export function evaluate(cards: Card[]): number {
  const counts = new Array<number>(15).fill(0)
  const suitMasks: Record<string, number> = {}
  const suitCounts: Record<string, number> = {}
  let mask = 0
  for (const c of cards) {
    const v = RANK_VALUE[c.rank]!
    counts[v]!++
    mask |= 1 << v
    suitMasks[c.suit] = (suitMasks[c.suit] ?? 0) | (1 << v)
    suitCounts[c.suit] = (suitCounts[c.suit] ?? 0) + 1
  }

  let flushMask = 0
  for (const s in suitCounts) if (suitCounts[s]! >= 5) flushMask = suitMasks[s]!

  if (flushMask) {
    const sf = straightHigh(flushMask)
    if (sf) return pack(8, [sf])
  }

  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  const singles: number[] = []
  for (let v = 14; v >= 2; v--) {
    const n = counts[v]!
    if (n === 4) quads.push(v)
    else if (n === 3) trips.push(v)
    else if (n === 2) pairs.push(v)
    else if (n === 1) singles.push(v)
  }

  if (quads.length) {
    const kicker = Math.max(...[...trips, ...pairs, ...singles, ...quads.slice(1)], 0)
    return pack(7, [quads[0]!, kicker])
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pair = Math.max(trips[1] ?? 0, pairs[0] ?? 0)
    return pack(6, [trips[0]!, pair])
  }
  if (flushMask) {
    const ranks: number[] = []
    for (let v = 14; v >= 2 && ranks.length < 5; v--) if (flushMask & (1 << v)) ranks.push(v)
    return pack(5, ranks)
  }
  const st = straightHigh(mask)
  if (st) return pack(4, [st])
  if (trips.length) return pack(3, [trips[0]!, ...singles.slice(0, 2)])
  if (pairs.length >= 2) {
    const kicker = Math.max(pairs[2] ?? 0, singles[0] ?? 0)
    return pack(2, [pairs[0]!, pairs[1]!, kicker])
  }
  if (pairs.length) return pack(1, [pairs[0]!, ...singles.slice(0, 3)])
  return pack(0, singles.slice(0, 5))
}

export function categoryOf(score: number): HandCategory {
  return Math.floor(score / 16 ** 5) as HandCategory
}

/** "Full House", "Royal Flush", … for a score. */
export function labelOf(score: number): string {
  const cat = categoryOf(score)
  if (cat === 8 && Math.floor(score / 16 ** 4) % 16 === 14) return HAND_LABELS['royal-flush']
  return CATEGORY_LABELS[cat]
}

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const

export function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })))
}

export function shuffled<T>(items: T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}
