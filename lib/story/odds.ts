import type { GameName } from '@/store/types'
import { REEL, resolveReels } from '@/games/slots/engine'
import { HIT_MULTIPLIERS } from '@/games/keno/engine'
import { FLOOR_MULTIPLIERS } from '@/games/dragon-tower/engine'
import { getOverUnderPayoutMultiplier } from '@/games/over-under/engine'
import { dealHand, drawCards, evaluateHand, HAND_PAYOUTS, toggleHold } from '@/games/poker-1p/engine'
import type { Card as PokerCard } from '@/games/poker-1p/types'

/**
 * What one bet returns, game by game, for the story economy simulation and
 * the return check (`pnpm sim:story`). A profile is a standard way to play a
 * game (a bet type, or a stopping point in a stop-anytime game) as a list of
 * total-return multipliers and their probabilities; a missing remainder is a
 * total loss (0×).
 *
 * Numbers come from the engines' own constants wherever the game allows an
 * exact figure (`exact`), from a stated approximation (`approx`), or from a
 * Monte Carlo run of the engine (`measured`). Games whose base numbers pay out
 * more than they take get a story-only setting (`STORY_SETTINGS`), approved by
 * the owner on 2026-11-02; Freeplay, Daily, Ladder and Challenges keep the base.
 */

export interface Outcome {
  mult: number
  p: number
}

export interface BetProfile {
  id: string
  label: string
  outcomes: Outcome[]
  source: 'exact' | 'approx' | 'measured'
}

export const rtpOf = (p: BetProfile) => p.outcomes.reduce((s, o) => s + o.mult * o.p, 0)
export const lossChanceOf = (p: BetProfile) => 1 - p.outcomes.reduce((s, o) => s + o.p, 0)
/** Spread of one bet's return (its standard deviation), to rank profiles by risk. */
export function spreadOf(p: BetProfile): number {
  const mean = rtpOf(p)
  const lose = lossChanceOf(p)
  return Math.sqrt(p.outcomes.reduce((s, o) => s + o.p * (o.mult - mean) ** 2, lose * mean ** 2))
}

