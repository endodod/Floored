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
    record.date ? `Floored Daily ladder ${record.date}` : 'Floored Ladder',
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

/** Consecutive days with a Daily ladder climb, ending today or yesterday (UTC), like the Daily challenge streak. */
export function dailyLadderStreak(history: LadderRecord[], today: string): number {
  const climbed = new Set(history.map((r) => r.date).filter(Boolean))
  const day = new Date(`${today}T00:00:00Z`)
  if (!climbed.has(today)) day.setUTCDate(day.getUTCDate() - 1)
  let streak = 0
  while (climbed.has(day.toISOString().slice(0, 10))) {
    streak++
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return streak
}
