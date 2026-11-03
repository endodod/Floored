/**
 * Story mode economy check (.md/STORY_MODE_PLAN.md sections 1 and 5).
 *
 * 1. Return check: every game's standard bets, base and story settings. A story
 *    bet returning more than 100% fails the run (fair 100% bets are allowed).
 * 2. Circuit simulation: thousands of whole circuits (12 cities) for five player
 *    types, using each city's real game list, the economy constants and the
 *    odds above. Standing is modelled per town: every town starts the player in
 *    the dive, TABLE_JOBS_PER_CITY table jobs lift standing one each (minigame
 *    jobs do not), a bust takes one off, and the player moves up to the best room
 *    their standing opens (their own preferred room or lower). Prints nights per
 *    city and over the circuit, busts, boss tries, and recovery time after a bust,
 *    and checks the plan's targets.
 *
 *   pnpm sim:story                 3,000 circuits per player type
 *   pnpm sim:story 500 --seed 7    fewer circuits, another seed
 */
import { CITIES, type City } from '@/lib/story/cities'
import { gamesFor } from '@/lib/story/rotation'
import {
  BOSS_BUYIN_M, BOSS_PURSE_M, BOSS_REMATCH_NIGHTS, BUST_STANDING, CAR_BELOW_M, COMPS_CAP_M, COMPS_RATE, ERRAND_PAY_M, ERRANDS_PER_CITY,
  HUSTLE_PAY_M, HUSTLES_PER_NIGHT, LODGING_M, MINIGAME_MAX_M, NIGHT_BETS, STANDING_MAX, START_MONEY, TRAVEL_FARE_M, VENUE_MAX_M, VENUE_REP,
} from '@/lib/story/economy'
import { BASE_ODDS, lossChanceOf, measurePoker, rtpOf, spreadOf, STORY_POKER_PAYS, STORY_SETTINGS, storyOdds, type BetProfile } from '@/lib/story/odds'
import type { GameName } from '@/store/types'
import { createRng } from '@/utils/rng'

const args = process.argv.slice(2)
const seedAt = args.indexOf('--seed')
const seed = seedAt >= 0 ? Number(args[seedAt + 1]) : 1
const runs = Number(args.find((a, i) => !a.startsWith('--') && (seedAt < 0 || i !== seedAt + 1)) ?? 3000)
let failed = 0
const fail = (msg: string) => {
  failed++
  console.log(`FAIL ${msg}`)
}
const pct = (n: number) => `${(100 * n).toFixed(1)}%`
const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))

// ── 1. Return check ──────────────────────────────────────────────────────────

const basePoker = [measurePoker()]
const poker = [measurePoker(200_000, STORY_POKER_PAYS)]
console.log('━━ Return check (one bet, total return ÷ stake)')
const games = Object.keys(BASE_ODDS) as GameName[]
for (const game of games) {
  const base = game === 'poker-1p' ? basePoker : BASE_ODDS[game]
  const story = storyOdds(game, poker)
  const line = base.map((b) => `${b.label} ${pct(rtpOf(b))}${b.source !== 'exact' ? ` (${b.source})` : ''}`).join(' · ')
  const flag = base.some((b) => rtpOf(b) > 1.0001) ? '  ← over 100% in the base game' : ''
  console.log(`  ${pad(game, 15)} ${line}${flag}`)
  if (STORY_SETTINGS[game] || game === 'poker-1p') console.log(`  ${pad('', 15)} story: ${story.map((b) => `${b.label} ${pct(rtpOf(b))}`).join(' · ')}`)
  for (const b of story) if (rtpOf(b) > 1.0001) fail(`${game} "${b.label}" returns ${pct(rtpOf(b))} in story mode`)
}

// ── 2. Circuit simulation ────────────────────────────────────────────────────

type Pick = (city: GameName[], rng: () => number) => BetProfile
interface PlayerType {
  name: string
  gamble: boolean
  /** Share of the bankroll per bet (ignored by the bold player). */
  share: number
  pick: Pick
  /** Bets one all-in-to-the-goal bet a night instead of a night of bets. */
  bold?: boolean
  /** Money kept back when buying into the boss, in m. */
  reserve: number
  /** The best room this player wants: 0 dive, 1 main floor, 2 high-roller. Standing can hold them lower. */
  venue: 0 | 1 | 2
}

