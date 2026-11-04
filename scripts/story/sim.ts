/**
 * Story mode economy check (.md/STORY_MODE_PLAN.md sections 1 and 5).
 *
 * 1. Return check: every game's standard bets, base and story settings. A story
 *    bet returning more than 100% fails the run (fair 100% bets are allowed).
 * 2. Circuit simulation: thousands of whole circuits (12 cities) for five player
 *    types, using each city's real game list, the economy constants and the
 *    odds above. Standing is modelled per town: every town starts the player in
 *    the dive, every finished table job lifts standing one (a bust costs none; the sim
 *    takes no markers), and
 *    the player moves up to the best room their standing opens (their own preferred
 *    room or lower). Jobs follow lib/story/jobs.ts: each night a minigame job and a table
 *    job while the town has room (JOB_LIMIT, one per giver; a coin flip when one place is
 *    left), from the first night. The player takes every offer. Each minigame job is one
 *    attempt that night (a score drawn per attempt): at the target it pays
 *    MINIGAME_JOB_PAY_M, short of it the job is lost. A player who bets takes every offer
 *    and finishes one table job a night; one who never bets leaves table offers alone, and
 *    they leave after JOB_OFFER_NIGHTS. Each night ends with a choice of bed: the car
 *    (5 bets tomorrow; free) or a room (10 bets; 3m in the first town, then 4m), which a player who spreads bets takes while holding ROOM_FROM_M; the bold and
 *    the never-gambler sleep in the car. The never-gambler is shown but is not a target
 *    (owner decision 2026-11-04: never gambling is not a way to play the story).
 *    A night up at the tables earns the standing bonus. Prints nights per
 *    city and over the circuit, busts, boss tries, and recovery time after a bust,
 *    and checks the plan's targets.
 *
 *   pnpm sim:story                 3,000 circuits per player type
 *   pnpm sim:story 500 --seed 7    fewer circuits, another seed
 */
