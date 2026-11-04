/**
 * Story content checks (.md/STORY_MODE_PLAN.md section 10). Run with
 * `pnpm check:story`. Fails on anything that would break a save or strand a
 * player:
 *  - ids unique; every character, city, job and node a scene names exists;
 *  - every node reachable from the scene's start, every path ends (no dead ends),
 *    and a choice can never have all its options closed by its conditions;
 *  - every flag a condition reads is set somewhere;
 *  - written jobs fit their town and giver, and a town can always offer enough
 *    jobs to reach STANDING_MAX; the job rules (lib/story/jobs.ts) played through;
 *  - cities in rising stakes; every house game in at least two cities; every
 *    Tables game as both a cash room and a tournament;
 *  - shipped ids still exist (SHIPPED below: add to it, never remove from it).
 */
import { CITIES } from '@/lib/story/cities'
import { CHARACTERS, SCENES, WRITTEN_JOBS } from '@/lib/story/content'
import {
  BONUS_STEPS, BOSS_BUYIN_M, BOSS_REMATCH_NIGHTS, BUST_STANDING, COMPS_CAP_M, COMPS_RATE, GAMES_PER_ROOM, HUSTLES_PER_NIGHT, JOB_LIMIT, JOB_OFFER_NIGHTS, JOB_STANDING, jobPayM,
  MARKER_M, MARKER_REPAY, NIGHT_BETS, STANDING_BONUS, STANDING_MAX, VENUE_MAX_M, VENUE_REP, standingBonus,
} from '@/lib/story/economy'
import { gamesFor } from '@/lib/story/rotation'
import { goalKey, jobGivers, kindOf, makeOffers, NIGHT_KINDS, type Job } from '@/lib/story/jobs'
import * as chipCount from '@/lib/story/minigames/chip-count'
import { seeded } from '@/lib/story/minigames/rng'
import { CITY_BY_ID } from '@/lib/story/cities'
import type { Condition, Effect } from '@/lib/story/types'
import { GAMES } from '@/lib/game-catalog'
import type { TableGameName } from '@/lib/tables/types'
import { migrateStorySave, useStoryStore } from '@/store/story-store'

/** Ids that saves may already hold. Grow this list as content ships; never remove from it. */
const SHIPPED = {
  scenes: [] as string[],
  jobs: [] as string[],
  characters: [] as string[],
}

let failed = 0
const fail = (msg: string) => {
  failed++
  console.error(`FAIL ${msg}`)
}

const unique = (what: string, ids: string[]) => {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) fail(`${what} id "${id}" is used twice`)
    seen.add(id)
  }
}
unique('city', CITIES.map((c) => c.id))
unique('character', CHARACTERS.map((c) => c.id))
unique('scene', SCENES.map((s) => s.id))
unique('written job', WRITTEN_JOBS.map((e) => e.id))

const cityIds = new Set(CITIES.map((c) => c.id))
const characterIds = new Set(CHARACTERS.map((c) => c.id))
const jobIds = new Set(WRITTEN_JOBS.map((e) => e.id))

// Flags: what sets them, what reads them.
const setFlags = new Set<string>()
const readFlags: { flag: string; where: string }[] = []
const readCond = (c: Condition | undefined, where: string) => {
  if (!c) return
  if ('flag' in c) readFlags.push({ flag: c.flag, where })
  else if ('not' in c) readCond(c.not, where)
  else if ('all' in c) c.all.forEach((x) => readCond(x, where))
  else if ('any' in c) c.any.forEach((x) => readCond(x, where))
}
const effects = (es: Effect[] | undefined, where: string) => {
  for (const e of es ?? []) {
    if ('set' in e) setFlags.add(e.set)
    // Jobs are taken only in the store's offer scenes, never by written content.
    if ('job' in e) fail(`${where}: content can't hand out a job (only talking to the giver does)`)
  }
}
// Flags the game itself sets (outside content): boss results and travel.
for (const c of CITIES) setFlags.add(`${c.id}-cleared`)

