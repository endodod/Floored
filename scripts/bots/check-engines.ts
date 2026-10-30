/**
 * Spot checks for the table engines: hand ranking, side pots, chip
 * conservation and the Liar's Dice bid rules. Run with `pnpm check:tables`.
 */
import { evaluate, labelOf } from '@/games/holdem/evaluator'
import { buildPots, holdemCashOps } from '@/games/holdem/engine'
import { liarsCashOps, settleLiarsPot } from '@/games/liars-dice/cash'
import { showdownCashOps } from '@/games/blackjack-showdown/engine'
import { holdemCashDef, liarsCashDef, showdownCashDef } from '@/lib/tables/defs'
import { playCashTable } from '@/lib/tables/simulate'
import { cashStakeFor } from '@/lib/tables/stakes'
import { createRng } from '@/utils/rng'
import type { Card, HoldemSeat } from '@/games/holdem/types'
import { isRaise } from '@/games/liars-dice/engine'
import { holdemDef, liarsDef, showdownDef } from '@/lib/tables/defs'
import { playBotTable } from '@/lib/tables/simulate'
import { BOT_ROSTER } from '@/lib/bots/roster'

let failed = 0
function check(name: string, ok: boolean) {
  if (!ok) {
    failed++
    console.error(`FAIL ${name}`)
  }
}

const c = (s: string): Card => {
  const suit = { s: '♠', h: '♥', d: '♦', c: '♣' }[s.slice(-1)] as Card['suit']
  return { rank: s.slice(0, -1) as Card['rank'], suit }
}
const hand = (s: string) => s.split(' ').map(c)

// Ranking
check('royal flush label', labelOf(evaluate(hand('As Ks Qs Js 10s 2d 3c'))) === 'Royal Flush')
check('wheel straight', labelOf(evaluate(hand('Ah 2d 3c 4s 5h 9d Kc'))) === 'Straight')
check('wheel < six-high straight', evaluate(hand('Ah 2d 3c 4s 5h')) < evaluate(hand('2d 3c 4s 5h 6d')))
check('flush beats straight', evaluate(hand('2h 7h 9h Jh Kh 3c 4d')) > evaluate(hand('9c 10d Jh Qs Kc 2d 3s')))
check('full house from two trips', labelOf(evaluate(hand('9c 9d 9h 5s 5c 5d Ah'))) === 'Full House')
check('kicker decides', evaluate(hand('Ah Ad Kc 7s 4d 3c 2h')) > evaluate(hand('As Ac Qc 7d 4h 3s 2c')))
check('board plays: split', evaluate(hand('2c 3d Ah Kh Qh Jh 10h')) === evaluate(hand('4c 5d Ah Kh Qh Jh 10h')))
check('two pair: best kicker', evaluate(hand('Kh Kd 8c 8s 3d 3c Qh')) > evaluate(hand('Kc Ks 8h 8d 3h 3s Jh')))
check('quads kicker', evaluate(hand('7h 7d 7c 7s Ah 2c 3d')) > evaluate(hand('7h 7d 7c 7s Kh Qc Jd')))

// Side pots: A all-in 100, B all-in 300, C and D 500 each, D folded after putting in 500
const seat = (committed: number, folded = false): HoldemSeat => ({
  stack: 0, hole: [], bet: 0, committed, folded, allIn: !folded, out: false, startStack: committed, lastAction: null,
})
const pots = buildPots([seat(100), seat(300), seat(500), seat(500, true)])
check('three pots', pots.length === 3)
check('main pot 400', pots[0]?.amount === 400 && pots[0]?.eligible.length === 3)
check('side pot 600', pots[1]?.amount === 600 && pots[1]?.eligible.length === 2)
check('last pot 400 to C', pots[2]?.amount === 400 && pots[2]?.eligible.join() === '2')
check('pots hold every chip', pots.reduce((s, p) => s + p.amount, 0) === 1400)

// Liar's Dice bid ordering
check('open on 1s not allowed', !isRaise(null, { count: 3, face: 1 }))
check('higher face same count', isRaise({ count: 3, face: 4 }, { count: 3, face: 5 }))
check('lower face same count', !isRaise({ count: 3, face: 4 }, { count: 3, face: 2 }))
check('to 1s: half rounded up', isRaise({ count: 5, face: 4 }, { count: 3, face: 1 }) && !isRaise({ count: 5, face: 4 }, { count: 2, face: 1 }))
check('from 1s: double plus one', isRaise({ count: 3, face: 1 }, { count: 7, face: 2 }) && !isRaise({ count: 3, face: 1 }, { count: 6, face: 6 }))

