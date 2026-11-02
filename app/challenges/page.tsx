'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PRESET_CHALLENGES } from '@/lib/challenges/presets'
import { CHALLENGE_START_BANKROLL, challengeKey } from '@/lib/challenges/types'
import { useChallengeStore } from '@/store/challenge-store'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import { FigureStrip, PageTitle, SectionTitle } from '@/components/ui/terminal'
import { Button } from '@/components/ui/button'
import { ChallengeCard } from '@/components/challenges/challenge-card'
import { useStartChallenge } from '@/components/challenges/use-start-challenge'
import { cn } from '@/lib/utils'

const ALL = 'All'

export default function ChallengesPage() {
  const hydrated = useHydrated()
  const stats = useChallengeStore((s) => s.stats)
  const attempt = useChallengeStore((s) => s.attempt)
  const { request, dialog, liveKey } = useStartChallenge()
  const [theme, setTheme] = useState<string>(ALL)

  const themes = useMemo(() => [ALL, ...new Set(PRESET_CHALLENGES.map((c) => c.theme))], [])
  const shown = theme === ALL ? PRESET_CHALLENGES : PRESET_CHALLENGES.filter((c) => c.theme === theme)

  const presetStats = hydrated ? PRESET_CHALLENGES.map((c) => stats[challengeKey('preset', c.id)]) : []
  const tried = presetStats.filter((s) => s && s.tries > 0).length
  const tries = presetStats.reduce((sum, s) => sum + (s?.tries ?? 0), 0)
  const best = presetStats.reduce((m, s) => Math.max(m, s?.best ?? 0), 0)

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      {dialog}
      <PageTitle
        title="Challenges"
        sub={`Themed runs from the house. Every one starts at ${formatChips(CHALLENGE_START_BANKROLL)}: place every bet and finish as high as you can. Retry as often as you like.`}
        aside={
          <Button asChild variant="outline" size="sm">
            <Link href="/community">Community challenges</Link>
          </Button>
        }
      />

      <FigureStrip
        items={[
          { label: 'Challenges', value: PRESET_CHALLENGES.length },
          { label: 'Tried', value: hydrated ? tried : '—', unit: `/ ${PRESET_CHALLENGES.length}` },
          { label: 'Total tries', value: hydrated ? tries : '—' },
          { label: 'Best bankroll', value: hydrated && best > 0 ? formatChips(best) : '—', tone: best > CHALLENGE_START_BANKROLL ? 'win' : undefined },
        ]}
      />

      {hydrated && attempt && !attempt.finished && (
        <div className="rise flex flex-col gap-3 rounded-md bg-surface p-4 shadow-[inset_0_0_0_1px_rgba(79,174,132,0.22)] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-soft">
            In progress: <span className="font-semibold text-ink">{attempt.def.name}</span> ·{' '}
            <span className="num text-ink">{formatChips(attempt.bankroll)}</span>
          </p>
          <Button asChild size="sm">
            <Link href="/challenge">Continue</Link>
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="house-challenges">
        <SectionTitle suit={1} note={`${shown.length} challenge${shown.length === 1 ? '' : 's'}`}>
          <span id="house-challenges">House challenges</span>
        </SectionTitle>
        <div className="flex flex-wrap gap-x-4 gap-y-2" role="radiogroup" aria-label="Theme">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              data-active={theme === t}
              onClick={() => setTheme(t)}
              className={cn('mark-line text-[13px]', theme === t ? 'text-ink' : 'text-dim hover:text-ink')}
            >
              {t}
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((def, i) => {
            const key = challengeKey('preset', def.id)
            const live = hydrated && liveKey === key
            return (
              <ChallengeCard
                key={def.id}
                index={i}
                def={def}
                stats={hydrated ? stats[key] : undefined}
                live={live}
                action={
                  <Button size="sm" onClick={() => request('preset', def)} disabled={!hydrated}>
                    {live ? 'Continue' : hydrated && stats[key]?.tries ? 'Try again' : 'Play'}
                  </Button>
                }
              />
            )
          })}
        </ul>
      </section>
    </div>
  )
}