for (const c of CHARACTERS) if (c.city && !cityIds.has(c.city)) fail(`character ${c.id}: unknown city "${c.city}"`)
for (const e of WRITTEN_JOBS) {
  const where = `job ${e.id}`
  if (!cityIds.has(e.city)) fail(`${where}: unknown city`)
  if (!jobGivers(e.city).some((g) => g.id === e.giver)) fail(`${where}: "${e.giver}" doesn't give jobs in ${e.city}`)
  if (e.goal.kind === 'minigame') {
    const own = CHARACTERS.find((c) => c.id === e.giver)?.minigame
    if (own !== e.goal.minigame) fail(`${where}: a minigame job is the giver's own minigame (${e.giver} has ${own ?? 'none'})`)
  }
  if (e.goal.kind === 'streak') {
    const city = CITIES.find((c) => c.id === e.city)
    if (city && city.games !== 'all-seen' && !city.games.includes(e.goal.game)) fail(`${where}: ${e.goal.game} isn't played in ${e.city}`)
  }
  const range = jobPayM(kindOf(e.goal))
  if (!Number.isInteger(e.pay) || e.pay < range.min || e.pay > range.max) fail(`${where}: pays ${e.pay}m, outside ${range.min}m to ${range.max}m for a ${kindOf(e.goal)} job`)
  if (!e.pitch.length || e.pitch.some((l) => !l.trim())) fail(`${where}: needs a pitch, one line each`)
}
// A town never gives the same task twice, written ones included.
for (const c of CITIES) {
  const keys = WRITTEN_JOBS.filter((e) => e.city === c.id).map((e) => goalKey(e.goal))
  if (new Set(keys).size !== keys.length) fail(`city ${c.id}: two written jobs share a task`)
}
// Every job giver has a minigame (each night brings a minigame job). The standing path:
// every town keeps offering both kinds for a month of nights, taking and finishing each.
for (const c of CITIES) {
  const givers = jobGivers(c.id)
  for (const g of givers) if (!g.minigame) fail(`${g.id} gives jobs in ${c.id} but has no minigame`)
  // Only towns with their people written (Jo alone can't give two jobs a night).
  if (givers.length < 2) continue
  const games = c.games === 'all-seen' ? GAMES.map((g) => g.name).slice(0, 6) : c.games
  const given: string[] = []
  let nights = 0
  for (let n = 0; n < 30; n++) {
    const jobs = makeOffers({ city: c, night: n, kinds: NIGHT_KINDS, held: [], given, games: games as never })
    given.push(...jobs.map((j) => j.key))
    if (jobs.length === 2 && jobs[0]!.giver !== jobs[1]!.giver && new Set(jobs.map((j) => kindOf(j.goal))).size === 2) nights++
  }
  if (nights < STANDING_MAX) fail(`city ${c.id}: only ${nights} nights with a minigame and a table job, short of standing ${STANDING_MAX}`)
}
if (VENUE_REP[1] >= VENUE_REP[2] || VENUE_REP[2] > STANDING_MAX) fail('room standings must rise and fit under the standing cap')
for (const step of BONUS_STEPS) if (VENUE_REP.includes(step)) fail(`standing ${step} both opens a room and raises the bonus`)

for (const scene of SCENES) {
  const where = `scene ${scene.id}`
  if (!cityIds.has(scene.city)) fail(`${where}: unknown city "${scene.city}"`)
  if (scene.trigger.on === 'talk' && !characterIds.has(scene.trigger.character)) fail(`${where}: unknown character "${scene.trigger.character}"`)
  readCond(scene.if, where)
  if (!scene.nodes[scene.start]) fail(`${where}: start node "${scene.start}" is missing`)

  // Edges, speakers, effects.
  const edges = new Map<string, string[]>()
  for (const [id, node] of Object.entries(scene.nodes)) {
    const at = `${where} node ${id}`
    if (node.kind === 'line') {
      edges.set(id, [node.next])
      if (node.speaker !== 'you' && node.speaker !== 'narrator' && !characterIds.has(node.speaker)) fail(`${at}: unknown speaker "${node.speaker}"`)
      if (!node.text.trim()) fail(`${at}: empty line`)
    } else if (node.kind === 'choice') {
      edges.set(id, node.options.map((o) => o.to))
      if (!node.options.length) fail(`${at}: a choice with no options`)
      // At least one option must be open whatever the save holds: one with no condition.
      if (!node.options.some((o) => !o.if)) fail(`${at}: every option has a condition, so a save could find them all closed`)
      node.options.forEach((o, i) => {
        readCond(o.if, `${at} option ${i}`)
        effects(o.effects, `${at} option ${i}`)
      })
    } else {
      edges.set(id, [])
      effects(node.effects, at)
    }
  }
  for (const [id, next] of edges) for (const to of next) if (!scene.nodes[to]) fail(`${where} node ${id}: leads to missing node "${to}"`)

  // Reachable from the start, and every reachable node can reach an end.
  const reach = new Set<string>()
  const stack = [scene.start]
  while (stack.length) {
    const id = stack.pop()!
    if (reach.has(id) || !scene.nodes[id]) continue
    reach.add(id)
    stack.push(...(edges.get(id) ?? []))
  }
  for (const id of Object.keys(scene.nodes)) if (!reach.has(id)) fail(`${where}: node "${id}" can't be reached`)
  const ends = new Set(Object.entries(scene.nodes).filter(([, n]) => n.kind === 'end').map(([id]) => id))
  let grew = true
  while (grew) {
    grew = false
    for (const [id, next] of edges) if (!ends.has(id) && next.some((to) => ends.has(to))) { ends.add(id); grew = true }
  }
  for (const id of reach) if (!ends.has(id)) fail(`${where}: from node "${id}" the scene never ends`)
}

for (const r of readFlags) if (!setFlags.has(r.flag)) fail(`${r.where}: reads flag "${r.flag}", which nothing sets`)

// Cities: rising stakes, every house game twice, every table game in both formats.
CITIES.forEach((c, i) => {
  if (i > 0 && c.minBet <= CITIES[i - 1]!.minBet) fail(`city ${c.id}: minimum bet doesn't rise`)
})
for (const g of GAMES) {
  const n = CITIES.filter((c) => c.games !== 'all-seen' && c.games.includes(g.name)).length
  if (n < 2) fail(`game ${g.name} is in ${n} cit${n === 1 ? 'y' : 'ies'} (needs 2)`)
}
for (const t of ['holdem', 'liars-dice', 'blackjack-showdown'] as TableGameName[]) {
  for (const format of ['cash', 'tournament'] as const) {
    if (!CITIES.some((c) => c.tables.some((x) => x.game === t && x.format === format) || (c.boss.kind === 'table' && c.boss.game === t && format === 'tournament'))) fail(`table game ${t} never appears as ${format}`)
  }
}

