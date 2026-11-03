/**
 * Story content checks (.md/STORY_MODE_PLAN.md section 10). Run with
 * `pnpm check:story`. Fails on anything that would break a save or strand a
 * player:
 *  - ids unique; every character, city, errand and node a scene names exists;
 *  - every node reachable from the scene's start, every path ends (no dead ends),
 *    and a choice can never have all its options closed by its conditions;
 *  - every flag a condition reads is set somewhere;
 *  - cities in rising stakes; every house game in at least two cities; every
 *    Tables game as both a cash room and a tournament;
 *  - shipped ids still exist (SHIPPED below: add to it, never remove from it).
 */
import { CITIES } from '@/lib/story/cities'
import { CHARACTERS, ERRANDS, SCENES } from '@/lib/story/content'
import { BOSS_BUYIN_M, BOSS_REMATCH_NIGHTS, COMPS_CAP_M, COMPS_RATE, GAMES_PER_ROOM, HUSTLES_PER_NIGHT, MARKER_M, MARKER_REPAY, NIGHT_BETS, VENUE_MAX_M } from '@/lib/story/economy'
import { gamesFor } from '@/lib/story/rotation'
import type { Condition, Effect } from '@/lib/story/types'
import { GAMES } from '@/lib/game-catalog'
import type { TableGameName } from '@/lib/tables/types'
import { useStoryStore, VENUE_REP } from '@/store/story-store'

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
  if (e.rep !== undefined) {
    if (e.rep < 0) fail(`errand ${e.id}: rep cannot be negative`)
    if (e.goal.kind === 'minigame' && e.rep !== 0) fail(`errand ${e.id}: minigame errand must have rep 0`)
  }
  if (e.goal.kind === 'minigame') {
    const g = e.goal.minigame
    if (!CHARACTERS.some((c) => c.minigame === g && c.city === e.city)) fail(`errand ${e.id}: no one in ${e.city} offers the ${g} minigame`)
  }
  if (e.goal.kind === 'streak') {
    const city = CITIES.find((c) => c.id === e.city)
    if (city && city.games !== 'all-seen' && !city.games.includes(e.goal.game)) fail(`errand ${e.id}: ${e.goal.game} isn't played in ${e.city}`)
  }
}

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