/**
 * Jobs won at the tables per city, from .md/STORY_CITY_GUIDE.md: every city needs two
 * early table jobs plus a third, so standing reaches the high-roller room before the
 * boss. Minigame jobs pay money only, so they are not counted here.
 */
const TABLE_JOBS_PER_CITY = 3
/** The room a standing figure opens: the best one it reaches. */
const roomFor = (standing: number): 0 | 1 | 2 => (standing >= VENUE_REP[2] ? 2 : standing >= VENUE_REP[1] ? 1 : 0)

const all = (city: GameName[]) => city.flatMap((g) => storyOdds(g, poker))
const minBy = (xs: BetProfile[], f: (b: BetProfile) => number) => xs.reduce((a, b) => (f(b) < f(a) ? b : a))
const maxBy = (xs: BetProfile[], f: (b: BetProfile) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a))
// The safest bet worth making: low spread among bets returning at least 94%.
const safest: Pick = (city) => {
  const fair = all(city).filter((b) => rtpOf(b) >= 0.94)
  return minBy(fair.length ? fair : all(city), spreadOf)
}
// Any of the city's games, played its usual way (each game's first profile).
const anyBet: Pick = (city, rng) => storyOdds(city[Math.floor(rng() * city.length)]!, poker)[0]!
const riskiest: Pick = (city) => maxBy(all(city).filter((b) => rtpOf(b) >= 0.9), spreadOf)
// For an all-in: the best-returning bet that wins at least 40% of the time.
const coinFlipLike: Pick = (city) => maxBy(all(city).filter((b) => 1 - lossChanceOf(b) >= 0.4).concat(minBy(all(city), lossChanceOf)), rtpOf)

const TYPES: PlayerType[] = [
  { name: 'Never gambles', gamble: false, share: 0, pick: safest, reserve: 0, venue: 0 },
  { name: 'Cautious (5%)', gamble: true, share: 0.05, pick: safest, reserve: 20, venue: 1 },
  { name: 'Balanced (15%)', gamble: true, share: 0.15, pick: anyBet, reserve: 10, venue: 1 },
  { name: 'High variance', gamble: true, share: 0.15, pick: riskiest, reserve: 10, venue: 1 },
  { name: 'Bold (all in)', gamble: true, share: 1, pick: coinFlipLike, bold: true, reserve: 0, venue: 2 },
]

function draw(b: BetProfile, rng: () => number): number {
  let r = rng()
  for (const o of b.outcomes) {
    if (r < o.p) return o.mult
    r -= o.p
  }
  return 0
}

interface CircuitResult { nights: number[]; busts: number; bosses: number; recoveries: number[]; stuck: boolean }

function circuit(t: PlayerType, rng: () => number): CircuitResult {
  let money = START_MONEY / CITIES[0]!.minBet // in m of the current city
  const nights: number[] = []
  const recoveries: number[] = []
  let busts = 0
  let bosses = 0
  let totalNights = 0
  const seen = new Set<GameName>()
  for (let c = 0; c < CITIES.length; c++) {
    const city: City = CITIES[c]!
    const next = CITIES[c + 1]
    const ratio = next ? next.minBet / city.minBet : 1
    const fare = next ? TRAVEL_FARE_M * ratio : 0
    const all: GameName[] = city.games === 'all-seen' ? [...seen] : city.games
    all.forEach((g) => seen.add(g))
    const target = BOSS_BUYIN_M + t.reserve + fare
    let n = 0
    let errands = ERRANDS_PER_CITY
    let tableJobs = TABLE_JOBS_PER_CITY
    let standing = 0
    let wait = 0
    let brokeSince: number | null = null
    for (;;) {
      if (wait === 0 && money >= target) {
        bosses++
        if (rng() < 0.5) {
          money += BOSS_PURSE_M - BOSS_BUYIN_M
          break
        }
        money -= BOSS_BUYIN_M
        wait = BOSS_REMATCH_NIGHTS
      }
      // A night: minigames, an errand, then play (or rest), comps, lodging.
      const before = money
      // A new town starts you in the dive; standing opens the rooms above it. The night
      // counter runs across the whole circuit.
      const venue = Math.min(t.venue, roomFor(standing)) as 0 | 1 | 2
      const cap = VENUE_MAX_M[venue] ?? Infinity
      const list = gamesFor(city, totalNights, venue, [...seen])
      for (let g = 0; g < city.minigameGivers; g++) money += MINIGAME_MAX_M * (0.45 + rng() * 0.5)
      if (errands > 0) { money += ERRAND_PAY_M; errands-- }
      if (t.gamble && money >= 1) {
        for (let h = 0; h < HUSTLES_PER_NIGHT; h++) if (rng() < 0.75) money += HUSTLE_PAY_M
        let turnover = 0
        if (t.bold) {
          const need = target - money
          if (need > 0) {
            const stake = Math.min(money, need, cap)
            turnover += stake
            money += stake * (draw(t.pick(list, rng), rng) - 1)
          }
        } else {
          for (let k = 0; k < NIGHT_BETS && money >= 1; k++) {
            const stake = Math.max(1, Math.min(money, money * t.share, cap))
            turnover += stake
            money += stake * (draw(t.pick(list, rng), rng) - 1)
          }
        }
        money += Math.min(COMPS_RATE[venue] * turnover, COMPS_CAP_M[venue])
      }
      // A table job finished tonight is what lifts standing (minigame jobs pay money only).
      if (tableJobs > 0) { standing = Math.min(STANDING_MAX, standing + 1); tableJobs-- }
      if (money >= CAR_BELOW_M) money = Math.max(0, money - LODGING_M)
      n++
      totalNights++
      wait = Math.max(0, wait - 1)
      if (before >= 1 && money < 1) { busts++; standing = Math.max(0, standing - BUST_STANDING); brokeSince = n }
      if (brokeSince != null && money >= 10) { recoveries.push(n - brokeSince); brokeSince = null }
      if (n > 1000) return { nights, busts, bosses, recoveries, stuck: true }
    }
    nights.push(n)
    money = next ? (money - fare) / ratio : money
  }
  return { nights, busts, bosses, recoveries, stuck: false }
}