// Room rotation: three games a room, a shared game with the night before, stable per night.
for (const c of CITIES) {
  if (c.games === 'all-seen') continue
  for (const v of [0, 1, 2]) {
    let prev = gamesFor(c, 0, v)
    for (let n = 0; n < 60; n++) {
      const now = gamesFor(c, n, v)
      const want = Math.min(GAMES_PER_ROOM, c.games.length)
      if (now.length !== want || new Set(now).size !== want || now.some((g) => !(c.games as string[]).includes(g))) fail(`${c.id} room ${v} night ${n}: bad lineup ${now.join(',')}`)
      if (n > 0 && !now.some((g) => prev.includes(g))) fail(`${c.id} room ${v} night ${n}: shares no game with the night before`)
      if (gamesFor(c, n, v).join() !== now.join()) fail(`${c.id} room ${v} night ${n}: lineup not stable`)
      prev = now
    }
  }
  if (c.games.length > GAMES_PER_ROOM && new Set([0, 1, 2].map((v) => gamesFor(c, 0, v).join())).size < 2) fail(`${c.id}: all three rooms open with the same games`)
}

// Numbers quoted in dialogue must match the economy.
const allText = SCENES.flatMap((s) => Object.values(s.nodes).flatMap((n) => (n.kind === 'line' ? [n.text] : [])))
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100 }
const word = (w: string | undefined) => WORDS[(w ?? '').toLowerCase()]
// Jo's walkthrough (and any line in the same shape) must quote the economy as it is.
const QUOTES: { re: RegExp; what: string; want: (m: RegExpMatchArray) => [number | undefined, number | null][] }[] = [
  { re: /^The dive takes anyone.*up to (?:a )?(\w+) times/i, what: 'the dive limit', want: (m) => [[word(m[1]), VENUE_MAX_M[0]]] },
  { re: /^The main floor wants standing (\w+)\..*up to (?:a )?(\w+) times/i, what: 'the main floor', want: (m) => [[word(m[1]), VENUE_REP[1]], [word(m[2]), VENUE_MAX_M[1]]] },
  { re: /^The high-roller room wants standing (\w+)/i, what: 'the high-roller room', want: (m) => [[word(m[1]), VENUE_REP[2]]] },
  { re: /it goes up (\w+)/i, what: 'the standing a table job earns', want: (m) => [[word(m[1]), JOB_STANDING]] },
  { re: /it drops (\w+)/i, what: 'the standing a bust costs', want: (m) => [[word(m[1]), BUST_STANDING]] },
  { re: /(\w+) is the most any town gives/i, what: 'the standing cap', want: (m) => [[word(m[1]), STANDING_MAX]] },
  { re: /(\w+) bets a night/i, what: 'bets a night', want: (m) => [[word(m[1]), NIGHT_BETS]] },
  { re: /its own (\w+) games/i, what: 'games per room', want: (m) => [[word(m[1]), GAMES_PER_ROOM]] },
  { re: /(\w+) side goals/i, what: 'hustles a night', want: (m) => [[word(m[1]), HUSTLES_PER_NIGHT]] },
  { re: /back after (\w+) nights/i, what: 'the rematch wait', want: (m) => [[word(m[1]), BOSS_REMATCH_NIGHTS]] },
  {
    re: /At (\w+), (\w+) and (\w+) the house adds a bonus.*: (\w+), (\w+), then (\w+) percent/i,
    what: 'the standing bonus',
    want: (m) => [
      ...BONUS_STEPS.map((step, i): [number | undefined, number] => [word(m[i + 1]), step]),
      ...BONUS_STEPS.map((step, i): [number | undefined, number] => [word(m[i + 4]), Math.round(STANDING_BONUS[step]! * 100)]),
    ],
  },
  { re: /(\w+) on the go at most/i, what: 'the jobs a town gives at once', want: (m) => [[word(m[1]), JOB_LIMIT]] },
]
for (const t of allText) {
  for (const q of QUOTES) {
    const m = t.match(q.re)
    if (m) for (const [got, want] of q.want(m)) if (got !== want) fail(`a line quotes ${q.what} as "${m[0]}", the economy says ${want}`)
  }
}
if (!QUOTES.every((q) => allText.some((t) => q.re.test(t)))) fail('Jo\'s walkthrough no longer contains every number the checker verifies')
for (const t of allText) {
  const buyIn = t.match(/(\w+) times the house minimum to sit/i)
  if (buyIn && WORDS[buyIn[1]!.toLowerCase()] !== BOSS_BUYIN_M) fail(`a boss line quotes the buy-in as "${buyIn[1]}", the economy says ${BOSS_BUYIN_M}`)
  const marker = t.match(/(\w+) times the minimum, repaid at one and a half/i)
  if (marker && (WORDS[marker[1]!.toLowerCase()] !== MARKER_M || MARKER_REPAY !== 1.5)) fail(`the Notary quotes the marker as "${marker[1]}", the economy says ${MARKER_M} at ${MARKER_REPAY}`)
}

// Shipped ids.
for (const id of SHIPPED.scenes) if (!SCENES.some((s) => s.id === id)) fail(`shipped scene "${id}" is gone (saves may refer to it)`)
for (const id of SHIPPED.jobs) if (!jobIds.has(id)) fail(`shipped job "${id}" is gone`)
for (const id of SHIPPED.characters) if (!characterIds.has(id)) fail(`shipped character "${id}" is gone`)

