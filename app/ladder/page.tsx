'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLadderStore, usedGames } from '@/store/ladder-store'
import {
  CHECKPOINT_EVERY,
  LADDER_LIVES,
  LADDER_RUNGS,
  START_POT,
  TOP_BONUS,
  isCheckpoint,
} from '@/lib/ladder/rules'
import { ladderStats } from '@/lib/ladder/share'
import { formatMultiplier } from '@/lib/daily/share'
import { GAMES } from '@/lib/game-catalog'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import { LadderResults } from '@/components/ladder/ladder-results'
import { describeLadderResult } from '@/components/ladder/result-text'
import type { GameName } from '@/store/types'
import { Button } from '@/components/ui/button'
import { FigureStrip, PageTitle, SectionTitle } from '@/components/ui/terminal'
import { GameTile } from '@/components/game-tile'
import { PayoutCaption } from '@/components/game-payout'
import { ScreenSkeleton } from '@/components/screen-skeleton'

const TONE = {
  good: 'text-felt glow-felt',
  bad: 'text-loss glow-loss',
  neutral: 'text-ink',
}

function ResultNote({ tone, title, body }: { tone: keyof typeof TONE; title: string; body: string }) {
  return (
    <div
      className={`rise relative overflow-hidden rounded-md bg-surface px-5 py-4 ${tone === 'good' ? 'shadow-[inset_2px_0_0_var(--felt)]' : tone === 'bad' ? 'shadow-[inset_2px_0_0_var(--loss)]' : ''}`}
      role="status"
    >
      <p className={`text-[15px] font-semibold ${TONE[tone]}`}>{title}</p>
      <p className="mt-0.5 text-[13px] leading-5 text-soft">{body}</p>
    </div>
  )
}

function Rules() {
  return (
    <div className="rise flex max-w-[64ch] flex-col gap-3 text-[13px] leading-5 text-soft [--d:60ms]">
      <p>
        Start with <span className="num text-ink">{formatChips(START_POT)}</span> and climb {LADDER_RUNGS} rungs. Each
        rung, pick a game and go all-in — any round that ends in profit clears it, and your pot becomes the payout. A
        push replays the rung.
      </p>
      <p>
        Every game can be used once per run. Every {CHECKPOINT_EVERY} rungs is a checkpoint: lose a round and you fall
        back to it, its pot is restored, and the games you used since then are free again.
      </p>
      <p>
        You have {LADDER_LIVES} lives. Cash out any time between rounds, lose your last life to bank your last
        checkpoint, or reach the top for a <span className="num text-ink">×{TOP_BONUS}</span> bonus.
      </p>
    </div>
  )
}

