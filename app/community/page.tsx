'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth/client'
import { GAMES } from '@/lib/game-catalog'
import {
  CHALLENGE_DESCRIPTION_MAX,
  CHALLENGE_MAX_BETS,
  CHALLENGE_MAX_GAMES,
  CHALLENGE_MIN_BET_OPTIONS,
  CHALLENGE_MIN_BETS,
  CHALLENGE_MIN_GAMES,
  CHALLENGE_NAME_MAX,
  CHALLENGE_START_BANKROLL,
  CHALLENGE_THEME_MAX,
  challengeKey,
  validateChallengeInput,
  type ChallengeSlot,
} from '@/lib/challenges/types'
import type { CommunityChallengeDto, CommunitySort } from '@/lib/challenges/community'
import { useChallengeStore } from '@/store/challenge-store'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'
import { PageTitle, SectionTitle } from '@/components/ui/terminal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChallengeCard } from '@/components/challenges/challenge-card'
import { useStartChallenge } from '@/components/challenges/use-start-challenge'
import { cn } from '@/lib/utils'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: CommunityChallengeDto[] }

export default function CommunityPage() {
  const hydrated = useHydrated()
  const session = authClient.useSession()
  const stats = useChallengeStore((s) => s.stats)
  const { request, dialog, liveKey } = useStartChallenge()
  const [sort, setSort] = useState<CommunitySort>('new')
  const [list, setList] = useState<LoadState>({ status: 'loading' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (s: CommunitySort) => {
    setList({ status: 'loading' })
    try {
      const res = await fetch(`/api/community?sort=${s}`)
      if (!res.ok) throw new Error()
      setList({ status: 'ready', items: (await res.json()) as CommunityChallengeDto[] })
    } catch {
      setList({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    void load(sort)
  }, [load, sort])

  const signedIn = !!session.data?.user

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      {dialog}
      <PageTitle
        title="Community challenges"
        sub={`Challenges made by players. Same rules as the house ones: start at ${formatChips(CHALLENGE_START_BANKROLL)}, place every bet, finish as high as you can.`}
        aside={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/challenges">House challenges</Link>
            </Button>
            {signedIn ? (
              <Button onClick={() => setCreating((c) => !c)} variant={creating ? 'outline' : 'default'}>
                {creating ? 'Close' : 'Create a challenge'}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/auth/sign-in">Sign in to create</Link>
              </Button>
            )}
          </>
        }
      />

      {creating && signedIn && (
        <CreateChallenge
          onCreated={() => {
            setCreating(false)
            setSort('new')
            void load('new')
          }}
        />
      )}

      <section className="flex flex-col gap-4" aria-labelledby="community-list">
        <SectionTitle
          suit={3}
          note={
            <span className="flex gap-4" role="radiogroup" aria-label="Sort">
              {(['new', 'popular'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={sort === s}
                  data-active={sort === s}
                  onClick={() => setSort(s)}
                  className={cn('mark-line text-[13px]', sort === s ? 'text-ink' : 'text-dim hover:text-ink')}
                >
                  {s === 'new' ? 'Newest' : 'Most played'}
                </button>
              ))}
            </span>
          }
        >
          <span id="community-list">Browse</span>
        </SectionTitle>

        {list.status === 'loading' && <p className="text-[13px] text-dim">Loading challenges…</p>}
        {list.status === 'error' && (
          <div className="flex items-center gap-3">
            <p className="text-[13px] text-dim">Community challenges couldn&apos;t be loaded.</p>
            <Button variant="outline" size="sm" onClick={() => void load(sort)}>
              Retry
            </Button>
          </div>
        )}
        {list.status === 'ready' && list.items.length === 0 && (
          <p className="text-[13px] text-dim">No community challenges yet. {signedIn ? 'Make the first one.' : 'Sign in and make the first one.'}</p>
        )}
        {list.status === 'ready' && list.items.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {list.items.map((c, i) => {
              const key = challengeKey('community', c.id)
              const live = hydrated && liveKey === key
              const def = { id: c.id, name: c.name, theme: c.theme, description: c.description, minBet: c.minBet, games: c.games, author: c.author }
              return (
                <ChallengeCard
                  key={c.id}
                  index={i}
                  def={def}
                  stats={hydrated ? stats[key] : undefined}
                  live={live}
                  extra={
                    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                      <div className="flex gap-1.5">
                        <dt className="text-dim">Played</dt>
                        <dd className="num text-soft">{c.tries}×</dd>
                      </div>
                      <div className="flex min-w-0 gap-1.5">
                        <dt className="text-dim">Top</dt>
                        <dd className="truncate text-soft">
                          {c.top ? (
                            <>
                              <span className="num text-felt">{formatChips(c.top.best)}</span> · {c.top.name}
                            </>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>
                  }
                  action={
                    <Button size="sm" onClick={() => request('community', def)} disabled={!hydrated}>
                      {live ? 'Continue' : hydrated && stats[key]?.tries ? 'Try again' : 'Play'}
                    </Button>
                  }
                />
              )
            })}
          </ul>
        )}
        <p className="text-xs leading-5 text-dim">
          Your tries and best are kept per challenge in this browser (and in your account when signed in). The top
          score shown is the best completed attempt by a signed-in player.
        </p>
      </section>
    </div>
  )
}

const SELECT =
  'h-[34px] rounded-md border border-control bg-ground px-2 text-[13px] text-ink outline-none focus:border-felt'

function CreateChallenge({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [theme, setTheme] = useState('')
  const [description, setDescription] = useState('')
  const [minBet, setMinBet] = useState<number>(10)
  const [games, setGames] = useState<ChallengeSlot[]>([
    { game: 'blackjack', bets: 3 },
    { game: 'roulette', bets: 3 },
  ])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const used = new Set(games.map((g) => g.game))

  function update(i: number, patch: Partial<ChallengeSlot>) {
    setGames((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  }

  function addGame() {
    const next = GAMES.find((g) => !used.has(g.name))
    if (next && games.length < CHALLENGE_MAX_GAMES) setGames((gs) => [...gs, { game: next.name, bets: 2 }])
  }

  async function submit() {
    const body = { name, theme, description, minBet, games }
    const check = validateChallengeInput(body)
    if (!check.ok) {
      setError(check.error)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(check.value),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not publish the challenge.')
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish the challenge.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rise flex flex-col gap-5 rounded-md bg-surface p-5 sm:p-6" aria-labelledby="create-challenge">
      <SectionTitle suit={1} note={`Starts at ${formatChips(CHALLENGE_START_BANKROLL)} for everyone`}>
        <span id="create-challenge">New challenge</span>
      </SectionTitle>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-dim">Name</span>
          <Input value={name} maxLength={CHALLENGE_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Midnight Run" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-dim">Theme</span>
          <Input value={theme} maxLength={CHALLENGE_THEME_MAX} onChange={(e) => setTheme(e.target.value)} placeholder="Cards, Risky, Dice…" />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-dim">Description (optional)</span>
          <Input
            value={description}
            maxLength={CHALLENGE_DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What makes this one tough?"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-dim">Min bet</span>
          <select className={SELECT} value={minBet} onChange={(e) => setMinBet(Number(e.target.value))}>
            {CHALLENGE_MIN_BET_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {formatChips(v)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-dim">
          Games ({CHALLENGE_MIN_GAMES}–{CHALLENGE_MAX_GAMES}) and bets per game ({CHALLENGE_MIN_BETS}–{CHALLENGE_MAX_BETS})
        </p>
        <ul className="flex flex-col gap-2">
          {games.map((g, i) => (
            <li key={i} className="flex items-center gap-2">
              <select
                className={cn(SELECT, 'min-w-0 flex-1')}
                aria-label={`Game ${i + 1}`}
                value={g.game}
                onChange={(e) => update(i, { game: e.target.value as GameName })}
              >
                {GAMES.filter((x) => x.name === g.game || !used.has(x.name)).map((x) => (
                  <option key={x.name} value={x.name}>
                    {x.label}
                  </option>
                ))}
              </select>
              <select
                className={cn(SELECT, 'w-24')}
                aria-label={`Bets on game ${i + 1}`}
                value={g.bets}
                onChange={(e) => update(i, { bets: Number(e.target.value) })}
              >
                {Array.from({ length: CHALLENGE_MAX_BETS - CHALLENGE_MIN_BETS + 1 }, (_, k) => k + CHALLENGE_MIN_BETS).map((n) => (
                  <option key={n} value={n}>
                    {n} bet{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove game ${i + 1}`}
                disabled={games.length <= CHALLENGE_MIN_GAMES}
                onClick={() => setGames((gs) => gs.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button variant="outline" size="sm" onClick={addGame} disabled={games.length >= CHALLENGE_MAX_GAMES}>
            Add game
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={saving}>
          {saving ? 'Publishing…' : 'Publish'}
        </Button>
        {error && <p className="text-[13px] text-loss">{error}</p>}
      </div>
    </section>
  )
}
