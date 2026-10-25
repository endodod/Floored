import type { DailyRecord } from '@/store/daily-store'
import { formatChips } from '@/utils/format'

export function dailyMultiplier(record: Pick<DailyRecord, 'startBankroll' | 'endBankroll'>): number {
  return record.startBankroll > 0 ? record.endBankroll / record.startBankroll : 0
}

export function formatMultiplier(m: number): string {
  return `${m >= 10 ? m.toFixed(1) : m.toFixed(2)}×`
}

function netSquare(net: number | null): string {
  if (net == null) return '⬛'
  if (net > 0) return '🟩'
  if (net < 0) return '🟥'
  return '🟨'
}

/** Spoiler-free result text — one square per game in challenge order. */
export function buildShareText(record: DailyRecord, url: string): string {
  const m = dailyMultiplier(record)
  const squares = record.gameNets.map((g) => netSquare(g.net)).join('')
  const line =
    record.endReason === 'failed'
      ? `${formatChips(record.startBankroll)} → 💀 Failed`
      : `${formatChips(record.startBankroll)} → ${formatChips(record.endBankroll)} (${formatMultiplier(m)})`
  return [
    `Floored Daily #${record.number}`,
    line,
    squares,
    url,
  ].join('\n')
}

/** Best multiplier across completed (not failed) dailies; 0 if none. */
export function bestMultiplier(history: Record<string, DailyRecord>): number {
  return Object.values(history)
    .filter((r) => r.endReason === 'complete')
    .reduce((m, r) => Math.max(m, dailyMultiplier(r)), 0)
}

/** Consecutive completed (not failed) dailies ending today or yesterday (UTC). */
export function currentStreak(history: Record<string, DailyRecord>, today: string): number {
  const cleared = (date: string) => history[date]?.endReason === 'complete'
  const day = new Date(`${today}T00:00:00Z`)
  if (!cleared(today)) day.setUTCDate(day.getUTCDate() - 1)
  let streak = 0
  while (cleared(day.toISOString().slice(0, 10))) {
    streak++
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return streak
}
