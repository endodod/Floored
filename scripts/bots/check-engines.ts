/**
 * Spot checks for the table engines: hand ranking, side pots, chip
 * conservation and the Liar's Dice bid rules. Run with `pnpm check:tables`.
 */
import { evaluate, labelOf } from '@/games/holdem/evaluator'
import { buildPots } from '@/games/holdem/engine'
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

console.log(failed ? `${failed} checks failed` : 'All table engine checks passed')
if (failed) process.exit(1)
