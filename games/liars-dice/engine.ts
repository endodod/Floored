import type { Action, Bid, State, View } from './types'

export function startGame(rng: () => number, names = 4): State {
  return { dice: Array.from({ length: names }, () => Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6))), active: Array(names).fill(true), bid: null, history: [], seat: 0, reveal: false, winner: null, finishOrder:[] }
}

export function viewFor(state: State, seat: number): View {
  return { active: [...state.active], bid: state.bid && { ...state.bid }, history: [...state.history], seat: state.seat, reveal: state.reveal, winner: state.winner, finishOrder:[...state.finishOrder], ownDice: [...state.dice[seat]!], diceCounts: state.dice.map((d, i) => state.reveal || i === seat ? d.length : d.length) }
}

export function legalActions(state: State, seat: number): Action[] {
  if (state.reveal || state.winner !== null || seat !== state.seat || !state.active[seat]) return []
  const result: Action[] = state.bid ? [{ type: 'liar' }] : []
  for (let face = 1; face <= 6; face++) {
    for (let count = 1; count <= 30; count++) {
      const candidate = { count, face: face as Bid['face'], seat }
      if (!state.bid || raises(candidate, state.bid)) result.push({ type: 'bid', count, face: candidate.face })
    }
  }
  return result
}

function raises(next: Bid, prev: Bid): boolean {
  if (next.face === 1) return prev.face === 1 ? next.count > prev.count : next.count >= Math.ceil(prev.count / 2)
  if (prev.face === 1) return next.count >= prev.count * 2 + 1
  return next.count > prev.count || next.count === prev.count && next.face > prev.face
}

function roll(rng: () => number, count: number) { return Array.from({ length: count }, () => 1 + Math.floor(rng() * 6)) }

export function apply(state: State, seat: number, action: Action): State {
  if (!legalActions(state, seat).some(a => a.type === action.type && (a.type !== 'bid' || action.type === 'bid' && a.count === action.count && a.face === action.face))) throw new Error('Illegal action')
  if (action.type === 'bid') {
    const bid = { ...action, seat }
    const next = nextActive(state.active, seat)
    return { ...state, bid, history: [...state.history, bid], seat: next }
  }
  if (!state.bid) throw new Error('Cannot call Liar before a bid')
  const total = state.dice.flatMap((d, i) => state.active[i] ? d : []).filter(d => d === state.bid!.face || state.bid!.face !== 1 && d === 1).length
  const loser = total < state.bid.count ? state.bid.seat : seat
  const active = [...state.active]
  const dice = state.dice.map(d => [...d])
  dice[loser]!.pop()
  if (dice[loser]!.length === 0) active[loser] = false
  const remaining = active.map((a, i) => a ? i : -1).filter(i => i >= 0)
  const winner = remaining.length === 1 ? remaining[0]! : null
  const roundStarter = active[loser] ? loser : nextActive(active, loser)
  const finishOrder=[...state.finishOrder,...(!active[loser]?[loser]:[]),...(winner!==null?[winner]:[])]
  return { dice, active, bid: state.bid, history: state.history, seat: roundStarter, reveal: true, winner, finishOrder }
}

export function nextRound(state: State, rng: () => number): State {
  if (!state.reveal || state.winner !== null) throw new Error('Round is not ready to continue')
  return { ...state, dice: state.dice.map((d, i) => state.active[i] ? roll(rng, d.length) : []), reveal: false, bid: null, history: [] }
}

function nextActive(active: boolean[], from: number): number {
  for (let step = 1; step <= active.length; step++) { const i = (from + step) % active.length; if (active[i]) return i }
  return from
}
