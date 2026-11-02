'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStore } from 'zustand'
import { dailyLadderRecord, useDailyLadderStore, useLadderStore, usedGames } from '@/store/ladder-store'
import { DAILY_LADDER_HUB, LADDER_HUB } from '@/lib/ladder/active'
import { dailyDateKey, dailyNumber } from '@/lib/daily/challenge'
import { DailyCountdown } from '@/components/daily/countdown'
import { ModeRowList } from '@/components/mode-row'
import { DailyLadderRow } from '@/components/daily/daily-rows'
import {
  CHECKPOINT_EVERY,
  LADDER_LIVES,
  LADDER_RUNGS,
  START_POT,
  TOP_BONUS,
  isCheckpoint,
  livesActive,
} from '@/lib/ladder/rules'
import { ladderStats } from '@/lib/ladder/share'
import { formatMultiplier } from '@/lib/daily/share'
import { GAMES, GAME_BY_NAME } from '@/lib/game-catalog'
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
import { HowItWorks, ModeColumns, Rail, StartPanel } from '@/components/mode-intro'
import { ModeTutorial, useTutorial, type TutorialStep } from '@/components/mode-tutorial'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

const TUTORIAL: TutorialStep[] = [
  {
    title: 'Climb the rungs',
    body: (
      <>
        Start with {formatChips(START_POT)} and climb {LADDER_RUNGS} rungs. Each rung, pick a game and go all-in with
        your whole pot.
      </>
    ),
  },
  {
    title: 'Any profit clears a rung',
    body: 'Finish the round with more than you staked and you climb — the payout becomes your new pot. A push replays the rung.',
  },
  {
    title: 'Six on offer, each game once',
    body: 'Each rung offers six random games, and a game can only clear one rung per run — games you have not been offered yet are likelier to turn up.',
  },
  {
    title: 'Checkpoints',
    body: (
      <>
        Every {CHECKPOINT_EVERY} rungs saves your pot. Lose a round and you fall back to the last checkpoint — the games
        used since then are free again.
      </>
    ),
  },
  {
    title: `${LADDER_LIVES} lives`,
    body: `Lives start counting once you reach the first checkpoint (rung ${CHECKPOINT_EVERY}) — fall before it and the run restarts from the ground. After that each fall costs a life; lose the last one and you bank your last checkpoint.`,
  },
  {
    title: 'Cash out, top out or abandon',
    body: (
      <>
        Cash out between rounds to bank your pot, reach the top for a ×{TOP_BONUS} bonus, or abandon to give up the
        run without banking anything.
      </>
    ),
  },
]

/** The daily ladder has one climb: a fall before the first checkpoint ends it instead of restarting. */
const DAILY_TUTORIAL: TutorialStep[] = TUTORIAL.map((step) =>
  step.title === `${LADDER_LIVES} lives`
    ? {
        ...step,
        body: `Lives start counting once you reach the first checkpoint (rung ${CHECKPOINT_EVERY}) — fall before it and today's climb is over with nothing banked. After that each fall costs a life; lose the last one and you bank your last checkpoint.`,
      }
    : step,
)