// Chip conservation and table end across many seeded tables
const bots = (n: number) => BOT_ROSTER.slice(0, n).map((profile, i) => ({ profile, skill: (['rookie', 'regular', 'shark'] as const)[i % 3]! }))
for (let t = 0; t < 30; t++) {
  for (const seats of [6, 4, 2]) {
    const r = playBotTable(holdemDef, bots(seats), 900 + t)
    const chips = r.final.seats.reduce((s, x) => s + x.stack, 0)
    check(`hold'em ${seats}-max chips conserved (seed ${900 + t})`, chips === seats * r.final.config.startingStack)
    check(`hold'em ${seats}-max one winner`, r.final.seats.filter((x) => !x.out).length === 1)
    check(`hold'em ${seats}-max standings cover every seat`, r.standings.flat().length === seats)
  }
  const l = playBotTable(liarsDef, bots(4), 700 + t)
  check("liar's dice one player left", l.final.seats.filter((s) => !s.out).length === 1)
  const b = playBotTable(showdownDef, bots(4), 500 + t)
  check('showdown ends after 12 hands or one left', b.final.hand === 12 || b.final.seats.filter((s) => !s.out).length <= 1)
  check('showdown standings cover every seat', b.standings.flat().length === 4)
}

// ── Cash tables ──

// Liar's Dice pot: full antes all round → the winner takes everything.
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
check('liars pot: full antes, winner takes all', settleLiarsPot([50, 50, 50], 1).join() === '0,150,0')
// One short stack (20) wins: 20 from each, the rest goes back.
check('liars pot: short winner takes its size from each', settleLiarsPot([50, 20, 50], 1).join() === '30,60,30')
// Short stack loses: the winner takes all of it.
check('liars pot: short loser pays all it put in', settleLiarsPot([50, 20, 50], 0).join() === '120,0,0')
// Two short stacks, one wins.
check('liars pot: two short stacks', settleLiarsPot([50, 10, 30, 50], 2).join() === '20,0,100,20')
check('liars pot: payouts sum to the antes', [0, 1, 2, 3].every((w) => sum(settleLiarsPot([50, 10, 30, 50], w)) === 140))

const low = (game: 'holdem' | 'liars-dice' | 'blackjack-showdown') => cashStakeFor(game, 'low')
const rng = createRng(42)

// Hold'em: a newcomer posts one big blind (a live bet), then plays normally.
{
  let st = holdemCashDef.createCash(6, low('holdem'))
  for (const seat of [0, 1, 2]) st = holdemCashOps.sit(st, seat, 1000, false)
  st = holdemCashOps.sit(st, 4, 1000, true)
  st = holdemCashDef.engine.advance(st, rng)
  const posted = st.log.filter((e) => e.hand === 1 && e.seat === 4 && e.kind === 'big-blind')
  const blinds = st.log.filter((e) => e.hand === 1 && (e.kind === 'big-blind' || e.kind === 'small-blind')).length
  check("hold'em newcomer posts a big blind", posted.length === 1)
  check("hold'em newcomer flag clears after posting", !st.seats[4]!.newcomer)
  check("hold'em empty seats get no cards", st.seats[3]!.hole.length === 0 && st.seats[5]!.hole.length === 0)
  check("hold'em three blinds posted with a newcomer off the blinds", blinds === 3 || posted.length === 1)

  // Leaving out of turn folds; the chips already in stay in the pot, the rest leave with the player.
  const leaver = [0, 1, 2, 4].find((i) => i !== st.toAct && !st.seats[i]!.folded)!
  const before = sum(st.seats.map((x) => x.stack + x.committed))
  const after = holdemCashOps.leaveAction(st, leaver)
  check("hold'em leaving folds the seat", after.seats[leaver]!.folded)
  const out = holdemCashOps.stand(after, leaver)
  check("hold'em stand returns the stack behind", out.stack === after.seats[leaver]!.stack)
  check("hold'em leaving keeps every chip", sum(out.state.seats.map((x) => x.stack + x.committed)) + out.stack === before)
  check("hold'em the hand plays on after a leave", out.state.phase === 'betting' || out.state.phase === 'handOver')
}

// Hold'em: a cash table waits for a second player with chips.
{
  let st = holdemCashDef.createCash(6, low('holdem'))
  st = holdemCashOps.sit(st, 0, 500, false)
  check("hold'em one player: no deal", !holdemCashDef.engine.needsAdvance(st))
  st = holdemCashOps.sit(st, 1, 0, false)
  check("hold'em a 0-chip seat doesn't count", !holdemCashDef.engine.needsAdvance(st))
}

