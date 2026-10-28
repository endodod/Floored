import type { LadderEndReason, LadderEvent, LadderRecord } from '@/store/ladder-store'
import { LADDER_RUNGS } from '@/lib/ladder/rules'
import { formatChips } from '@/utils/format'

const EVENT_SQUARE: Record<LadderEvent, string> = {
  clear: '🟩',
  checkpoint: '🏁',
  fall: '🟥',
}

export const END_LABEL: Record<LadderEndReason, string> = {
  cashed: 'Cashed out',
  out: 'Out of lives',
  topped: 'Topped the ladder',
}

/** Spoiler-free result text — one square per settled rung, in play order. */
export function buildLadderShareText(record: LadderRecord, url: string): string {
  const squares = record.log.map((e) => EVENT_SQUARE[e]).join('') + (record.endReason === 'topped' ? '👑' : '')
  return [
    'Floored Ladder',
    `Rung ${record.peakRung}/${LADDER_RUNGS} · ${formatChips(record.finalPot)} (${END_LABEL[record.endReason].toLowerCase()})`,
    squares,
    url,
  ].join('\n')
}

export function ladderStats(history: LadderRecord[]) {
  return {
    runs: history.length,
    bestPot: history.reduce((m, r) => Math.max(m, r.finalPot), 0),
    bestRung: history.reduce((m, r) => Math.max(m, r.peakRung), 0),
    tops: history.filter((r) => r.endReason === 'topped').length,
  }
}
