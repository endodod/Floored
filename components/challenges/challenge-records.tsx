'use client'

import { PRESET_CHALLENGES } from '@/lib/challenges/presets'
import { CHALLENGE_START_BANKROLL, challengeKey, type ChallengeSource } from '@/lib/challenges/types'
import type { ChallengeStats } from '@/store/challenge-store'
import { formatChips } from '@/utils/format'

/**
 * Challenge records on the profile: one collapsed row per mode with its totals;
 * opening it lists each challenge's tries and best bankroll.
 */
export function ChallengeRecords({
  title,
  source,
  stats,
}: {
  title: string
  source: ChallengeSource
  stats: Record<string, ChallengeStats>
}) {
  const rows: { key: string; name: string; tries: number; best: number | null }[] =
    source === 'preset'
      ? PRESET_CHALLENGES.map((c) => {
          const s = stats[challengeKey('preset', c.id)]
          return { key: c.id, name: c.name, tries: s?.tries ?? 0, best: s?.best ?? null }
        })
      : Object.values(stats)
          .filter((s) => s.source === 'community')
          .sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed))
          .map((s) => ({ key: s.id, name: s.name, tries: s.tries, best: s.best }))

  const tried = rows.filter((r) => r.tries > 0)
  const tries = rows.reduce((sum, r) => sum + r.tries, 0)
  const best = rows.reduce((m, r) => Math.max(m, r.best ?? 0), 0)

  return (
    <details className="group" aria-label={`${title} records`}>
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 border-b border-rule pb-1.5 [&::-webkit-details-marker]:hidden">
        <h3 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wider text-soft">
          <span aria-hidden className="inline-block text-[10px] transition-transform group-open:rotate-90">▶</span>
          {title}
        </h3>
        <span className="num text-xs text-dim">
          {source === 'preset' ? `${tried.length}/${rows.length} tried` : `${tried.length} played`} · {tries} tries · best{' '}
          <span className={best > CHALLENGE_START_BANKROLL ? 'text-felt' : 'text-ink'}>{best > 0 ? formatChips(best) : '—'}</span>
        </span>
      </summary>
      {rows.length === 0 ? (
        <p className="py-2.5 text-[13px] text-dim">No community challenges played yet.</p>
      ) : (
        <table className="mt-1 w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-dim">
              <th className="py-1.5 font-normal">Challenge</th>
              <th className="py-1.5 text-right font-normal">Tries</th>
              <th className="py-1.5 text-right font-normal">Best</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-rule">
                <td className={`max-w-0 truncate py-2 pr-3 ${r.tries > 0 ? 'text-ink' : 'text-dim'}`}>{r.name}</td>
                <td className="num w-16 py-2 text-right text-soft">{r.tries}</td>
                <td className={`num w-20 py-2 text-right ${r.best != null && r.best > CHALLENGE_START_BANKROLL ? 'text-felt' : 'text-ink'}`}>
                  {r.best != null ? formatChips(r.best) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  )
}