// ── The save's rules, played through once ──
{
  const st = () => useStoryStore.getState()
  st().newStory()
  const m = st().minBet()
  if (st().money !== 200 || m !== 5) fail('a new story starts in Dustwater with $200')
  if (st().rep() !== 0 || st().venueOpen(1) || st().venueOpen(2)) fail('a new story starts at standing 0 with only the dive open')
  // The arrival scene: lines, a choice, the end's effects.
  if (st().queue.join() !== 'dustwater-arrival,dustwater-how-nights-work') fail('a new story queues the arrival scene, then Jo\'s walkthrough')
  if (!st().playQueued() || st().scene?.id !== 'dustwater-arrival') fail('a new story queues the arrival scene')
  let guard = 0
  while (st().scene && guard++ < 50) {
    const step = st().currentStep()!
    if (step.kind === 'choice') st().pick(step.options[Math.min(2, step.options.length - 1)]!.index)
    else st().advance()
  }
  if (!st().flags['arrived-dustwater'] || st().factions.underground !== 1) fail('arrival scene effects (flag, faction) not applied')
  if (st().startScene('dustwater-arrival')) fail('a once-only scene played twice')
  // Jo's walkthrough, both branches, to the end; it can be replayed.
  for (const branch of [0, 1]) {
    if (!st().playQueued() && !st().startScene('dustwater-how-nights-work')) fail('Jo\'s walkthrough can\'t start')
    guard = 0
    while (st().scene && guard++ < 50) {
      const step = st().currentStep()!
      if (step.kind === 'choice') st().pick(step.options[branch]!.index)
      else st().advance()
    }
    if (guard >= 50) fail(`Jo's walkthrough branch ${branch} doesn't end`)
  }
  // Plays a scene to its end, taking the first open option at each choice.
  const play = (id: string) => {
    if (!st().startScene(id)) return fail(`scene ${id} can't start`)
    let g = 0
    while (st().scene && g++ < 50) {
      const step = st().currentStep()!
      if (step.kind === 'choice') st().pick(step.options[0]!.index)
      else st().advance()
    }
  }
  // ── Jobs (owner decisions 2026-11-04) ──
  const offered = () => st().jobs.filter((j) => j.city === st().city && j.status === 'offered')
  const heldHere = () => st().jobs.filter((j) => j.city === st().city)
  const givers = jobGivers('dustwater').map((g) => g.id)
  if (givers.join() !== 'marta,pike,jo') fail(`Dustwater's job givers are Marta, Pike and Jo (got ${givers.join()})`)
  /** Plays whatever scene is on, choosing the option whose text has `want` (else the first). */
  const playOn = (want?: string) => {
    let g = 0
    while (st().scene && g++ < 80) {
      const step = st().currentStep()
      if (!step) { fail(`scene ${st().scene!.id} is stuck at node ${st().scene!.node}`); break }
      if (step.kind === 'choice') st().pick((step.options.find((o) => want && o.text.includes(want)) ?? step.options[0]!).index)
      else st().advance()
    }
    if (st().scene) fail(`a scene (${st().scene!.id}) doesn't end`)
  }
  /** Talks to a giver and answers their offer. */
  const answer = (giver: string, take: boolean) => {
    if (!st().talkTo(giver)) return fail(`talking to ${giver} does nothing`)
    playOn(take ? 'do it' : 'Not now')
  }
  /** Meets a taken job's goal through the store's own actions. */
  const finish = (j: Job) => {
    const g = j.goal
    useStoryStore.setState({ money: Math.max(st().money, 2000 * m) })
    if (g.kind === 'minigame') return void st().playMinigame(j.giver, g.minigame, 1)
    if (!st().tonight) st().startNight(0)
    if (g.kind === 'streak') for (let k = 0; k < g.wins; k++) { st().placeBet(g.game, m); st().resolve(g.game, 2 * m, true) }
    else if (g.kind === 'big-win') { st().placeBet('hilo', m); st().resolve('hilo', g.mult * m, true) }
    else { st().placeBet('hilo', 10 * m); st().resolve('hilo', (20 + (g.atLeast ?? 0)) * m, true); st().endNight() }
  }
  const kinds = (js: Job[]) => js.map((j) => kindOf(j.goal)).sort().join()

  // The story starts with two offers: a minigame job and a table job, at two different people.
  const first = offered()
  if (first.length !== 2 || kinds(first) !== 'minigame,table' || first[0]!.giver === first[1]!.giver || st().openJobs().length) fail(`a new story starts with a minigame job and a table job at two people (got ${first.map((j) => `${j.giver}:${j.key}`).join()})`)
  for (const j of first) if (!givers.includes(j.giver)) fail(`an offer comes from someone who gives jobs here (got ${j.giver})`)
  for (const j of first) if (j.goal.kind === 'minigame' && j.goal.minigame !== CHARACTERS.find((c) => c.id === j.giver)?.minigame) fail(`a minigame job is the giver's own minigame (${j.giver})`)
  st().offerTonight()
  if (offered().length !== 2) fail('asking again the same night adds no offer')
  // Each giver's written jobs of a kind come first.
  for (const j of first) {
    const w = WRITTEN_JOBS.find((x) => x.city === 'dustwater' && x.giver === j.giver && kindOf(x.goal) === kindOf(j.goal))
    if (w && j.key !== goalKey(w.goal)) fail(`a giver offers their written ${kindOf(j.goal)} job first (${j.giver} offered ${j.key})`)
  }
  // Only talking takes a job. "Not now" leaves it waiting with the giver.
  const a = first[0]!
  if (!st().canTalk(a.giver)) fail('the giver with an offer has something to say')
  answer(a.giver, false)
  if (!offered().some((j) => j.id === a.id) || st().openJobs().length) fail('"Not now" leaves the offer waiting, not taken')
  if (!st().canTalk(a.giver) || st().sceneFor({ on: 'talk', character: a.giver })) fail('after any first-meeting scene, talking again goes straight to the offer')
  // Night 2 with both still waiting: one place left, so one more offer, of either kind, at the third person.
  st().endNight()
  const night1 = heldHere()
  if (night1.length !== JOB_LIMIT || new Set(night1.map((j) => j.giver)).size !== JOB_LIMIT) fail(`night 2 fills the last place at the third person (got ${night1.map((j) => j.giver).join()})`)
  const third = night1.find((j) => !first.some((f) => f.id === j.id))!
  if (!first.every((f) => offered().some((j) => j.id === f.id))) fail('an offer waits through the next night')
  // Offers left alone for JOB_OFFER_NIGHTS nights leave: on night 3 the first two go, and the
  // two freed people get tonight's offers (one of each kind). The third offer stays a night more.
  st().endNight()
  const night2 = heldHere()
  if (first.some((f) => night2.some((j) => j.id === f.id))) fail(`offers left alone for ${JOB_OFFER_NIGHTS} nights leave`)
  if (!night2.some((j) => j.id === third.id)) fail('a newer offer stays until its own nights are up')
  const fresh2 = night2.filter((j) => j.night === st().night)
  if (night2.length !== JOB_LIMIT || fresh2.length !== 2 || kinds(fresh2) !== 'minigame,table') fail(`freed people get tonight's two offers (got ${fresh2.map((j) => j.giver + ':' + j.key).join()})`)
  // Never taken means never given: the expired written job can come back from its giver later.
  for (const f of first) if ((st().jobsGiven.dustwater ?? []).filter((k) => k === f.key).length > (night2.some((j) => j.key === f.key) ? 1 : 0)) fail(`an offer nobody took is not counted as given (${f.key})`)
  st().endNight()
  const three = heldHere()
  if (three.some((j) => j.id === third.id) || three.length !== JOB_LIMIT) fail('the third offer leaves on its own schedule and its place is filled')
  for (const j of three) {
    const range = jobPayM(kindOf(j.goal))
    if (j.pay < range.min || j.pay > range.max) fail(`a ${kindOf(j.goal)} job pays ${range.min}m to ${range.max}m (got ${j.pay}m)`)
  }
  if (jobPayM('minigame').min <= jobPayM('table').max) fail('a minigame job pays more than any table job')
  // The coin flip goes both ways over many towns-and-nights.
  {
    const c = CITY_BY_ID.get('dustwater')!
    const flips = new Set<string>()
    for (let n = 0; n < 40; n++) {
      const held = first.slice(0, 2)
      const one = makeOffers({ city: c, night: n, kinds: NIGHT_KINDS, held, given: [], games: c.games as never })
      if (one.length !== 1) fail(`one free place brings exactly one offer (got ${one.length})`)
      else flips.add(kindOf(one[0]!.goal))
    }
    if (flips.size !== 2) fail(`the last place is a coin flip between the kinds (only saw ${[...flips].join()})`)
  }
  // Drop a taken job: no pay, no standing, the giver is free (tonight's offer may come now).
  {
    const d = three.find((j) => j.status === 'offered')!
    answer(d.giver, true)
    const before = { money: st().money, rep: st().rep() }
    st().dropJob(d.id)
    if (st().jobs.some((j) => j.id === d.id) || st().money !== before.money || st().rep() !== before.rep) fail('dropping a job removes it with no pay and no standing')
    if (st().jobAt(d.giver)?.id === d.id) fail('a dropped job frees its giver')
  }
  // Take one and finish it: it pays and earns standing; the giver is free, and tonight's
  // offers, which had no room at nightfall, come now (both kinds, one place each).
  const pickUp = offered()[0]!
  answer(pickUp.giver, true)
  const taken = st().openJobs()
  if (taken.length !== 1 || taken[0]!.id !== pickUp.id) fail('"I\'ll do it" takes the offered job')
  if (st().canTalk(pickUp.giver) && !st().sceneFor({ on: 'talk', character: pickUp.giver })) fail('a giver whose job you took has nothing new to offer')
  useStoryStore.setState({ standing: { dustwater: 0 }, money: 2000 * m })
  const moneyBefore = st().money
  const nightBefore = st().night
  finish(taken[0]!)
  if (st().jobs.some((j) => j.id === taken[0]!.id)) fail(`a finished job (${taken[0]!.goal.kind}) leaves the book`)
  const wantStanding = kindOf(taken[0]!.goal) === 'table' ? JOB_STANDING : 0
  if (st().rep() !== wantStanding) fail(`a finished ${kindOf(taken[0]!.goal)} job earns ${wantStanding} standing (got ${st().rep()})`)
  if (taken[0]!.goal.kind === 'minigame' && st().money !== moneyBefore + taken[0]!.pay * m) fail('a finished minigame job pays its pay in minimum bets, nothing else')
  if (st().night === nightBefore && heldHere().length !== JOB_LIMIT) fail(`a finished job frees a place for tonight's offer (got ${heldHere().length})`)
  // Many nights of taking and finishing everything.
  {
    const tableKeys = new Set<string>()
    const lastMini: Record<string, string> = {}
    const firstOf: Record<string, string[]> = {}
    const seen = new Set<string>()
    const note = () => {
      for (const j of st().jobs) {
        if (j.city !== 'dustwater' || seen.has(j.id)) continue
        seen.add(j.id)
        const list = (firstOf[`${j.giver}:${kindOf(j.goal)}`] ??= [])
        if (kindOf(j.goal) === 'table' || !list.includes(j.key)) list.push(j.key)
        if (kindOf(j.goal) === 'table') {
          if (tableKeys.has(j.key)) fail(`the town gave the table task ${j.key} twice`)
          tableKeys.add(j.key)
        } else {
          if (lastMini[j.giver] === j.key) fail(`${j.giver} offered the same minigame job twice in a row (${j.key})`)
          lastMini[j.giver] = j.key
        }
      }
    }
    // What was offered before, for the written order; table tasks given and no longer held
    // (done or dropped) count against repeats from here on.
    for (const j of [...first, ...night1, ...night2, ...three]) {
      const list = (firstOf[`${j.giver}:${kindOf(j.goal)}`] ??= [])
      if (!list.includes(j.key)) list.push(j.key)
    }
    const heldKeys = new Set(heldHere().map((j) => j.key))
    for (const k of st().jobsGiven.dustwater ?? []) if (!k.startsWith('minigame:') && !heldKeys.has(k)) tableKeys.add(k)
    let both = 0
    for (let n = 0; n < 30; n++) {
      // Take and finish everything, including offers a finished job brings tonight.
      for (let guard = 0; guard < 10 && (offered().length || st().openJobs().length); guard++) {
        note()
        for (const j of offered()) answer(j.giver, true)
        for (const j of st().openJobs()) { finish(j); note() }
        const here = heldHere()
        if (here.length > JOB_LIMIT) fail(`more than ${JOB_LIMIT} jobs at once (${here.length})`)
        if (new Set(here.map((j) => j.giver)).size !== here.length) fail('one person holds two jobs')
      }
      st().endNight()
      // With everything done, a night opens with a minigame job and a table job (until the
      // town runs out of new table tasks; Dustwater has about twenty).
      const tonight = offered().filter((j) => j.night === st().night)
      if (tonight.length > 2) fail(`more than two offers in one night (${tonight.length})`)
      if (kinds(tonight) === 'minigame,table') both++
      else {
        // Only once the town has no new table task left.
        const c = CITY_BY_ID.get('dustwater')!
        const left = makeOffers({ city: c, night: st().night, kinds: ['table'], held: [], given: st().jobsGiven.dustwater ?? [], games: c.games as never })
        if (left.length || kinds(tonight) !== 'minigame') fail(`a night with everything done brings a minigame job and a table job (night ${st().night}: ${kinds(tonight)})`)
      }
    }
    note()
    if (both < 10) fail(`with every job done, nights bring one minigame and one table job (only ${both} of 30)`)
    for (const g of givers) for (const k of ['minigame', 'table'] as const) {
      const written = WRITTEN_JOBS.filter((w) => w.city === 'dustwater' && w.giver === g && kindOf(w.goal) === k).map((w) => goalKey(w.goal))
      const theirs = firstOf[`${g}:${k}`] ?? []
      if (written.some((key, i) => theirs[i] !== key)) fail(`${g} offers their written ${k} jobs first, in order (got ${theirs.slice(0, written.length).join()})`)
    }
    if (st().rep() !== STANDING_MAX) fail('finishing jobs takes standing to the cap')
  }
  // Minigames are only played as jobs: one attempt. A miss loses the job (no pay); a hit
  // pays the job and earns no standing. Without a job a minigame does nothing.
  {
    const saved = { jobs: st().jobs, standing: st().standing, money: st().money }
    const mini = (giver: string, minigame: string, score: number): Job => ({
      id: `test:${giver}:${score}`, key: `minigame:${minigame}:${score}`, city: 'dustwater', giver, title: 'Test', task: 'Test',
      goal: { kind: 'minigame', minigame: minigame as never, score }, pay: 7, pitch: ['Test'], status: 'open', night: st().night,
    })
    useStoryStore.setState({ jobs: [], standing: { dustwater: 1 }, money: 100 * m })
    if (st().playMinigame('jo', 'chip-count', 1) !== 0 || st().money !== 100 * m) fail('without a minigame job, playing pays nothing')
    useStoryStore.setState({ jobs: [mini('jo', 'chip-count', 0.8)] })
    if (!st().minigameJobAt('jo')) fail("a taken minigame job lets you play Jo's Chip Count")
    if (st().playMinigame('jo', 'chip-count', 0.6) !== 0 || st().jobs.some((j) => j.id.startsWith('test:')) || st().money !== 100 * m) fail('a miss loses the minigame job and pays nothing')
    useStoryStore.setState({ jobs: [mini('marta', 'last-orders', 0.8)] })
    if (st().playMinigame('marta', 'last-orders', 0.8) !== 7 * m || st().rep() !== 1 || st().jobs.some((j) => j.id.startsWith('test:'))) fail('a hit pays the minigame job and earns no standing')
    useStoryStore.setState(saved)
  }
  // Leaving town keeps its jobs for your return; the new town starts with its own offers.
  const keptHere = heldHere().map((j) => j.id).sort().join()
  const jobsSaved = { jobs: st().jobs, jobsGiven: st().jobsGiven, jobNight: st().jobNight }
  // The night rules below run with no jobs on, so no job pays or moves standing mid-check.
  useStoryStore.setState({ jobs: [], jobNight: { dustwater: { night: Number.MAX_SAFE_INTEGER, kinds: [...NIGHT_KINDS] } } })

  // A night at the dive: table limit, bets, comps, the bonus and hustles at the end.
  useStoryStore.setState({ money: 200 * m, standing: { dustwater: 2 }, tonight: null })
  if (!st().venueOpen(1) || st().venueOpen(2)) fail('standing 2 opens the main floor, not the high-roller room')
  if (!st().startNight(0)) fail('a night at the dive starts')
  if (st().wagerCap() !== Math.min(st().money, 20 * m)) fail('the dive caps a bet at 20m')
  for (let k = 0; k < 3; k++) {
    st().placeBet('street-cups', m)
    st().resolve('street-cups', 2.5 * m, true)
  }
  st().placeBet('hilo', m)
  st().resolve('hilo', 3 * m, true)
  if (st().betsLeft() !== 8) fail('four rounds leave 8 of 12 bets')
  const tableWin = 3 * 1.5 * m + 2 * m
  let night = st().endNight()
  if (!night.played || night.comps !== Math.round(COMPS_RATE[0] * 4 * m) || night.lodging !== 3 * m || st().tonight) fail('the night ends with comps (the dive share of bets) and lodging')
  if (night.bonusRate !== STANDING_BONUS[2] || night.bonus !== standingBonus(2, tableWin) || night.bonus !== Math.round(0.05 * tableWin)) fail(`a night up at standing 2 adds 5% of the table win (got ${night.bonus})`)
  if (night.hustles.length !== 2) fail('two hustles on the board each night')
  st().startNight(1)
  st().placeBet('hilo', m)
  st().resolve('hilo', 0, true)
  night = st().endNight()
  if (night.bonus !== 0) fail('a night down earns no bonus')
  useStoryStore.setState({ standing: { dustwater: STANDING_MAX } })
  st().startNight(2)
  st().placeBet('hilo', 10 * m)
  st().resolve('hilo', 20 * m, true)
  if (st().endNight().bonus !== Math.round(0.2 * 10 * m)) fail('standing 5 adds 20% of a night\'s table win')
  if (st().queue.length) fail('an ordinary night queues no scene')

  // Comps by room: a better room gives a bigger share, each with its own cap.
  const standingBefore = st().standing
  for (const v of [1, 2] as const) {
    useStoryStore.setState({ money: 500 * m, standing: { dustwater: VENUE_REP[2] } })
    st().startNight(v)
    st().placeBet('hilo', 100 * m)
    st().resolve('hilo', 0, true)
    const n = st().endNight()
    if (n.comps !== Math.round(Math.min(COMPS_RATE[v] * 100 * m, COMPS_CAP_M[v] * m))) fail(`room ${v} comps are ${COMPS_RATE[v] * 100}% of bets`)
  }
  useStoryStore.setState({ money: 5000 * m, standing: { dustwater: VENUE_REP[2] } })
  st().startNight(2)
  for (let k = 0; k < 4; k++) { st().placeBet('hilo', 400 * m); st().resolve('hilo', 0, true) }
  if (st().endNight().comps !== COMPS_CAP_M[2] * m) fail(`room 2 comps stop at ${COMPS_CAP_M[2]}m`)
  useStoryStore.setState({ standing: standingBefore })
  // Lodging, and the free car below 10m.
  const before = st().money
  st().endNight()
  if (st().money !== before - 3 * m) fail('lodging is 3m a night')
  useStoryStore.setState({ money: 9 * m })
  st().endNight()
  if (st().money !== 9 * m) fail('below 10m you sleep in the car for free')
  // A bust: below the minimum after a night queues the bust scene and costs standing here.
  useStoryStore.setState({ money: 2 })
  const standingAtBust = st().rep()
  if (!st().endNight().bust || st().rep() !== standingAtBust - BUST_STANDING || !st().queue.includes('dustwater-bust')) fail('a bust costs standing and queues the bust scene')
  // Never below 0: a bust at standing 0 leaves it at 0, and another town is untouched.
  const standingAfterBust = st().standing
  useStoryStore.setState({ queue: [], money: 2, standing: { 'rattlesnake-junction': 2 } })
  st().endNight()
  if (st().rep() !== 0 || st().standing['rattlesnake-junction'] !== 2) fail('a bust never takes standing below 0 and only touches this town')
  useStoryStore.setState({ queue: [], standing: standingAfterBust })
  // A marker: lent 20m, repaid 1.5×, half of each win's profit.
  useStoryStore.setState({ money: 0 })
  if (!st().takeMarker() || st().money !== 20 * m || st().owed !== 30 * m) fail('a marker lends 20m and is owed at 30m')
  st().receive(10 * m, { profit: true })
  if (st().money !== 25 * m || st().owed !== 25 * m) fail('half of a win goes to the marker')
  // The boss: buy-in, loss and the 2-night wait, then a win and travel.
  useStoryStore.setState({ money: 200 * m, owed: 0 })
  if (!st().enterBoss() || st().money !== 150 * m || !st().bossTable) fail('the boss buy-in is 50m and seats you')
  st().bossResult(false)
  if (st().bossAvailable()) fail('the rival leaves after a loss')
  st().endNight()
  st().endNight()
  if (!st().bossAvailable()) fail('the rival is back after two nights')
  st().enterBoss()
  const sitting = st().money
  const standingAtBoss = st().rep()
  st().bossResult(true)
  if (!st().cleared.includes('dustwater') || st().money !== sitting + 150 * m) fail('a boss win pays 150m and clears the city')
  if (st().rep() !== standingAtBoss) fail('a boss win pays the purse and clears the town but gives no standing')
  const fare = st().fareToNext()!
  const holding = st().money
  useStoryStore.setState(jobsSaved)
  if (!st().travelNext() || st().city !== 'rattlesnake-junction' || st().money !== holding - fare || fare !== 200) fail('travel to the next city costs 20 of its minimum bets')
  if (st().jobs.filter((j) => j.city === 'dustwater').map((j) => j.id).sort().join() !== keptHere) fail('leaving a town keeps its jobs there for your return')
  // Rattlesnake Junction has no people written yet: Jo, who travels, offers there (one job, one person).
  const rj = st().jobs.filter((j) => j.city === 'rattlesnake-junction')
  const rjGivers = jobGivers('rattlesnake-junction').length
  if (rj.length !== Math.min(2, rjGivers) || (rjGivers >= 2 && kinds(rj) !== 'minigame,table')) fail(`the first night in a new town brings its offers (got ${rj.map((j) => j.giver + ':' + j.key).join()})`)
  if (st().openJobs().some((j) => j.city !== st().city)) fail('only this town\'s jobs can be worked here')
  if (st().rep() !== 0 || !st().venueOpen(0) || st().venueOpen(1)) fail('a town you have not worked starts you at standing 0')
  useStoryStore.setState({ standing: { dustwater: 1, 'rattlesnake-junction': 3 } })
  if (st().rep() !== 3 || !st().venueOpen(2)) fail('a town you go back to remembers its standing')
}