function LadderRungs({ rung, cleared, checkpointRung }: { rung: number; cleared: { game: GameName; multiplier: number }[]; checkpointRung: number }) {
  const rows = Array.from({ length: LADDER_RUNGS }, (_, i) => LADDER_RUNGS - i)
  return (
    <ol className="rise rounded-md bg-surface px-4 py-2 [--d:160ms]" aria-label="Ladder, top rung first">
      {rows.map((n) => {
        const done = cleared[n - 1]
        const entry = done ? GAMES.find((g) => g.name === done.game) : undefined
        const current = n === rung + 1
        const checkpoint = isCheckpoint(n)
        return (
          <li
            key={n}
            aria-current={current ? 'step' : undefined}
            className={`relative flex h-8 items-center gap-3 text-[13px] transition-colors ${checkpoint ? 'border-b border-line' : ''} ${current ? '-mx-4 bg-felt-tint px-4 shadow-[inset_2px_0_0_var(--felt)]' : ''}`}
          >
            <span className={`num w-5 text-right text-xs ${current ? 'text-felt glow-felt' : done ? 'text-soft' : 'text-dim'}`}>{n}</span>
            <span className="min-w-0 flex-1 truncate">
              {entry ? (
                <span className="text-soft">{entry.label}</span>
              ) : current ? (
                <span className="mark-line text-ink" data-active="true">
                  You are here
                </span>
              ) : null}
            </span>
            {done && <span className="num text-xs text-felt">{formatMultiplier(done.multiplier)}</span>}
            {checkpoint && !done && (
              <span className={`text-[11px] ${n <= checkpointRung ? 'text-felt' : 'text-dim'}`}>
                <span aria-hidden className="mr-1">⚑&#xFE0E;</span>checkpoint
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function LadderPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const s = useLadderStore()
  const [pending, setPending] = useState<GameName | null>(null)

  useEffect(() => {
    // A round left mid-way on a previous visit counts as a fall.
    useLadderStore.getState().abandonOpenRound()
  }, [])

  const used = useMemo(() => usedGames(s.cleared), [s.cleared])
  const available = useMemo(() => GAMES.map((g) => g.name).filter((g) => !used.has(g)), [used])
  const stats = useMemo(() => ladderStats(s.history), [s.history])

  useEffect(() => {
    if (s.status === 'climbing') available.forEach((g) => router.prefetch(`/ladder/${g}`))
  }, [s.status, available, router])

  if (!hydrated) return <ScreenSkeleton />

  const result = s.lastResult ? describeLadderResult(s.lastResult, s) : null

  function handlePick(game: GameName) {
    if (pending) return
    setPending(game)
    useLadderStore.getState().pickGame(game)
    router.push(`/ladder/${game}`)
  }

  const climbing = s.status === 'climbing'

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      <PageTitle
        title="Ladder"
        sub={`Climb ${LADDER_RUNGS} rungs all-in, one game per rung, with a checkpoint every ${CHECKPOINT_EVERY}.`}
        aside={
          <>
            {stats.runs > 0 && (
              <p className="text-[13px] text-dim">
                Best <span className="num text-ink">{formatChips(stats.bestPot)}</span> · highest rung{' '}
                <span className="num text-ink">{stats.bestRung}</span> · topped{' '}
                <span className="num text-ink">{stats.tops}</span>×
              </p>
            )}
            {climbing && (
              <Button onClick={s.cashOut}>
                Cash out <span className="num">{formatChips(s.pot)}</span>
              </Button>
            )}
          </>
        }
      />

      {!climbing ? (
        s.status === 'over' && s.history[0] ? (
          <div className="flex flex-col gap-4">
            {result && <ResultNote tone={result.tone} title={`${result.title}.`} body={result.body} />}
            <LadderResults record={s.history[0]} onNewRun={s.startRun} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-6">
                <Rules />
                <Button onClick={s.startRun} size="lg" className="self-start">
                  Start climbing
                </Button>
              </div>
              <section className="rise flex flex-col gap-3 [--d:220ms]" aria-labelledby="ladder-payouts">
                <SectionTitle suit={1} note="Safe games climb, big payouts grow the pot">
                  <span id="ladder-payouts">What each game can pay</span>
                </SectionTitle>
                <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  {GAMES.map((g) => (
                    <li key={g.name} className="flex items-baseline justify-between gap-4 border-t border-rule py-2.5">
                      <span className="text-[13px] text-ink">{g.label}</span>
                      <PayoutCaption game={g.name} />
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <LadderRungs rung={0} cleared={[]} checkpointRung={0} />
          </div>
        )
      ) : (
        <>
          {result && <ResultNote tone={result.tone} title={`${result.title}.`} body={result.body} />}
          {s.rung === 0 && s.lives === LADDER_LIVES && !result && <Rules />}

          <FigureStrip
            items={[
              { label: 'Pot', value: formatChips(s.pot) },
              { label: 'Rung', value: s.rung + 1, unit: `/ ${LADDER_RUNGS}`, sub: 'Any profit climbs' },
              { label: 'Lives', value: s.lives, unit: `of ${LADDER_LIVES}`, tone: s.lives === 1 ? 'loss' : undefined },
              {
                label: 'Checkpoint',
                value: formatChips(s.checkpointPot),
                sub: s.checkpointRung === 0 ? 'Ground floor' : `Rung ${s.checkpointRung}`,
              },
            ]}
          />

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="order-2 lg:order-1">
              <LadderRungs rung={s.rung} cleared={s.cleared} checkpointRung={s.checkpointRung} />
            </div>

            <section className="order-1 flex flex-col gap-4 lg:order-2" aria-labelledby="ladder-games">
              <SectionTitle suit={3} note={`${available.length} of ${GAMES.length} games left this run`}>
                <span id="ladder-games">Pick the game for rung {s.rung + 1}</span>
              </SectionTitle>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {GAMES.map((entry, i) => {
                  const game = entry.name
                  const usedOn = s.cleared.findIndex((c) => c.game === game)
                  const playable = usedOn === -1
                  const isLoading = pending === game
                  return (
                    <li key={game}>
                      <GameTile
                        index={i}
                        label={entry.label}
                        sub={entry.sub}
                        meta={<PayoutCaption game={game} />}
                        action={usedOn !== -1 ? `Used on rung ${usedOn + 1}` : 'Play'}
                        disabled={!playable || !!pending}
                        faded={!playable || (!!pending && !isLoading)}
                        loading={isLoading}
                        onClick={() => handlePick(game)}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