// Blackjack: below the minimum a seat may bet only its whole stack; chips at risk aren't "behind".
{
  let st = showdownCashDef.createCash(4, low('blackjack-showdown'))
  st = showdownCashOps.sit(st, 0, 7, false)
  st = showdownCashOps.sit(st, 1, 1000, false)
  st = showdownCashDef.engine.advance(st, rng)
  const seat = st.toAct!
  const legal = showdownCashDef.engine.viewFor(st, seat).legal!.bet!
  if (seat === 0) check('blackjack short stack: only all in', legal.min === 7 && legal.max === 7)
  else check('blackjack min bet at a cash table', legal.min === 10 && legal.max === 500)
  st = showdownCashDef.engine.apply(st, seat, { type: 'bet', amount: legal.min })
  check('blackjack a bet at risk is not behind', showdownCashOps.stackBehind(st, seat) === st.seats[seat]!.stack - legal.min)
  check('blackjack a placed bet is in play', showdownCashOps.inPlay(st, seat))
}

// Blackjack: leaving on your betting turn passes the turn on.
{
  let st = showdownCashDef.createCash(4, low('blackjack-showdown'))
  for (const seat of [0, 1, 2]) st = showdownCashOps.sit(st, seat, 1000, false)
  st = showdownCashDef.engine.advance(st, rng)
  const seat = st.toAct!
  const after = showdownCashOps.leaveAction(st, seat)
  check('blackjack leaving on your bet turn moves the turn', after.toAct !== seat)
  check('blackjack nothing at risk after leaving on your bet turn', !showdownCashOps.inPlay(after, seat))
}

// Liar's Dice: a 0-chip seat never antes; a short stack antes all it has; leaving voids the round.
{
  let st = liarsCashDef.createCash(4, low('liars-dice'))
  st = liarsCashOps.sit(st, 0, 0, false)
  st = liarsCashOps.sit(st, 1, 30, false)
  st = liarsCashOps.sit(st, 2, 500, false)
  st = liarsCashOps.sit(st, 3, 500, false)
  st = liarsCashDef.engine.advance(st, rng)
  check("liars 0-chip seat sits out", st.antes[0] === 0 && !st.seatMap.includes(0))
  check("liars short stack antes all it has", st.antes[1] === 30 && st.stacks[1] === 0)
  check("liars full antes", st.antes[2] === 50 && st.antes[3] === 50)
  const total = sum(st.stacks) + sum(st.antes)
  const after = liarsCashOps.leaveAction(st, 2)
  check("liars leaving voids the round", after.game == null || after.game.phase === 'reveal' || after.game.phase === 'over')
  check("liars leaving keeps every chip", sum(after.stacks) + sum(after.antes) === total)
  let empty = liarsCashDef.createCash(4, low('liars-dice'))
  empty = liarsCashOps.sit(empty, 0, 500, false)
  check("liars one player: no game, no ante", !liarsCashDef.engine.needsAdvance(empty))
}

// Chip conservation across long churning sessions: every chip brought is on the table or was taken away.
for (let t = 0; t < 8; t++) {
  for (const id of ['low', 'high'] as const) {
    const h = playCashTable(holdemCashDef, 'holdem', cashStakeFor('holdem', id), 6, 1300 + t, 300)
    check(`hold'em cash chips conserved (${id}, seed ${1300 + t})`, h.brought === h.takenAway + h.onTable)
    check(`hold'em cash no illegal actions (${id}, seed ${1300 + t})`, h.illegal === 0)
    check(`hold'em cash bots come and go (seed ${1300 + t})`, h.arrivals > 0 && h.departures > 0)
    const l = playCashTable(liarsCashDef, 'liars-dice', cashStakeFor('liars-dice', id), 4, 1400 + t, 40)
    check(`liars cash chips conserved (${id}, seed ${1400 + t})`, l.brought === l.takenAway + l.onTable)
    check(`liars cash no illegal actions (${id}, seed ${1400 + t})`, l.illegal === 0)
    const b = playCashTable(showdownCashDef, 'blackjack-showdown', cashStakeFor('blackjack-showdown', id), 4, 1500 + t, 300)
    check(`blackjack cash no illegal actions (${id}, seed ${1500 + t})`, b.illegal === 0)
    check(`blackjack cash no negative stacks (${id}, seed ${1500 + t})`, b.final.seats.every((x) => x.stack >= 0))
  }
}

console.log(failed ? `${failed} checks failed` : 'All table engine checks passed')
if (failed) process.exit(1)
