/**
 * Spot checks for the table engines: hand ranking, side pots, chip
 * conservation and the Liar's Dice bid rules. Run with `pnpm check:tables`.
 */
import { evaluate, labelOf } from '@/games/holdem/evaluator'
import { buildPots } from '@/games/holdem/engine'
import type { Card, HoldemSeat } from '@/games/holdem/types'
import { isRaise } from '@/games/liars-dice/engine'
import { holdemCashDef, holdemDef, liarsCashDef, liarsDef, showdownCashDef, showdownDef } from '@/lib/tables/defs'
import { playBotTable, playCashTable } from '@/lib/tables/simulate'
import { settleLiarsPot } from '@/games/liars-dice/cash'
import { cashStakeFor } from '@/lib/tables/stakes'
import { createRng } from '@/utils/rng'
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

// Liar's Dice pot with short antes: the winner takes at most its own ante from each player.
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
check('liars pot: full antes, winner takes all', settleLiarsPot([50, 50, 50, 50], 2).join() === '0,0,200,0')
check('liars pot: one short stack loses its ante', settleLiarsPot([20, 50, 50, 50], 1).join() === '0,170,0,0')
check('liars pot: short winner gets back only its share', settleLiarsPot([20, 50, 50, 50], 0).join() === '80,30,30,30')
check('liars pot: two short stacks', settleLiarsPot([20, 35, 50, 50], 1).join() === '0,125,15,15' && sum(settleLiarsPot([20, 35, 50, 50], 1)) === 155)

// Hold'em: a newcomer posts one big blind on top of the blinds, live.
{
  const stake = cashStakeFor('holdem', 'low')
  let s = holdemCashDef.createCash(6, stake)
  s = holdemCashDef.ops.sit(s, 0, 1000, false)
  s = holdemCashDef.ops.sit(s, 1, 1000, false)
  s = holdemCashDef.ops.sit(s, 2, 1000, false)
  s = holdemCashDef.ops.sit(s, 4, 1000, true)
  check("hold'em cash: empty seats aren't dealt", holdemCashDef.engine.needsAdvance(s))
  s = holdemCashDef.engine.advance(s, createRng(3))
  const posted = s.seats.map((x) => x.committed)
  const bb = stake.limits.blinds![1]
  // The first two posts are the small and big blind; a newcomer in either spot posts no extra blind.
  const newcomerIsBlind = s.log.slice(0, 2).filter((e) => e.seat === 4).length
  check("hold'em cash: newcomer posts a big blind", posted[4] === bb || (newcomerIsBlind > 0 && posted[4]! > 0))
  check("hold'em cash: empty seats have no cards", s.seats[3]!.hole.length === 0 && s.seats[5]!.hole.length === 0)
  check("hold'em cash: pot is blinds plus the newcomer's", sum(posted) === stake.limits.blinds![0] + bb + (newcomerIsBlind ? 0 : bb))
  check("hold'em cash: newcomer flag clears", !s.seats[4]!.newcomer)
  // Leaving out of turn folds the hand; the seat on the clock keeps its turn.
  const turn = s.toAct!
  const leaver = [0, 1, 2, 4].find((i) => i !== turn && !s.seats[i]!.folded)!
  const left = holdemCashDef.ops.leaveAction(s, leaver)
  check("hold'em cash: leaving out of turn folds", left.seats[leaver]!.folded && left.toAct === turn)
  const stood = holdemCashDef.ops.stand(left, leaver)
  check("hold'em cash: standing keeps chips in the pot", sum(stood.state.seats.map((x) => x.committed)) === sum(posted) && stood.stack === left.seats[leaver]!.stack)
  // A seat with no chips is not dealt in.
  let z = holdemCashDef.createCash(4, stake)
  z = holdemCashDef.ops.sit(z, 0, 0, false)
  z = holdemCashDef.ops.sit(z, 1, 500, false)
  z = holdemCashDef.ops.sit(z, 2, 500, false)
  z = holdemCashDef.engine.advance(z, createRng(5))
  check("hold'em cash: 0 chips sits out", z.seats[0]!.hole.length === 0 && z.seats[0]!.committed === 0)
  let one = holdemCashDef.createCash(4, stake)
  one = holdemCashDef.ops.sit(one, 1, 500, false)
  check("hold'em cash: one player waits", !holdemCashDef.engine.needsAdvance(one))
}

