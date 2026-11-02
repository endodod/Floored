'use client'

import type { CSSProperties, ReactNode } from 'react'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { CHALLENGE_START_BANKROLL, totalChallengeBets, type ChallengeDef } from '@/lib/challenges/types'
import type { ChallengeStats } from '@/store/challenge-store'
import { formatChips } from '@/utils/format'
import { cn } from '@/lib/utils'

/**
 * One challenge in a list (house or community): theme tag, name, the games and
 * their bets, and the player's own tries and best beside the way in.
 */
export function ChallengeCard({
  def,
  stats,
  index = 0,
  extra,
  action,
  live,
}: {
  def: ChallengeDef
  stats?: ChallengeStats
  index?: number
  /** Extra figures under the games (community: tries by everyone, top score). */
  extra?: ReactNode
  action: ReactNode
  /** This challenge is the attempt in progress. */
  live?: boolean
}) {
  const bets = totalChallengeBets(def)
  return (
    <li
      className={cn(
        'rise flex h-full flex-col gap-3 rounded-md bg-surface p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-5',
        live && 'shadow-[inset_0_0_0_1px_rgba(79,174,132,0.35),0_0_50px_-30px_rgba(79,174,132,0.6)]',
      )}
      style={{ '--d': `${Math.min(index, 12) * 45 + 120}ms` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gold">{def.theme}</p>
          <h3 className="mt-0.5 truncate text-[17px] font-semibold leading-snug text-ink">{def.name}</h3>
          {def.author && <p className="truncate text-xs text-dim">by {def.author}</p>}
        </div>
        {live && <span className="shrink-0 rounded-full border border-felt px-2 py-0.5 text-[11px] text-felt">In progress</span>}
      </div>

      {def.description && <p className="text-[13px] leading-5 text-soft">{def.description}</p>}

      <ul className="flex flex-wrap gap-1.5" aria-label="Games">
        {def.games.map(({ game, bets: n }) => (
          <li key={game} className="rounded border border-line px-2 py-0.5 text-xs text-soft">
            {GAME_BY_NAME.get(game)?.label ?? game}
            <span className="num ml-1.5 text-dim">×{n}</span>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Figure label="Games" value={def.games.length} />
        <Figure label="Bets" value={bets} />
        <Figure label="Min bet" value={formatChips(def.minBet)} />
        <Figure label="Start" value={formatChips(CHALLENGE_START_BANKROLL)} />
      </dl>

      {extra}

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-rule pt-3">
        <dl className="flex gap-5 text-xs">
          <div>
            <dt className="text-dim">Your tries</dt>
            <dd className="num mt-0.5 text-[14px] text-ink">{stats?.tries ?? 0}</dd>
          </div>
          <div>
            <dt className="text-dim">Your best</dt>
            <dd className={cn('num mt-0.5 text-[14px]', stats?.best != null ? (stats.best > 1000 ? 'text-felt' : 'text-ink') : 'text-dim')}>
              {stats?.best != null ? formatChips(stats.best) : '—'}
            </dd>
          </div>
        </dl>
        <div className="shrink-0">{action}</div>
      </div>
    </li>
  )
}

function Figure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <dt className="text-dim">{label}</dt>
      <dd className="num text-soft sm:mt-0.5">{value}</dd>
    </div>
  )
}