const r2 = (n: number) => Math.round(n * 100) / 100
const f2 = (n: number) => Math.floor(n * 100) / 100
const choose = (n: number, k: number): number => {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

// ── Base games ───────────────────────────────────────────────────────────────

function slotsProfile(pays: Partial<Record<string, number>> = {}): BetProfile {
  const total = REEL.reduce((s, r) => s + r.weight, 0)
  const by = new Map<number, number>()
  for (const a of REEL) for (const b of REEL) for (const c of REEL) {
    const p = (a.weight * b.weight * c.weight) / total ** 3
    const r = resolveReels([a.symbol, b.symbol, c.symbol])
    const mult = (r.winType ? pays[r.winType] : undefined) ?? r.multiplier
    if (mult > 0) by.set(mult, (by.get(mult) ?? 0) + p)
  }
  return { id: 'spin', label: 'One spin', outcomes: [...by].map(([mult, p]) => ({ mult, p })), source: 'exact' }
}

const PLINKO: Record<string, number[]> = {
  low: [4, 2, 1.5, 1.2, 1.0, 0.9, 0.8, 0.9, 1.0, 1.2, 1.5, 2, 4],
  medium: [8, 5, 3, 1.5, 1.0, 0.8, 0.5, 0.8, 1.0, 1.5, 3, 5, 8],
  high: [100, 15, 5, 2, 1.0, 0.5, 0, 0.5, 1.0, 2, 5, 15, 100],
}
const plinko = (risk: string): BetProfile => ({
  id: risk,
  label: `${risk} risk drop`,
  outcomes: PLINKO[risk]!.map((mult, k) => ({ mult, p: choose(12, k) / 4096 })),
  source: 'exact',
})

const crash = (target: number): BetProfile => ({ id: `cash-${target}`, label: `Cash out at ${target}×`, outcomes: [{ mult: target, p: Math.min(1, 0.95 / target) }], source: 'exact' })

const overUnder = (zone: number): BetProfile => ({ id: `zone-${zone}`, label: `${zone}% safe zone`, outcomes: [{ mult: getOverUnderPayoutMultiplier(zone), p: zone / 100 }], source: 'exact' })

/** Mines: 3 mines, cash out after `k` safe tiles; each tile's price is fair (rounded to 2 dp per step, as in the engine). `edge` scales the cash-out (story: 0.97). */
function mines(k: number, edge = 1): BetProfile {
  let p = 1
  let mult = 1
  for (let i = 0; i < k; i++) {
    p *= (22 - i) / (25 - i)
    mult = Number((mult * ((25 - i) / (22 - i))).toFixed(2))
  }
  return { id: `tiles-${k}`, label: `Cash out after ${k} safe tile${k > 1 ? 's' : ''}`, outcomes: [{ mult: edge === 1 ? mult : f2(mult * edge), p }], source: 'exact' }
}

const CHICKEN_ROAD_STEPS = [
  { multiplier: 0.9, deathChance: 0.1 },
  { multiplier: 1.5, deathChance: 0.15 },
  { multiplier: 2.0, deathChance: 0.2 },
  { multiplier: 3.0, deathChance: 0.3 },
  { multiplier: 4.5, deathChance: 0.4 },
  { multiplier: 7.0, deathChance: 0.5 },
  { multiplier: 11.0, deathChance: 0.6 },
  { multiplier: 17.0, deathChance: 0.7 },
  { multiplier: 25.0, deathChance: 0.8 },
  { multiplier: 40.0, deathChance: 0.9 },
]
/** Chance of reaching step `s` (1-based): you start on step 1; moving on from step i survives its danger. */
const reachChicken = (s: number) => CHICKEN_ROAD_STEPS.slice(0, s - 1).reduce((p, st) => p * (1 - st.deathChance), 1)
const chickenRoad = (s: number, mults: number[]): BetProfile => ({ id: `step-${s}`, label: `Cash out on step ${s}`, outcomes: [{ mult: mults[s - 1]!, p: reachChicken(s) }], source: 'exact' })

/** HiLo, one guess on the likelier side and cash out. Opening card 3–K; next card any of 13 values; a tie keeps the stake (1×). */
function hiloOneGuess(winMult: (pWin: number) => number): BetProfile {
  const tie = 1 / 13
  const outcomes: Outcome[] = []
  for (let v = 3; v <= 13; v++) {
    const pWin = Math.max(14 - v, v - 2) / 13
    outcomes.push({ mult: winMult(pWin), p: pWin / 11 })
  }
  outcomes.push({ mult: 1, p: tie })
  return { id: 'one-guess', label: 'One guess on the likelier side, then cash out', outcomes, source: 'exact' }
}

const dragonTower = (rows: number): BetProfile => ({ id: `rows-${rows}`, label: `Cash out after ${rows} row${rows > 1 ? 's' : ''}`, outcomes: [{ mult: FLOOR_MULTIPLIERS[rows - 1]!, p: (2 / 3) ** rows }], source: 'exact' })

function keno(picks: number): BetProfile {
  const outcomes: Outcome[] = []
  for (let h = 1; h <= picks; h++) {
    const p = (choose(picks, h) * choose(25 - picks, 5 - h)) / choose(25, 5)
    if (HIT_MULTIPLIERS[h]) outcomes.push({ mult: HIT_MULTIPLIERS[h]!, p })
  }
  return { id: `picks-${picks}`, label: `${picks} picks`, outcomes, source: 'exact' }
}

/** 1-Player Poker: total return is the hand's multiplier (jacks or better 1×). Measured with a plain hold strategy; `pays` replaces the pay table. */
export function measurePoker(hands = 200_000, pays: Record<string, number> = HAND_PAYOUTS): BetProfile {
  const counts = new Map<number, number>()
  const value = (c: PokerCard) => ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[c.rank] ?? Number(c.rank)
  for (let n = 0; n < hands; n++) {
    let s = dealHand(1)
    const ranks = s.hand.map(value)
    const suits = s.hand.map((c) => c.suit)
    const suitCount = new Map<string, number>()
    suits.forEach((x) => suitCount.set(x, (suitCount.get(x) ?? 0) + 1))
    const flushSuit = [...suitCount].find(([, k]) => k >= 4)?.[0]
    let hold: number[]
    if (flushSuit) hold = s.hand.flatMap((c, i) => (c.suit === flushSuit ? [i] : []))
    else hold = ranks.flatMap((r, i) => (r >= 11 ? [i] : []))
    for (const i of hold) s = toggleHold(s, i)
    s = drawCards(s)
    const mult = pays[evaluateHand(s.hand)] ?? 0
    if (mult > 0) counts.set(mult, (counts.get(mult) ?? 0) + 1)
  }
  return { id: 'hand', label: 'One hand, plain holds', outcomes: [...counts].map(([mult, k]) => ({ mult, p: k / hands })), source: 'measured' }
}

export const BASE_ODDS: Record<GameName, BetProfile[]> = {
  blackjack: [{ id: 'basic', label: 'Basic strategy', outcomes: [{ mult: 2, p: 0.396 }, { mult: 2.5, p: 0.045 }, { mult: 1, p: 0.085 }], source: 'approx' }],
  crash: [crash(1.5), crash(2), crash(10)],
  plinko: [plinko('low'), plinko('medium'), plinko('high')],
  'over-under': [overUnder(40), overUnder(10)],
  wheel: [
    { id: 'red', label: 'Red', outcomes: [{ mult: 2, p: 6 / 12 }], source: 'exact' },
    { id: 'gold', label: 'Gold', outcomes: [{ mult: 5, p: 1 / 12 }], source: 'exact' },
  ],
  'run-dice': [{ id: 'roll', label: 'One run (2 win sums of 3 loss sums)', outcomes: [{ mult: r2(Math.max(1 / 0.222, 1.05) * 0.92), p: 0.222 }], source: 'approx' }],
  mines: [mines(1), mines(3), mines(6)],
  'chicken-road': [2, 3, 5].map((s) => chickenRoad(s, CHICKEN_ROAD_STEPS.map((x) => x.multiplier))),
  slots: [slotsProfile()],
  roulette: [
    { id: 'red', label: 'Red', outcomes: [{ mult: 2, p: 18 / 37 }], source: 'exact' },
    { id: 'dozen', label: 'A dozen', outcomes: [{ mult: 3, p: 12 / 37 }], source: 'exact' },
    { id: 'straight', label: 'Straight up', outcomes: [{ mult: 36, p: 1 / 37 }], source: 'exact' },
  ],
  'dragon-tower': [dragonTower(1), dragonTower(3)],
  'chicken-race': [{ id: 'pick', label: 'Pick a chicken', outcomes: [{ mult: 3.6, p: 0.25 }], source: 'exact' }],
  'street-cups': [{ id: 'pick', label: 'Pick a cup', outcomes: [{ mult: 2.5, p: 1 / 3 }], source: 'exact' }],
  'case-battles': [{ id: 'battle', label: 'One battle', outcomes: [{ mult: 1.88, p: 0.5 }], source: 'approx' }],
  'poker-1p': [], // filled by measurePoker() in the simulator
  hilo: [hiloOneGuess(() => 2)],
  keno: [keno(5), keno(2)],
  'coin-flip': [
    { id: 'one', label: 'Cash out after one win', outcomes: [{ mult: 2, p: 0.5 }], source: 'exact' },
    { id: 'three', label: 'Ride three wins', outcomes: [{ mult: 8, p: 0.125 }], source: 'exact' },
  ],
  'deck-countdown': [{ id: 'three', label: 'Cash out after 3 safe flips', outcomes: [{ mult: r2(0.97 / ((48 / 51) * (44 / 50) * (40 / 49))), p: (48 / 51) * (44 / 50) * (40 / 49) }], source: 'approx' }],
  'tower-of-cards': [{ id: 'colour', label: 'Call the colour, cash out', outcomes: [{ mult: 1.94, p: 0.5 }], source: 'exact' }],
  baccarat: [
    { id: 'banker', label: 'Banker', outcomes: [{ mult: 1.95, p: 0.4586 }, { mult: 1, p: 0.0952 }], source: 'exact' },
    { id: 'tie', label: 'Tie', outcomes: [{ mult: 9, p: 0.0952 }], source: 'exact' },
  ],
  'sic-bo': [
    { id: 'big', label: 'Big', outcomes: [{ mult: 2, p: 0.4861 }], source: 'exact' },
    { id: 'triple', label: 'Any triple', outcomes: [{ mult: 31, p: 6 / 216 }], source: 'exact' },
  ],
  'andar-bahar': [{ id: 'side', label: 'Andar or Bahar', outcomes: [{ mult: 1.95, p: 0.5 }], source: 'approx' }],
  'dragon-tiger': [
    { id: 'dragon', label: 'Dragon', outcomes: [{ mult: 2, p: 6 / 13 }], source: 'approx' },
    { id: 'tie', label: 'Tie', outcomes: [{ mult: 12, p: 1 / 13 }], source: 'approx' },
  ],
}

// ── Story-only settings ──────────────────────────────────────────────────────

/** Target return for the story versions of games whose base numbers pay out more than they take. */
export const STORY_TARGET_RTP = 0.96

/** Chicken Road in story: step multipliers priced so cashing out on any step returns 96%; step 1 stays 0.9×. */
export const STORY_CHICKEN_ROAD_MULTS = CHICKEN_ROAD_STEPS.map((st, i) => (i === 0 ? st.multiplier : f2(STORY_TARGET_RTP / reachChicken(i + 1))))

/** HiLo in story: a right guess pays (0.96 − tie chance) ÷ its own chance, so one guess returns 96% whatever the card. */
export const storyHiloMult = (pWin: number) => f2((STORY_TARGET_RTP - 1 / 13) / pWin)

/** Slots in story: three cherries 4× (base 5), three bells 12× (15), three diamonds 24× (25). About 96.4%. */
export const STORY_SLOTS_PAYS: Record<string, number> = { 'Three Cherries': 4, 'Three Bells': 12, 'Three Diamonds': 24 }

/** Mines in story: every cash-out pays 97% of the fair price (the base game is fair, and its rounding tips some stops over 100%). */
export const STORY_MINES_EDGE = 0.97

/**
 * 1-Player Poker in story: the base game returns about 48% (jacks or better only
 * gives the stake back, and the dealt hand never pays). Story pays a classic
 * draw-poker table, total return per stake: about 96% with plain holds (the dealt hand
 * never holds a pair, so the table pays more than a casino's).
 */
export const STORY_POKER_PAYS: Record<string, number> = {
  'royal-flush': 800, 'straight-flush': 150, 'four-of-a-kind': 50, 'full-house': 18, flush: 12, straight: 10, 'three-of-a-kind': 6, 'two-pair': 4, 'jacks-or-better': 2, none: 0,
}

export const STORY_SETTINGS: Partial<Record<GameName, BetProfile[]>> = {
  mines: [mines(1, STORY_MINES_EDGE), mines(3, STORY_MINES_EDGE), mines(6, STORY_MINES_EDGE)],
  'chicken-road': [2, 3, 5].map((s) => chickenRoad(s, STORY_CHICKEN_ROAD_MULTS)),
  hilo: [hiloOneGuess(storyHiloMult)],
  slots: [slotsProfile(STORY_SLOTS_PAYS)],
}

/** The profiles a game plays with in story mode. */
export function storyOdds(game: GameName, poker: BetProfile[]): BetProfile[] {
  if (game === 'poker-1p') return poker
  return STORY_SETTINGS[game] ?? BASE_ODDS[game]
}