// ── A version 5 save moves onto the job system ──
{
  const v5 = {
    started: true,
    city: 'dustwater',
    night: 4,
    errands: { 'dustwater-marta-shift': 'done', 'dustwater-pike-marks': 'started' },
    jobs: [{ id: 'job:dustwater:4', city: 'dustwater', giver: 'jo', spawned: 4 }],
    queue: ['dustwater-jo-seed', 'dustwater-bust'],
    scene: { id: 'dustwater-pike-lesson', node: 'l1' },
    standing: { dustwater: 2 },
  }
  const out = migrateStorySave(v5, 5) as unknown as Record<string, unknown> & { jobs: unknown[]; jobsGiven: Record<string, string[]>; queue: string[]; scene: unknown; standing: Record<string, number> }
  if (out.jobs.length) fail('a migrated save drops open errands and old jobs (the town offers afresh)')
  if (out.jobsGiven.dustwater?.join() !== 'minigame:last-orders:0.8') fail(`a finished written job counts as given (got ${out.jobsGiven.dustwater?.join()})`)
  if ('errands' in out) fail('a migrated save has no errands left')
  if (out.queue.join() !== 'dustwater-bust' || out.scene) fail('scenes that are gone are never resumed or queued')
  if (out.standing.dustwater !== 2) fail('a migrated save keeps its standing')
  const v6 = migrateStorySave({ started: true, jobs: [], jobsGiven: { dustwater: ['night-up:0'] }, jobOffered: { dustwater: 3 } }, 6) as unknown as Record<string, unknown>
  if ('jobOffered' in v6 || JSON.stringify(v6.jobNight) !== '{}' || JSON.stringify(v6.jobsGiven) !== '{"dustwater":["night-up:0"]}') fail('a version 6 save moves onto two offers a night, keeping what was given')
}

