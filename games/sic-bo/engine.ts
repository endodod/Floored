import type { SicBoBets, SicBoRoll, SicBoState, SicBoTarget } from './types'

export const ALL_ROLLS: SicBoRoll[] = Array.from({ length: 6 }, (_, a) => Array.from({ length: 6 }, (_, b) => Array.from({ length: 6 }, (_, c) => [a + 1, b + 1, c + 1] as SicBoRoll))).flat(2)
const TOTAL_MULTS: Record<number, number> = { 4: 70, 5: 35, 6: 21, 7: 14, 8: 10, 9: 8.4, 10: 7.75, 11: 7.75, 12: 8.4, 13: 10, 14: 14, 15: 21, 16: 35, 17: 70 }

export function returnFor(target: SicBoTarget, roll: SicBoRoll): number {
  const total = roll[0] + roll[1] + roll[2], triple = roll[0] === roll[1] && roll[1] === roll[2]
  if (target === 'small') return !triple && total >= 4 && total <= 10 ? 2 : 0
  if (target === 'big') return !triple && total >= 11 && total <= 17 ? 2 : 0
  if (target === 'any-triple') return triple ? 35 : 0
  if (target.startsWith('total-')) return total === Number(target.slice(6)) ? TOTAL_MULTS[total]! : 0
  const face = Number(target.slice(target.indexOf('-') + 1)), hits = roll.filter(die => die === face).length
  return target.startsWith('double-') ? hits >= 2 ? 13 : 0 : hits === 1 ? 2 : hits === 2 ? 3 : hits === 3 ? 15 : 0
}
export function payoutForRoll(bets: SicBoBets, roll: SicBoRoll): number { return (Object.entries(bets) as [SicBoTarget, number][]).reduce((sum, [target, amount]) => sum + Math.floor(Math.max(0, amount) * returnFor(target, roll)), 0) }
export function settleSicBo(bets: SicBoBets, dice: SicBoRoll): SicBoState {
  const totalBetAmount = Object.values(bets).reduce((sum, amount) => sum + Math.max(0, amount ?? 0), 0), totalPayout = payoutForRoll(bets, dice)
  const outcome = totalPayout > totalBetAmount ? 'win' : totalPayout === totalBetAmount ? 'push' : 'loss'
  return { stage: 'settled', dice, totalBetAmount, totalPayout, outcome, message: `${dice.join(' · ')} = ${dice[0] + dice[1] + dice[2]}${outcome === 'win' ? ' — Win!' : outcome === 'push' ? ' — Push.' : totalPayout ? ' — Partial.' : ' — No win.'}` }
}
export function rollSicBo(bets: SicBoBets): SicBoState { return settleSicBo(bets, ALL_ROLLS[Math.floor(Math.random() * ALL_ROLLS.length)]!) }
export function bestPayout(bets: SicBoBets): number { return Math.max(...ALL_ROLLS.map(roll => payoutForRoll(bets, roll))) }
function pick(bets: SicBoBets, test: (payout: number, total: number) => boolean, fallback: 'max' | 'min') {
  const total = Object.values(bets).reduce((sum, amount) => sum + Math.max(0, amount ?? 0), 0), pool = ALL_ROLLS.filter(roll => test(payoutForRoll(bets, roll), total))
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)]!
  return [...ALL_ROLLS].sort((a, b) => payoutForRoll(bets, a) - payoutForRoll(bets, b))[fallback === 'max' ? ALL_ROLLS.length - 1 : 0]!
}
export function winGame(bets: SicBoBets): SicBoState { return settleSicBo(bets, pick(bets, (payout, total) => payout > total, 'max')) }
export function loseGame(bets: SicBoBets): SicBoState { return settleSicBo(bets, pick(bets, payout => payout === 0, 'min')) }
export function coldFaces(roll: SicBoRoll, count = 2): number[] { const cold = [1,2,3,4,5,6].filter(face => !roll.includes(face)); for (let i = cold.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cold[i], cold[j]] = [cold[j]!, cold[i]!] } return cold.slice(0, count) }
