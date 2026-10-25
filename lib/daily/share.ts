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
  const tag = record.endReason === 'bust' ? ' 💀' : ''
  return [
    `Floored Daily #${record.number}`,
    `${formatChips(record.startBankroll)} → ${formatChips(record.endBankroll)} (${formatMultiplier(m)})${tag}`,
    squares,
    url,
  ].join('\n')
}

/** Consecutive days played ending today or yesterday (UTC). */
export function currentStreak(history: Record<string, DailyRecord>, today: string): number {
  const day = new Date(`${today}T00:00:00Z`)
  if (!history[today]) day.setUTCDate(day.getUTCDate() - 1)
  let streak = 0
  while (history[day.toISOString().slice(0, 10)]) {
    streak++
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return streak
}