const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0
const median = (xs: number[]) => q(xs, 0.5)

console.log(`\n━━ Circuits: ${runs} per player type · seed ${seed}`)
console.log(`  ${pad('Player type', 16)} ${pad('Nights per city (median / worst 10%)', 38)} ${pad('Circuit (median)', 18)} ${pad('Busts', 7)} ${pad('Boss tries', 11)} Back to 10m after a bust (median / worst 10%)`)
const summary: Record<string, { perCity: number; circuit: number; stuck: number }> = {}
for (const [ti, t] of TYPES.entries()) {
  const rng = createRng(seed * 100 + ti)
  const rs = Array.from({ length: runs }, () => circuit(t, rng))
  const ok = rs.filter((r) => !r.stuck)
  const per = ok.flatMap((r) => r.nights)
  const tot = ok.map((r) => r.nights.reduce((a, b) => a + b, 0))
  const rec = ok.flatMap((r) => r.recoveries)
  const busts = ok.reduce((s, r) => s + r.busts, 0) / Math.max(1, ok.length)
  const bosses = ok.reduce((s, r) => s + r.bosses, 0) / Math.max(1, ok.length)
  summary[t.name] = { perCity: median(per), circuit: median(tot), stuck: rs.length - ok.length }
  console.log(
    `  ${pad(t.name, 16)} ${pad(`${median(per)} / ${q(per, 0.9)}`, 38)} ${pad(`~${median(tot)} nights`, 18)} ${pad(busts.toFixed(1), 7)} ${pad(bosses.toFixed(1), 11)} ${rec.length ? `${median(rec)} / ${q(rec, 0.9)}` : '—'}` +
      (rs.length - ok.length ? `  STUCK ${rs.length - ok.length}` : ''),
  )
}

// Targets (plan section 5): nobody stuck; normal play 4–8 nights a city; gambling faster than never gambling.
for (const [name, s] of Object.entries(summary)) if (s.stuck) fail(`${name}: ${s.stuck} circuits stuck`)
const balanced = summary['Balanced (15%)']!
const cautious = summary['Cautious (5%)']!
const never = summary['Never gambles']!
if (balanced.perCity < 4 || balanced.perCity > 8) fail(`balanced play takes ${balanced.perCity} nights a city (target 4–8)`)
if (cautious.perCity < 4 || cautious.perCity > 8) fail(`cautious play takes ${cautious.perCity} nights a city (target 4–8)`)
if (never.circuit < 2 * balanced.circuit) fail(`never gambling (${never.circuit} nights) is not clearly slower than balanced play (${balanced.circuit})`)

console.log(failed ? `\n${failed} checks failed` : '\nAll story economy checks passed')
if (failed) process.exit(1)