function LadderRungs({ rung, cleared, checkpointRung }: { rung: number; cleared: { game: GameName; multiplier: number }[]; checkpointRung: number }) {
  const rows = Array.from({ length: LADDER_RUNGS }, (_, i) => LADDER_RUNGS - i)
  return (
    <ol aria-label="Ladder, top rung first">
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

/**
 * The ladder's hub: start screen, rung picker and result. `daily` plays the
 * daily ladder (one seeded run per UTC day) instead of the endless one.
 */
export function LadderHub({ daily = false }: { daily?: boolean }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const store = daily ? useDailyLadderStore : useLadderStore
  const s = useStore(store)
  const hub = daily ? DAILY_LADDER_HUB : LADDER_HUB
  const [pending, setPending] = useState<GameName | null>(null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  // The intro screen lays the rules out, so the dialog only opens from "How to play".
  const tutorial = useTutorial('ladder', { auto: false })

  useEffect(() => {
    // A run left over from an earlier day is closed before anything else.
    store.getState().syncToday()
    // A round left mid-way on a previous visit counts as a fall.
    store.getState().abandonOpenRound()
    if (!daily) return
    // Roll over to the new day if the page is left open past 00:00 UTC.
    const id = setInterval(() => store.getState().syncToday(), 1000)
    return () => clearInterval(id)
  }, [store, daily])

  const used = useMemo(() => usedGames(s.cleared), [s.cleared])
  const available = useMemo(() => GAMES.map((g) => g.name).filter((g) => !used.has(g)), [used])
  // The picker only ever shows this rung's offers — six games, drawn by the store.
  const offered = useMemo(() => {
    const names = s.offers.find((o) => o.rung === s.rung)?.games ?? []
    return names.flatMap((name) => {
      const entry = GAME_BY_NAME.get(name)
      return entry ? [entry] : []
    })
  }, [s.offers, s.rung])
  const stats = useMemo(() => ladderStats(s.history), [s.history])

  useEffect(() => {
    if (s.status !== 'climbing') return
    // A climb saved before the offer pool existed gets its picker drawn on arrival.
    store.getState().ensureOffers()
  }, [store, s.status, s.rung])

  useEffect(() => {
    if (s.status === 'climbing') offered.forEach((g) => router.prefetch(`${hub}/${g.name}`))
  }, [s.status, offered, router, hub])

  if (!hydrated || (daily && s.date !== dailyDateKey())) return <ScreenSkeleton />

  const result = s.lastResult ? describeLadderResult(s.lastResult, s) : null

  function handlePick(game: GameName) {
    if (pending) return
    setPending(game)
    store.getState().pickGame(game)
    router.push(`${hub}/${game}`)
  }

  const climbing = s.status === 'climbing'
  const today = daily ? dailyDateKey() : null
  const finished = daily
    ? today
      ? dailyLadderRecord(s.history, today)
      : undefined
    : s.status === 'over'
      ? s.history[0]
      : undefined

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      <PageTitle
        title={daily && today ? `Daily ladder #${dailyNumber(today)}` : 'Ladder'}
        sub={
          daily
            ? `The same pickers for everyone, one climb a day: ${LADDER_RUNGS} rungs all-in, a checkpoint every ${CHECKPOINT_EVERY}.`
            : `Climb ${LADDER_RUNGS} rungs all-in, one game per rung, with a checkpoint every ${CHECKPOINT_EVERY}. Play as many runs as you like.`
        }
        aside={
          <>
            {daily && (
              <p className="text-[13px] text-dim">
                New ladder in <DailyCountdown className="num text-ink" />
              </p>
            )}
            {stats.runs > 0 && (
              <p className="text-[13px] text-dim">
                Best <span className="num text-ink">{formatChips(stats.bestPot)}</span> · highest rung{' '}
                <span className="num text-ink">{stats.bestRung}</span> · topped{' '}
                <span className="num text-ink">{stats.tops}</span>×
              </p>
            )}
            {climbing && (
              <>
                <Button variant="ghost" size="sm" onClick={() => tutorial.setOpen(true)}>
                  How to play
                </Button>
                {!daily && (
                  <Button variant="destructive" onClick={() => setConfirmAbandon(true)}>
                    Abandon
                  </Button>
                )}
                <Button onClick={s.cashOut}>
                  Cash out <span className="num">{formatChips(s.pot)}</span>
                </Button>
              </>
            )}
          </>
        }
      />

      <ModeTutorial
        id={daily ? 'daily-ladder' : 'ladder'}
        title={daily ? 'Daily ladder' : 'Ladder'}
        intro="Climb as high as you can, one all-in round per rung."
        steps={daily ? DAILY_TUTORIAL : TUTORIAL}
        open={tutorial.open}
        onOpenChange={tutorial.setOpen}
      />

      <Dialog open={confirmAbandon} onOpenChange={setConfirmAbandon}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Abandon this run?</DialogTitle>
            <DialogDescription>
              Your <span className="num text-ink">{formatChips(s.pot)}</span> pot won&apos;t be banked and the run
              won&apos;t count toward your stats.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmAbandon(false)
                s.abandonRun()
                router.push('/')
              }}
            >
              Abandon run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!daily && (
        <section className="flex flex-col gap-4" aria-labelledby="daily-ladder">
          <SectionTitle suit={0} note="New every day at 00:00 UTC">
            <span id="daily-ladder">Today</span>
          </SectionTitle>
          <ModeRowList>
            <DailyLadderRow index={0} />
          </ModeRowList>
        </section>
      )}

      {/* Under the daily: says the climb below is the open-ended one. */}
      {!daily && (
        <div className="-mb-4">
          <SectionTitle suit={1} note="Unlimited runs">
            Endless ladder
          </SectionTitle>
        </div>
      )}

      {climbing ? (
        <ModeColumns
          rail={
            <Rail
              title="The ladder"
              note={livesActive(s.checkpointRung) ? `${s.lives} of ${LADDER_LIVES} lives` : `Lives from rung ${CHECKPOINT_EVERY}`}
              footer={
                livesActive(s.checkpointRung)
                  ? 'Lose a round and you fall to the last checkpoint with its pot restored.'
                  : daily
                    ? "Lose a round before the first checkpoint and today's climb is over."
                    : 'Lose a round before the first checkpoint and the run starts over.'
              }
            >
              <LadderRungs rung={s.rung} cleared={s.cleared} checkpointRung={s.checkpointRung} />
            </Rail>
          }
        >
          {result && <ResultNote tone={result.tone} title={`${result.title}.`} body={result.body} />}

          <FigureStrip
            items={[
              { label: 'Pot', value: formatChips(s.pot) },
              { label: 'Rung', value: s.rung + 1, unit: `/ ${LADDER_RUNGS}`, sub: 'Any profit climbs' },
              livesActive(s.checkpointRung)
                ? { label: 'Lives', value: s.lives, unit: `of ${LADDER_LIVES}`, tone: s.lives === 1 ? 'loss' : undefined }
                : {
                    label: 'Lives',
                    value: '—',
                    sub: daily ? `A loss ends the climb until rung ${CHECKPOINT_EVERY}` : `From rung ${CHECKPOINT_EVERY}`,
                  },
              {
                label: 'Checkpoint',
                value: formatChips(s.checkpointPot),
                sub: s.checkpointRung === 0 ? 'Ground floor' : `Rung ${s.checkpointRung}`,
              },
            ]}
          />

          <section className="flex flex-col gap-4" aria-labelledby="ladder-games">
            <SectionTitle suit={3} note={`${offered.length} on offer · ${available.length} games left`}>
              <span id="ladder-games">Pick the game for rung {s.rung + 1}</span>
            </SectionTitle>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {offered.map((entry, i) => {
                const game = entry.name
                const isLoading = pending === game
                return (
                  <li key={game}>
                    <GameTile
                      index={i}
                      label={entry.label}
                      symbol={entry.symbol}
                      sub={entry.sub}
                      meta={<PayoutCaption game={game} />}
                      disabled={!!pending}
                      faded={!!pending && !isLoading}
                      loading={isLoading}
                      onClick={() => handlePick(game)}
                    />
                  </li>
                )
              })}
            </ul>
          </section>
        </ModeColumns>
      ) : (
        <ModeColumns
          rail={
            <Rail title="The ladder" note={`${LADDER_RUNGS} rungs`} footer="Flags mark the checkpoints.">
              <LadderRungs rung={0} cleared={[]} checkpointRung={0} />
            </Rail>
          }
        >
          {finished && (
            <div className="flex flex-col gap-4">
              {result && <ResultNote tone={result.tone} title={`${result.title}.`} body={result.body} />}
              <LadderResults
                record={finished}
                onNewRun={daily ? undefined : s.startRun}
                shareUrl={hub}
                after={
                  daily ? (
                    <Button asChild variant="outline">
                      <Link href={LADDER_HUB}>Endless ladder</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )}
          {!finished && (
            <StartPanel
              figures={[
                { label: 'Starting pot', value: formatChips(START_POT) },
                { label: 'Rungs', value: LADDER_RUNGS },
                { label: 'Lives', value: LADDER_LIVES },
                { label: 'Top bonus', value: `×${TOP_BONUS}` },
              ]}
              action={
                <Button onClick={s.startRun} size="lg">
                  {daily ? 'Climb today' : 'Start climbing'}
                </Button>
              }
              note={
                daily
                  ? `One climb a day: once you start, it ends when you cash out, top the ladder, run out of lives or lose a round before rung ${CHECKPOINT_EVERY}. Every player is offered the same games.`
                  : undefined
              }
            />
          )}
          <HowItWorks steps={daily ? DAILY_TUTORIAL : TUTORIAL} />
        </ModeColumns>
      )}
    </div>
  )
}