// Liar's Dice: a 0-chip seat never antes; leaving gives up the dice; rounds roll inside a game.
{
  const stake = cashStakeFor('liars-dice', 'low')
  let s = liarsCashDef.createCash(4, stake)
  s = liarsCashDef.ops.sit(s, 0, 0, false)
  s = liarsCashDef.ops.sit(s, 1, 30, false)
  s = liarsCashDef.ops.sit(s, 2, 500, false)
  s = liarsCashDef.ops.sit(s, 3, 500, false)
  s = liarsCashDef.engine.advance(s, createRng(9))
  check("liar's cash: 0 chips never antes", s.antes[0] === 0 && !s.seatMap.includes(0))
  check("liar's cash: a short stack antes all it has", s.antes[1] === 30 && s.stacks[1] === 0)
  check("liar's cash: pot is the antes", liarsCashDef.engine.viewFor(s, 2).pot === 130)
  const seat = s.seatMap[s.game!.toAct!]!
  const after = liarsCashDef.engine.apply(s, seat, { type: 'bid', bid: { count: 1, face: 2 } })
  const next = liarsCashDef.engine.toAct(after)!
  const called = liarsCashDef.engine.apply(after, next, { type: 'liar' })
  check("liar's cash: the next round rolls inside the game", called.game?.phase === 'reveal' && liarsCashDef.engine.needsAdvance(called) && !liarsCashDef.ops.betweenHands(called))
  const rolled = liarsCashDef.engine.advance(called, createRng(2))
  check("liar's cash: next round is bidding", rolled.game?.phase === 'bidding' && rolled.games === s.games)
  const leaving = liarsCashDef.ops.leaveAction(rolled, 3)
  check("liar's cash: leaving gives up the dice", !liarsCashDef.ops.inPlay(leaving, 3) && leaving.antes[3] === 50)
  let two = liarsCashDef.createCash(4, stake)
  two = liarsCashDef.ops.sit(two, 0, 100, false)
  check("liar's cash: one player waits, no ante taken", !liarsCashDef.engine.needsAdvance(two) && liarsCashDef.engine.advance(two, createRng(1)).stacks[0] === 100)
}

// Blackjack: short-stack bets and doubles, sitting out at 0, leaving before the bet.
{
  const stake = cashStakeFor('blackjack-showdown', 'mid')
  let s = showdownCashDef.createCash(4, stake)
  s = showdownCashDef.ops.sit(s, 0, 37, false)
  s = showdownCashDef.ops.sit(s, 1, 0, false)
  s = showdownCashDef.ops.sit(s, 2, 5000, false)
  s = showdownCashDef.engine.advance(s, createRng(4))
  check('blackjack cash: 0 chips sits the hand out', !!s.seats[1]!.idle)
  const order: number[] = []
  let st = s
  for (let k = 0; k < 4 && st.phase === 'betting'; k++) {
    const seat = st.toAct!
    order.push(seat)
    const legal = showdownCashDef.engine.viewFor(st, seat).legal!.bet!
    if (seat === 0) check('blackjack cash: below the minimum only the whole stack', legal.min === 37 && legal.max === 37)
    st = showdownCashDef.engine.apply(st, seat, { type: 'bet', amount: legal.min })
  }
  check('blackjack cash: idle and empty seats never bet', !order.includes(1) && !order.includes(3))
  check("blackjack cash: a bet down isn't behind", st.phase === 'betting' || showdownCashDef.ops.stackBehind(st, 0) === 0)
  // Leaving before your bet sits the hand out at once.
  let l = showdownCashDef.createCash(4, stake)
  l = showdownCashDef.ops.sit(l, 0, 1000, false)
  l = showdownCashDef.ops.sit(l, 2, 1000, false)
  l = showdownCashDef.engine.advance(l, createRng(8))
  const before = l.toAct!
  const gone = showdownCashDef.ops.leaveAction(l, before)
  check('blackjack cash: leaving before the bet passes the turn', gone.toAct !== before && !!gone.seats[before]!.idle && !showdownCashDef.ops.inPlay(gone, before))
  // A short double doubles for the rest of the stack.
  const dbl = { ...l, phase: 'playing' as const, toAct: 0, seats: l.seats.map((x, i) => (i === 0 ? { ...x, stack: 150, bet: 100, cards: [{ rank: '5' as const, suit: '♠' as const }, { rank: '6' as const, suit: '♥' as const }] } : x)) }
  const legal = showdownCashDef.engine.viewFor(dbl, 0).legal!
  check('blackjack cash: short double allowed', legal.canDouble)
  const doubled = showdownCashDef.engine.apply(dbl, 0, { type: 'double' })
  check('blackjack cash: short double bets the rest', doubled.seats[0]!.bet === 150)
}

// Whole sessions with churn: chips conserved, no illegal actions, empty seats never act.
for (let t = 0; t < 3; t++) {
  for (const stakeId of ['low', 'high'] as const) {
    const h = playCashTable(holdemCashDef, 'holdem', cashStakeFor('holdem', stakeId), 6, 300 + t, 60)
    check(`hold'em cash session (${stakeId}, seed ${300 + t}) conserves chips`, h.conservationErrors === 0 && h.illegal === 0 && h.hands >= 60)
    const d = playCashTable(liarsCashDef, 'liars-dice', cashStakeFor('liars-dice', stakeId), 4, 400 + t, 10)
    check(`liar's cash session (${stakeId}, seed ${400 + t}) conserves chips`, d.conservationErrors === 0 && d.illegal === 0 && d.hands >= 10)
    const b = playCashTable(showdownCashDef, 'blackjack-showdown', cashStakeFor('blackjack-showdown', stakeId), 4, 500 + t, 150)
    check(`blackjack cash session (${stakeId}, seed ${500 + t}) conserves chips`, b.conservationErrors === 0 && b.illegal === 0 && b.hands >= 150)
  }
}

console.log(failed ? `${failed} checks failed` : 'All table engine checks passed')
if (failed) process.exit(1)
