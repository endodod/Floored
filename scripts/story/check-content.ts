/**
 * Story content checks (.md/STORY_MODE_PLAN.md section 10). Run with
 * `pnpm check:story`. Fails on anything that would break a save or strand a
 * player:
 *  - ids unique; every character, city, errand and node a scene names exists;
 *  - every node reachable from the scene's start, every path ends (no dead ends),
 *    and a choice can never have all its options closed by its conditions;
 *  - every flag a condition reads is set somewhere;
 *  - every city has ERRANDS_PER_CITY errands on the night schedule (two on the
 *    first night, then one a night), each one handed out by a scene or a flag;
 *  - cities in rising stakes; every house game in at least two cities; every
 *    Tables game as both a cash room and a tournament;
 *  - shipped ids still exist (SHIPPED below: add to it, never remove from it).
 */
import { CITIES } from '@/lib/story/cities'
import { CHARACTERS, ERRANDS, SCENES } from '@/lib/story/content'
import {
  BONUS_STEPS, BOSS_BUYIN_M, BOSS_REMATCH_NIGHTS, BUST_STANDING, COMPS_CAP_M, COMPS_RATE, ERRAND_STANDING, ERRANDS_PER_CITY, GAMES_PER_ROOM, HUSTLES_PER_NIGHT,
  MARKER_M, MARKER_REPAY, NIGHT_BETS, STANDING_BONUS, STANDING_MAX, VENUE_MAX_M, VENUE_REP, errandStanding, errandsOutBy, standingBonus,
} from '@/lib/story/economy'
import { gamesFor } from '@/lib/story/rotation'
import type { Condition, Effect } from '@/lib/story/types'
import { GAMES } from '@/lib/game-catalog'
import type { TableGameName } from '@/lib/tables/types'
import { useStoryStore } from '@/store/story-store'

/** Ids that saves may already hold. Grow this list as content ships; never remove from it. */
const SHIPPED = {
  scenes: [] as string[],
  errands: [] as string[],
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
unique('errand', ERRANDS.map((e) => e.id))

const cityIds = new Set(CITIES.map((c) => c.id))
const characterIds = new Set(CHARACTERS.map((c) => c.id))
const errandIds = new Set(ERRANDS.map((e) => e.id))

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
    if ('errand' in e && !errandIds.has(e.errand)) fail(`${where}: unknown errand "${e.errand}"`)
  }
}
// Flags the game itself sets (outside content): boss results and travel.
for (const c of CITIES) setFlags.add(`${c.id}-cleared`)

for (const c of CHARACTERS) if (c.city && !cityIds.has(c.city)) fail(`character ${c.id}: unknown city "${c.city}"`)
for (const e of ERRANDS) {
  if (!cityIds.has(e.city)) fail(`errand ${e.id}: unknown city`)
  if (!characterIds.has(e.giver)) fail(`errand ${e.id}: unknown giver "${e.giver}"`)
  readCond(e.opens, `errand ${e.id}`)
  if (e.goal.kind === 'minigame') {
    const g = e.goal.minigame
    if (!CHARACTERS.some((c) => c.minigame === g && c.city === e.city)) fail(`errand ${e.id}: no one in ${e.city} offers the ${g} minigame`)
  }
  if (e.goal.kind === 'streak') {
    const city = CITIES.find((c) => c.id === e.city)
    if (city && city.games !== 'all-seen' && !city.games.includes(e.goal.game)) fail(`errand ${e.id}: ${e.goal.game} isn't played in ${e.city}`)
  }
  // Every errand earns standing, minigame jobs included (owner decision 2026-11-04).
  if (e.rep != null && (e.rep < 0 || e.rep > STANDING_MAX || !Number.isInteger(e.rep))) fail(`errand ${e.id}: rep ${e.rep} is not a standing step 0–${STANDING_MAX}`)
  if (errandStanding(e) === 0) fail(`errand ${e.id}: every errand should earn standing`)
}

// The standing path: each city with content has ERRANDS_PER_CITY errands that earn
// standing, enough to open both rooms and reach the top bonus (STANDING_MAX), and they
// come out on the schedule: two on the first night in the town, then one a night.
const startedBy = (id: string) =>
  SCENES.filter((sc) =>
    Object.values(sc.nodes).some((n) =>
      (n.kind === 'end' ? (n.effects ?? []) : n.kind === 'choice' ? n.options.flatMap((o) => o.effects ?? []) : []).some((e) => 'errand' in e && e.errand === id && e.step === 'start'),
    ),
  )
