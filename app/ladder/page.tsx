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
    title: 'Each game once',
    body: 'Every game can only clear one rung per run, so save the safe ones for when the pot gets big.',
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
    body: 'Each fall costs a life. Lose the last one and you bank your last checkpoint.',
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

export default function LadderPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const s = useLadderStore()
  const [pending, setPending] = useState<GameName | null>(null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  // The intro screen lays the rules out, so the dialog only opens from "How to play".
  const tutorial = useTutorial('ladder', { auto: false })

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
  const finished = s.status === 'over' ? s.history[0] : undefined

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
              <>
                <Button variant="ghost" size="sm" onClick={() => tutorial.setOpen(true)}>
                  How to play
                </Button>
                <Button variant="destructive" onClick={() => setConfirmAbandon(true)}>
                  Abandon
                </Button>
                <Button onClick={s.cashOut}>
                  Cash out <span className="num">{formatChips(s.pot)}</span>
                </Button>
              </>
            )}
          </>
        }
      />

      <ModeTutorial
        id="ladder"
        title="Ladder"
        intro="Climb as high as you can, one all-in round per rung."
        steps={TUTORIAL}
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

      {climbing ? (
        <ModeColumns
          rail={
            <Rail
              title="The ladder"
              note={`${s.lives} of ${LADDER_LIVES} lives`}
              footer={`Lose a round and you fall to the last checkpoint with its pot restored.`}
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
              { label: 'Lives', value: s.lives, unit: `of ${LADDER_LIVES}`, tone: s.lives === 1 ? 'loss' : undefined },
              {
                label: 'Checkpoint',
                value: formatChips(s.checkpointPot),
                sub: s.checkpointRung === 0 ? 'Ground floor' : `Rung ${s.checkpointRung}`,
              },
            ]}
          />

          <section className="flex flex-col gap-4" aria-labelledby="ladder-games">
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
                      symbol={entry.symbol}
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
              <LadderResults record={finished} onNewRun={s.startRun} />
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
                  Start climbing
                </Button>
              }
            />
          )}
          <HowItWorks steps={TUTORIAL} />
        </ModeColumns>
      )}
    </div>
  )
}