// Every city needs at least 3 gambling errands so the high-roller room opens before the boss.
for (const c of CITIES) {
  const cityErrands = ERRANDS.filter((e) => e.city === c.id)
  if (cityErrands.length > 0) {
    const gambling = cityErrands.filter((e) => e.goal.kind !== 'minigame')
    if (gambling.length < 3) fail(`city ${c.id}: needs at least 3 gambling errands for standing (has ${gambling.length})`)
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
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100 }
const word = (w: string | undefined) => WORDS[(w ?? '').toLowerCase()]
// Jo's walkthrough (and any line in the same shape) must quote the economy as it is.
const QUOTES: { re: RegExp; what: string; want: (m: RegExpMatchArray) => [number | undefined, number | null][] }[] = [
  { re: /^The dive takes anyone\..*up to (?:a )?(\w+) times/i, what: 'the dive limit', want: (m) => [[word(m[1]), VENUE_MAX_M[0]]] },
  { re: /^The main floor wants standing (\w+)\..*up to (?:a )?(\w+) times/i, what: 'the main floor', want: (m) => [[word(m[1]), VENUE_REP[1]], [word(m[2]), VENUE_MAX_M[1]]] },
  { re: /^The high-roller room wants standing (\w+)/i, what: 'the high-roller room', want: (m) => [[word(m[1]), VENUE_REP[2]]] },
  { re: /(\w+) bets a night/i, what: 'bets a night', want: (m) => [[word(m[1]), NIGHT_BETS]] },
  { re: /its own (\w+) games/i, what: 'games per room', want: (m) => [[word(m[1]), GAMES_PER_ROOM]] },
  { re: /(\w+) side goals/i, what: 'hustles a night', want: (m) => [[word(m[1]), HUSTLES_PER_NIGHT]] },
  { re: /back after (\w+) nights/i, what: 'the rematch wait', want: (m) => [[word(m[1]), BOSS_REMATCH_NIGHTS]] },
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
  // Standing: a new story starts at standing 0 with only the dive open.
  if (st().rep() !== 0) fail('a new story starts at standing 0')
  if (!st().venueOpen(0)) fail('the dive is open at standing 0')
  if (st().venueOpen(1)) fail('the main floor requires standing 1')
  if (st().venueOpen(2)) fail('the high-roller room requires standing 2')

  // Minigames pay once per giver per night; a good shift finishes Marta's errand (once she's met) without giving standing.
  useStoryStore.setState({ flags: { ...st().flags, 'met-marta': true, 'met-pike': true } })
  const m0 = st().money
  const paid = st().playMinigame('marta', 'last-orders', 1)
  if (paid !== 3 * m || st().playMinigame('marta', 'last-orders', 1) !== 0) fail('minigame pays 3m at a perfect score, once a night')
  if (st().errands['dustwater-marta-shift'] !== 'done' || st().money !== m0 + 3 * m + 6 * m) fail('a perfect shift finishes the bar-shift errand (6m)')
  if (st().rep() !== 0) fail('a minigame errand must give no standing')

  // A night at the dive: table limit, bets, a streak errand, comps and hustles at the end.
  if (st().startNight(2)) fail('the high-roller room needs standing 2')
  if (st().startNight(1)) fail('the main floor needs standing 1')
  if (!st().startNight(0)) fail('a night at the dive starts')
  if (st().wagerCap() !== Math.min(st().money, 20 * m)) fail('the dive caps a bet at 20m')
  for (let k = 0; k < 3; k++) {
    st().placeBet('street-cups', m)
    st().resolve('street-cups', 2.5 * m, true)
  }
  if (st().errands['dustwater-pike-marks'] !== 'done' || st().rep() !== 1) fail('three Street Cups wins finish Pike\'s errand and give standing 1')
  if (!st().venueOpen(1)) fail('standing 1 opens the main floor')
  if (st().venueOpen(2)) fail('standing 1 does not open the high-roller room')
  if (st().errands['dustwater-marta-bet'] === 'done') fail('a 2.5× win must not finish the 3× errand')
  st().placeBet('hilo', m)
  st().resolve('hilo', 3 * m, true)
  if (st().errands['dustwater-marta-bet'] !== 'done' || st().rep() !== 2) fail('a 3× win finishes the trucker\'s-bet errand and gives standing 2')
  if (!st().venueOpen(2)) fail('standing 2 opens the high-roller room')
  if (st().betsLeft() !== 8) fail('four rounds leave 8 of 12 bets')
  const night = st().endNight()
  if (!night.played || night.comps !== Math.round(COMPS_RATE[0] * 4 * m) || night.lodging !== 3 * m || st().tonight) fail('the night ends with comps (the dive share of bets) and lodging')
  if (st().errands['dustwater-jo-stake'] !== 'done' || st().rep() !== 3) fail('a night up finishes Jo\'s seed-money errand and gives standing 3')
  if (night.hustles.length !== 2) fail('two hustles on the board each night')

  // Comps by room: a better room gives a bigger share, each with its own cap.
  const repBefore = st().rep()
  for (const v of [1, 2] as const) {
    useStoryStore.setState({ money: 500 * m, standing: { dustwater: 2 } })
    st().startNight(v)
    st().placeBet('hilo', 100 * m)
    st().resolve('hilo', 0, true)
    const n = st().endNight()
    if (n.comps !== Math.round(Math.min(COMPS_RATE[v] * 100 * m, COMPS_CAP_M[v] * m))) fail(`room ${v} comps are ${COMPS_RATE[v] * 100}% of bets`)
  }
  useStoryStore.setState({ money: 5000 * m, standing: { dustwater: 2 } })
  st().startNight(2)
  for (let k = 0; k < 4; k++) { st().placeBet('hilo', 400 * m); st().resolve('hilo', 0, true) }
  if (st().endNight().comps !== COMPS_CAP_M[2] * m) fail(`room 2 comps stop at ${COMPS_CAP_M[2]}m`)
  useStoryStore.setState({ standing: { dustwater: repBefore } })

  // Lodging, and the free car below 10m.
  const before = st().money
  st().endNight()
  if (st().money !== before - 3 * m) fail('lodging is 3m a night')
  useStoryStore.setState({ money: 9 * m })
  st().endNight()
  if (st().money !== 9 * m) fail('below 10m you sleep in the car for free')

  // A bust: below the minimum after a night queues the bust scene and costs standing (never below 0).
  useStoryStore.setState({ money: 2, standing: { dustwater: 2 } })
  const rep = st().rep()
  if (!st().endNight().bust || st().rep() !== rep - 1 || !st().queue.includes('dustwater-bust')) fail('a bust costs standing and queues the bust scene')
  useStoryStore.setState({ queue: [] })

  // A marker: lent 20m, repaid 1.5×, half of each win's profit.
  useStoryStore.setState({ money: 0 })
  if (!st().takeMarker() || st().money !== 20 * m || st().owed !== 30 * m) fail('a marker lends 20m and is owed at 30m')
  st().receive(10 * m, { profit: true })
  if (st().money !== 25 * m || st().owed !== 25 * m) fail('half of a win goes to the marker')

  // The boss: buy-in, loss and the 2-night wait, then a win and travel. Boss win does NOT give standing.
  useStoryStore.setState({ money: 200 * m, owed: 0 })
  if (!st().enterBoss() || st().money !== 150 * m || !st().bossTable) fail('the boss buy-in is 50m and seats you')
  st().bossResult(false)
  if (st().bossAvailable()) fail('the rival leaves after a loss')
  st().endNight()
  st().endNight()
  if (!st().bossAvailable()) fail('the rival is back after two nights')
  st().enterBoss()
  const sitting = st().money
  const standingBeforeBoss = st().rep()
  st().bossResult(true)
  if (!st().cleared.includes('dustwater') || st().money !== sitting + 150 * m) fail('a boss win pays 150m and clears the city')
  if (st().rep() !== standingBeforeBoss) fail('a boss win must not give standing')
  const fare = st().fareToNext()!
  const holding = st().money
  if (!st().travelNext() || st().city !== 'rattlesnake-junction' || st().money !== holding - fare || fare !== 200) fail('travel to the next city costs 20 of its minimum bets')
  if (st().rep() !== 0) fail('a new town starts with standing 0')
}

console.log(`${SCENES.length} scenes, ${ERRANDS.length} errands, ${CHARACTERS.length} characters, ${CITIES.length} cities`)
console.log(failed ? `${failed} checks failed` : 'All story content checks passed')
if (failed) process.exit(1)
