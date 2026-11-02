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
import { BOSS_BUYIN_M, MARKER_M, MARKER_REPAY } from '@/lib/story/economy'
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

// Numbers quoted in dialogue must match the economy.
const allText = SCENES.flatMap((s) => Object.values(s.nodes).flatMap((n) => (n.kind === 'line' ? [n.text] : [])))
const WORDS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 }
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
  if (!st().playQueued() || st().scene?.id !== 'dustwater-arrival') fail('a new story queues the arrival scene')
  let guard = 0
  while (st().scene && guard++ < 50) {
    const step = st().currentStep()!
    if (step.kind === 'choice') st().pick(step.options[2]!.index)
    else st().advance()
  }
  if (!st().flags['arrived-dustwater'] || st().factions.underground !== 1) fail('arrival scene effects (flag, faction) not applied')
  if (st().startScene('dustwater-arrival')) fail('a once-only scene played twice')
  // Minigames pay once per giver per night; a good shift finishes Marta's errand (once she's met).
  useStoryStore.setState({ flags: { ...st().flags, 'met-marta': true, 'met-pike': true } })
  const m0 = st().money
  const paid = st().playMinigame('marta', 'last-orders', 1)
  if (paid !== 3 * m || st().playMinigame('marta', 'last-orders', 1) !== 0) fail('minigame pays 3m at a perfect score, once a night')
  if (st().errands['dustwater-marta-shift'] !== 'done' || st().money !== m0 + 3 * m + 6 * m) fail('a perfect shift finishes the bar-shift errand (6m)')
  // A night at the dive: table limit, bets, a streak errand, comps and hustles at the end.
  if (st().startNight(2)) fail('the high-roller room needs reputation 3')
  if (!st().startNight(0)) fail('a night at the dive starts')
  if (st().wagerCap() !== Math.min(st().money, 20 * m)) fail('the dive caps a bet at 20m')
  for (let k = 0; k < 3; k++) {
    st().placeBet('street-cups', m)
    st().resolve('street-cups', 2.5 * m, true)
  }
  if (st().errands['dustwater-pike-marks'] !== 'done') fail('three Street Cups wins in a row finish Pike\'s errand')
  if (st().errands['dustwater-marta-bet'] === 'done') fail('a 2.5× win must not finish the 3× errand')
  st().placeBet('hilo', m)
  st().resolve('hilo', 3 * m, true)
  if (st().errands['dustwater-marta-bet'] !== 'done') fail('a 3× win finishes the trucker\'s-bet errand')
  if (st().betsLeft() !== 8) fail('four rounds leave 8 of 12 bets')
  const night = st().endNight()
  if (!night.played || night.comps !== Math.round(0.04 * 4 * m) || night.lodging !== 3 * m || st().tonight) fail('the night ends with comps (4% of bets) and lodging')
  if (st().errands['dustwater-jo-stake'] !== 'done') fail('a night up finishes Jo\'s seed-money errand')
  if (night.hustles.length !== 2) fail('two hustles on the board each night')
  // Lodging, and the free car below 10m.
  const before = st().money
  st().endNight()
  if (st().money !== before - 3 * m) fail('lodging is 3m a night')
  useStoryStore.setState({ money: 9 * m })
  st().endNight()
  if (st().money !== 9 * m) fail('below 10m you sleep in the car for free')
  // A bust: below the minimum after a night queues the bust scene and costs a reputation tier.
  useStoryStore.setState({ money: 2 })
  const rep = st().rep
  if (!st().endNight().bust || st().rep !== rep - 1 || !st().queue.includes('dustwater-bust')) fail('a bust costs reputation and queues the bust scene')
  useStoryStore.setState({ queue: [] })
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
  st().bossResult(true)
  if (!st().cleared.includes('dustwater') || st().money !== sitting + 150 * m) fail('a boss win pays 150m and clears the city')
  const fare = st().fareToNext()!
  const holding = st().money
  if (!st().travelNext() || st().city !== 'rattlesnake-junction' || st().money !== holding - fare || fare !== 200) fail('travel to the next city costs 20 of its minimum bets')
}

console.log(`${SCENES.length} scenes, ${ERRANDS.length} errands, ${CHARACTERS.length} characters, ${CITIES.length} cities`)
console.log(failed ? `${failed} checks failed` : 'All story content checks passed')
if (failed) process.exit(1)
