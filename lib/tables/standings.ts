import type { Standings } from './types'

export interface BustRecord {
  seat: number
  /** When the seat went out; later is better (hand or round number). */
  order: number
  /** Breaks ties between seats out at the same moment; higher is better (e.g. the stack they started that hand with). */
  tiebreak: number
}

/**
 * Finishing groups, best first: the seats still in (one group, or ranked by
 * `aliveScore` when the table is over), then the busted seats, latest first.
 * Seats out at the same moment with the same tiebreak share a place.
 */
export function rankSeats(alive: number[], busts: BustRecord[], aliveScore?: (seat: number) => number): Standings {
  const groups: Standings = []
  if (alive.length) {
    if (aliveScore) groups.push(...groupBy(alive, aliveScore))
    else groups.push([...alive])
  }
  const sorted = [...busts].sort((a, b) => b.order - a.order || b.tiebreak - a.tiebreak)
  let i = 0
  while (i < sorted.length) {
    const head = sorted[i]!
    const group = [head.seat]
    i++
    while (i < sorted.length && sorted[i]!.order === head.order && sorted[i]!.tiebreak === head.tiebreak) {
      group.push(sorted[i]!.seat)
      i++
    }
    groups.push(group)
  }
  return groups
}

function groupBy(seats: number[], score: (seat: number) => number): Standings {
  const sorted = [...seats].sort((a, b) => score(b) - score(a))
  const groups: Standings = []
  for (const seat of sorted) {
    const last = groups[groups.length - 1]
    if (last && score(last[0]!) === score(seat)) last.push(seat)
    else groups.push([seat])
  }
  return groups
}

/** 1-based place of a seat in finished groups (a tie shares the best place it covers). */
export function placeIn(groups: Standings, seat: number): number | null {
  let place = 1
  for (const g of groups) {
    if (g.includes(seat)) return place
    place += g.length
  }
  return null
}