for (const c of CITIES) {
  const theirs = ERRANDS.filter((e) => e.city === c.id)
  if (!theirs.length) continue
  if (theirs.length !== ERRANDS_PER_CITY) fail(`city ${c.id}: ${theirs.length} errands (needs ${ERRANDS_PER_CITY})`)
  const standingFromJobs = theirs.reduce((n, e) => n + errandStanding(e), 0)
  if (standingFromJobs < STANDING_MAX) fail(`city ${c.id}: its jobs give standing ${standingFromJobs}, short of ${STANDING_MAX} (the top room and bonus)`)
  for (let n = 0; n < ERRANDS_PER_CITY; n++) {
    const out = theirs.filter((e) => e.night <= n).length
    if (out !== errandsOutBy(n)) fail(`city ${c.id}: ${out} errands out by night ${n}, the schedule says ${errandsOutBy(n)}`)
  }
  for (const e of theirs) {
    if (!Number.isInteger(e.night) || e.night < 0) fail(`errand ${e.id}: night ${e.night} is not a night in the town`)
    const scenes = startedBy(e.id)
    if (!scenes.length && !e.opens) fail(`errand ${e.id}: no scene hands it out and it has no opens condition`)
    for (const sc of scenes) {
      if (sc.city !== e.city) fail(`errand ${e.id}: handed out by ${sc.id} in another city`)
      // The giver hands it over: by talking to them, or (for Jo and anyone without a street spot) at dawn or on arrival.
      const by = sc.trigger.on === 'talk' ? sc.trigger.character : null
      if (by && by !== e.giver) fail(`errand ${e.id}: given by ${e.giver} but handed out when talking to ${by}`)
      if (e.night > 0 && sc.trigger.on !== 'talk' && sc.trigger.on !== 'dawn') fail(`errand ${e.id}: comes out on night ${e.night}, so a talk or dawn scene must hand it over (not ${sc.trigger.on})`)
    }
  }
  // The givers who want a word on the first night: one job each.
  const first = theirs.filter((e) => e.night === 0).map((e) => e.giver)
  if (new Set(first).size !== first.length) fail(`city ${c.id}: one person hands out two first-night jobs`)
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
  { re: /it goes up (\w+)/i, what: 'the standing an errand earns', want: (m) => [[word(m[1]), ERRAND_STANDING]] },
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
  { re: /Two people want a word on your first night, then (\w+) more each night after\. (\w+) jobs/i, what: 'the errand schedule', want: (m) => [[word(m[1]), 1], [word(m[2]), ERRANDS_PER_CITY]] },
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
for (const id of SHIPPED.errands) if (!errandIds.has(id)) fail(`shipped errand "${id}" is gone`)
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
  const out = () => st().openErrands().map((e) => e.id).sort().join()
  // Night 0: two people want a word (Marta and Pike), each with one job; nobody else yet.
  if (st().sceneFor({ on: 'talk', character: 'marta' }) !== 'dustwater-marta-first' || st().sceneFor({ on: 'talk', character: 'pike' }) !== 'dustwater-pike-first') fail('on the first night Marta and Pike want a word')
  if (out() !== '') fail('no errand is out before anyone hands it over')
  play('dustwater-marta-first')
  play('dustwater-pike-first')
  if (out() !== 'dustwater-marta-shift,dustwater-pike-marks') fail(`the first night gives two errands, got ${out()}`)
  if (st().sceneFor({ on: 'talk', character: 'marta' }) || st().sceneFor({ on: 'talk', character: 'pike' })) fail('Marta and Pike have nothing more to say on the first night (their next jobs wait)')
  // Minigames pay once per giver per night; a good shift finishes Marta's errand.
  const m0 = st().money
  const paid = st().playMinigame('marta', 'last-orders', 1)
  if (paid !== 3 * m || st().playMinigame('marta', 'last-orders', 1) !== 0) fail('minigame pays 3m at a perfect score, once a night')
  if (st().errands['dustwater-marta-shift'] !== 'done' || st().money !== m0 + 3 * m + 6 * m) fail('a perfect shift finishes the bar-shift errand (6m)')
  if (st().rep() !== 1 || !st().venueOpen(1) || st().venueOpen(2)) fail('standing 1 opens the main floor, not the high-roller room')
  // A night at the dive: table limit, bets, a streak errand, comps, the bonus and hustles at the end.
  if (!st().startNight(0)) fail('a night at the dive starts')
  if (st().wagerCap() !== Math.min(st().money, 20 * m)) fail('the dive caps a bet at 20m')
  for (let k = 0; k < 3; k++) {
    st().placeBet('street-cups', m)
    st().resolve('street-cups', 2.5 * m, true)
  }
  if (st().errands['dustwater-pike-marks'] !== 'done') fail('three Street Cups wins in a row finish Pike\'s errand')
  if (st().rep() !== 2 || st().venueOpen(2)) fail('a second errand earns standing 2, which raises the bonus but opens no room')
  st().placeBet('hilo', m)
  st().resolve('hilo', 3 * m, true)
  if (st().errands['dustwater-marta-bet']) fail('a job that is not out yet can\'t be finished')
  if (st().betsLeft() !== 8) fail('four rounds leave 8 of 12 bets')
  const tableWin = 3 * 1.5 * m + 2 * m
  let night = st().endNight()
  if (!night.played || night.comps !== Math.round(COMPS_RATE[0] * 4 * m) || night.lodging !== 3 * m || st().tonight) fail('the night ends with comps (the dive share of bets) and lodging')
  if (night.bonusRate !== STANDING_BONUS[2] || night.bonus !== standingBonus(2, tableWin) || night.bonus !== Math.round(0.05 * tableWin)) fail(`a night up at standing 2 adds 5% of the table win (got ${night.bonus})`)
  if (night.hustles.length !== 2) fail('two hustles on the board each night')
  // Night 1: Jo, at dawn, with the seed-money job.
  if (st().queue.join() !== 'dustwater-jo-seed') fail(`the morning after the first night queues Jo's job (got ${st().queue.join()})`)
  play(st().queue[0]!)
  useStoryStore.setState({ queue: [] })
  if (out() !== 'dustwater-jo-stake') fail(`night 1 brings out one more errand, got ${out()}`)
  if (st().sceneFor({ on: 'talk', character: 'marta' })) fail('Marta\'s second job waits for night 2')
  st().startNight(1)
  st().placeBet('hilo', m)
  st().resolve('hilo', 0, true)
  night = st().endNight()
  if (night.bonus !== 0) fail('a night down earns no bonus')
  if (st().errands['dustwater-jo-stake'] === 'done') fail('a night down does not finish the seed-money errand')
  // Night 2: Marta's trucker; a 3× win finishes it.
  if (st().queue.length) fail('no dawn scene once Jo\'s job is out')
  play(st().sceneFor({ on: 'talk', character: 'marta' }) ?? 'missing')
  if (out() !== 'dustwater-jo-stake,dustwater-marta-bet') fail(`night 2 brings out Marta's second job, got ${out()}`)
  st().startNight(1)
  st().placeBet('hilo', m)
  st().resolve('hilo', 3 * m, true)
  if (st().errands['dustwater-marta-bet'] !== 'done' || st().rep() !== 3 || !st().venueOpen(2)) fail('a 3× win finishes the trucker\'s bet; standing 3 opens the high-roller room')
  night = st().endNight()
  if (st().errands['dustwater-jo-stake'] !== 'done' || st().rep() !== 4) fail('a night up finishes Jo\'s seed money (standing 4)')
  if (night.bonusRate !== STANDING_BONUS[4] || night.bonus !== standingBonus(4, 2 * m)) fail('the bonus uses standing as the night closes (a job finished tonight counts)')
  // Night 3: Pike's lesson, his minigame at 4 of 5.
  play(st().sceneFor({ on: 'talk', character: 'pike' }) ?? 'missing')
  st().playMinigame('pike', 'shuffle-tracker', 0.6)
  if (st().errands['dustwater-pike-lesson'] === 'done') fail('3 of 5 shuffles is not enough for Pike\'s lesson')
  st().playMinigame('pike', 'shuffle-tracker', 0.8)
  if (st().errands['dustwater-pike-lesson'] !== 'done' || st().rep() !== 5) fail('Dustwater\'s five errands reach standing 5')
  if (st().sceneFor({ on: 'talk', character: 'marta' }) || st().sceneFor({ on: 'talk', character: 'pike' }) || out() !== '') fail('every job is out and done after night 3')
  st().startNight(2)
  st().placeBet('hilo', 10 * m)
  st().resolve('hilo', 20 * m, true)
  if (st().endNight().bonus !== Math.round(0.2 * 10 * m)) fail('standing 5 adds 20% of a night\'s table win')
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
  if (!st().travelNext() || st().city !== 'rattlesnake-junction' || st().money !== holding - fare || fare !== 200) fail('travel to the next city costs 20 of its minimum bets')
  if (st().rep() !== 0 || !st().venueOpen(0) || st().venueOpen(1)) fail('a town you have not worked starts you at standing 0')
  useStoryStore.setState({ standing: { dustwater: 1, 'rattlesnake-junction': 3 } })
  if (st().rep() !== 3 || !st().venueOpen(2)) fail('a town you go back to remembers its standing')
}

console.log(`${SCENES.length} scenes, ${ERRANDS.length} errands, ${CHARACTERS.length} characters, ${CITIES.length} cities`)
console.log(failed ? `${failed} checks failed` : 'All story content checks passed')
if (failed) process.exit(1)