// ── Chip Count (Jo) ──
{
  const rng = seeded(7)
  let g = chipCount.start(rng)
  for (let r = 0; r < chipCount.ROUNDS; r++) {
    if (g.stack.length !== chipCount.stackSize(r)) fail(`chip count stack ${r} has ${chipCount.stackSize(r)} chips`)
    if (g.options.length !== chipCount.OPTIONS || new Set(g.options).size !== chipCount.OPTIONS || !g.options.includes(g.answer)) fail('chip count offers four different totals, the right one among them')
    if (g.answer !== chipCount.total(g.stack)) fail('chip count answer is the stack total')
    g = chipCount.call(g, r % 2 ? null : g.answer, rng).state
  }
  if (!g.over || chipCount.score(g) !== 3 / 5) fail(`chip count: three right of five scores 60% (got ${chipCount.score(g)})`)
  let deals = 0
  for (let k = 0; k < 500; k++) { const d = chipCount.deal(seeded(k), k % chipCount.ROUNDS); if (d.options.length === chipCount.OPTIONS && d.options.every((v) => v > 0)) deals++ }
  if (deals !== 500) fail('every chip count deal has four positive totals')
}

console.log(`${SCENES.length} scenes, ${WRITTEN_JOBS.length} written jobs, ${CHARACTERS.length} characters, ${CITIES.length} cities`)
console.log(failed ? `${failed} checks failed` : 'All story content checks passed')
if (failed) process.exit(1)