import { CITIES, type City } from '@/lib/story/cities'
import { gamesFor } from '@/lib/story/rotation'
import {
  BOSS_BUYIN_M, BOSS_PURSE_M, BOSS_REMATCH_NIGHTS, COMPS_CAP_M, COMPS_RATE,
  HUSTLE_PAY_M, JOB_LIMIT, JOB_OFFER_NIGHTS, MINIGAME_JOB_PAY_M, TABLE_JOB_PAY_M, HUSTLES_PER_NIGHT, SLEEP_BETS, START_BETS, STANDING_MAX, sleepCostM, START_MONEY, VENUE_MAX_M, VENUE_REP,
  standingBonus,
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

/** The room a standing figure opens: the best one it reaches. */
/** Job givers a city has (Dustwater: Marta, Pike, Jo); one job per giver at a time. */
const JOB_GIVERS = 3
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

/** Shown in the table, but no target applies to it. */
const NOT_A_TARGET = 'Never gambles'

/** A player who spreads bets pays for the room while holding at least this (in m). */
const ROOM_FROM_M = 20

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
  // Bets tonight, from where they slept (a new story starts with the car's).
  let bets = START_BETS
  const seen = new Set<GameName>()
  for (let c = 0; c < CITIES.length; c++) {
    const city: City = CITIES[c]!
    const next = CITIES[c + 1]
    const ratio = next ? next.minBet / city.minBet : 1
    const all: GameName[] = city.games === 'all-seen' ? [...seen] : city.games
    all.forEach((g) => seen.add(g))
    const target = BOSS_BUYIN_M + t.reserve
    let n = 0
    // The town's jobs (one per giver): kind, the night offered, and whether taken.
    const jobs: { kind: 'minigame' | 'table'; at: number; taken: boolean }[] = []
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
      // A night: minigames, a job, then play (or rest), comps, lodging.
      const before = money
      // A new town starts you in the dive; standing opens the rooms above it. The night
      // counter runs across the whole circuit.
      const venue = Math.min(t.venue, roomFor(standing)) as 0 | 1 | 2
      const cap = VENUE_MAX_M[venue] ?? Infinity
      const list = gamesFor(city, totalNights, venue, [...seen])
      // Tonight's offers: a minigame job and a table job, while the town has room (a coin
      // flip with one place left).
      // Offers nobody took leave after JOB_OFFER_NIGHTS.
      for (let k = jobs.length - 1; k >= 0; k--) if (!jobs[k]!.taken && n - jobs[k]!.at >= JOB_OFFER_NIGHTS) jobs.splice(k, 1)
      const room = Math.min(JOB_LIMIT, JOB_GIVERS) - jobs.length
      const offer = (kind: 'minigame' | 'table') => jobs.push({ kind, at: n, taken: t.gamble || kind === 'minigame' })
      if (room >= 2) { offer('minigame'); offer('table') }
      else if (room === 1) offer(rng() < 0.5 ? 'minigame' : 'table')
      // Every minigame job gets its one attempt tonight: a target of 60%, 80% or perfect,
      // paying 6m, 7m or 8m; short of it the job is lost.
      for (let k = jobs.length - 1; k >= 0; k--) {
        if (jobs[k]!.kind !== 'minigame') continue
        jobs.splice(k, 1)
        const tier = Math.floor(rng() * 3)
        const targetScore = [0.6, 0.8, 1][tier]!
        if (0.4 + rng() * 0.62 >= targetScore) money += MINIGAME_JOB_PAY_M.min + tier
      }
      // One table job finished a night, by a player who bets.
      let clearsJob = false
      const k = t.gamble ? jobs.findIndex((j) => j.kind === 'table' && j.taken) : -1
      if (k >= 0) { jobs.splice(k, 1); clearsJob = true; money += (TABLE_JOB_PAY_M.min + TABLE_JOB_PAY_M.max) / 2 }
      if (t.gamble && money >= 1) {
        for (let h = 0; h < HUSTLES_PER_NIGHT; h++) if (rng() < 0.75) money += HUSTLE_PAY_M
        let turnover = 0
        let tableNet = 0
        if (t.bold) {
          const need = target - money
          if (need > 0) {
            const stake = Math.min(money, need, cap)
            turnover += stake
            const won = stake * (draw(t.pick(list, rng), rng) - 1)
            tableNet += won
            money += won
          }
        } else {
          for (let k = 0; k < bets && money >= 1; k++) {
            const stake = Math.max(1, Math.min(money, money * t.share, cap))
            turnover += stake
            const won = stake * (draw(t.pick(list, rng), rng) - 1)
            tableNet += won
            money += won
          }
        }
        money += Math.min(COMPS_RATE[venue] * turnover, COMPS_CAP_M[venue])
        // The job finished tonight counts toward tonight's bonus (as in the store). Money here is in m, and
        // standingBonus rounds to whole units, so it works in hundredths of m.
        money += standingBonus(Math.min(STANDING_MAX, standing + (clearsJob ? 1 : 0)), tableNet * 100) / 100
      }
      // A table job finished tonight lifts standing (minigame jobs don't).
      if (clearsJob) standing = Math.min(STANDING_MAX, standing + 1)
      // Where to sleep: a player who spreads bets takes the room (12 bets tomorrow) while
      // they hold at least ROOM_FROM_M; the bold and the never-gambler take the car (8).
      const place = t.gamble && !t.bold && money >= ROOM_FROM_M + sleepCostM('room', c === 0) ? 'room' : 'car'
      money = Math.max(0, money - sleepCostM(place, c === 0))
      bets = SLEEP_BETS[place]
      n++
      totalNights++
      wait = Math.max(0, wait - 1)
      // Going broke costs no standing (only the Notary's marker does, and the sim takes none).
      if (before >= 1 && money < 1) { busts++; brokeSince = n }
      if (brokeSince != null && money >= 10) { recoveries.push(n - brokeSince); brokeSince = null }
      if (n > 1000) return { nights, busts, bosses, recoveries, stuck: true }
    }
    nights.push(n)
    money = next ? money / ratio : money
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
      (rs.length - ok.length ? `  STUCK ${rs.length - ok.length}` : '') +
      (t.name === NOT_A_TARGET ? '  (reference, not a target)' : ''),
  )
}

// Targets (plan section 5): no player who bets gets stuck; normal play 4–8 nights a city.
// The never-gambler is shown for reference only (owner decision 2026-11-04).
for (const [name, s] of Object.entries(summary)) if (s.stuck && name !== NOT_A_TARGET) fail(`${name}: ${s.stuck} circuits stuck`)
const balanced = summary['Balanced (15%)']!
const cautious = summary['Cautious (5%)']!
if (balanced.perCity < 4 || balanced.perCity > 8) fail(`balanced play takes ${balanced.perCity} nights a city (target 4–8)`)
if (cautious.perCity < 4 || cautious.perCity > 8) fail(`cautious play takes ${cautious.perCity} nights a city (target 4–8)`)

console.log(failed ? `\n${failed} checks failed` : '\nAll story economy checks passed')
if (failed) process.exit(1)
