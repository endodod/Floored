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
  formatMaxMult,
  isCheckpoint,
} from '@/lib/ladder/rules'
import { ladderStats } from '@/lib/ladder/share'
import { formatMultiplier } from '@/lib/daily/share'
import { GAMES } from '@/lib/game-catalog'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import { LadderResults } from '@/components/ladder/ladder-results'
import { describeLadderResult } from '@/components/ladder/result-text'
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
import type { GameName } from '@/store/types'

const FELT = {
  backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
  backgroundSize: '6px 6px',
}

const TONE = {
  good: 'border-emerald-800/60 bg-emerald-950/30 text-emerald-100/80',
  bad: 'border-red-900/60 bg-red-950/30 text-red-100/80',
  neutral: 'border-zinc-700 bg-zinc-900/60 text-zinc-300',
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-3 py-2.5">
      <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-black tabular-nums ${tone ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/40 tabular-nums">{sub}</p>}
    </div>
  )
}

function Rules() {
  return (
    <div className="rounded-2xl border border-violet-900/40 bg-violet-950/20 px-4 py-3 text-sm text-violet-100/80 leading-relaxed space-y-1.5">
      <p>
        Start with <b className="text-white">{formatChips(START_POT)}</b> and climb {LADDER_RUNGS} rungs. Each rung, pick a
        game and go <b className="text-white">all-in</b> — any round that ends in profit clears it and your pot becomes
        the payout. A push replays the rung.
      </p>
      <p>
        Every game can be used <b className="text-white">once per run</b>. Every {CHECKPOINT_EVERY} rungs is a checkpoint:
        lose a round and you fall back to it, its pot is restored, and the games you used since then are free again.
      </p>
      <p>
        You have <b className="text-white">{LADDER_LIVES} lives</b>. Cash out any time between rounds, lose your last life
        to bank your last checkpoint, or reach the top for a <b className="text-white">×{TOP_BONUS}</b> bonus.
      </p>
    </div>
  )
}

const TUTORIAL: TutorialStep[] = [
  {
    icon: '🪜',
    title: 'Climb the rungs',
    body: (
      <>
        Start with {formatChips(START_POT)} and climb {LADDER_RUNGS} rungs. Each rung, pick a game and go all-in with
        your whole pot.
      </>
    ),
  },
  {
    icon: '📈',
    title: 'Any profit clears a rung',
    body: 'Finish the round with more than you staked and you climb — the payout becomes your new pot. A push replays the rung.',
  },
  {
    icon: '🎲',
    title: 'Each game once',
    body: 'Every game can only clear one rung per run, so save the safe ones for when the pot gets big.',
  },
  {
    icon: '🏁',
    title: 'Checkpoints',
    body: (
      <>
        Every {CHECKPOINT_EVERY} rungs saves your pot. Lose a round and you fall back to the last checkpoint — the games
        used since then are free again.
      </>
    ),
  },
  {
    icon: '❤️',
    title: `${LADDER_LIVES} lives`,
    body: 'Each fall costs a life. Lose the last one and you bank your last checkpoint.',
  },
  {
    icon: '💰',
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
    <ol className="flex flex-col gap-1" aria-label="Ladder">
      {rows.map((n) => {
        const done = cleared[n - 1]
        const entry = done ? GAMES.find((g) => g.name === done.game) : undefined
        const current = n === rung + 1
        const checkpoint = isCheckpoint(n)
        return (
          <li
            key={n}
            className={[
              'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs tabular-nums',
              current
                ? 'border-violet-500 bg-violet-950/50 text-white'
                : done
                  ? 'border-emerald-900/50 bg-emerald-950/20 text-white/80'
                  : 'border-zinc-800 bg-zinc-900/40 text-white/40',
            ].join(' ')}
          >
            <span className="w-5 text-right font-bold">{n}</span>
            <span className="flex-1 truncate">
              {entry ? (
                <>
                  <span aria-hidden className="mr-1">{entry.symbol}</span>
                  {entry.label}
                  <span className="ml-1 text-emerald-400">{formatMultiplier(done!.multiplier)}</span>
                </>
              ) : current ? (
                'You are here'
              ) : null}
            </span>
            {checkpoint && (
              <span title="Checkpoint" className={n <= checkpointRung ? '' : 'opacity-40'} aria-label="Checkpoint">
                🏁
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
  const tutorial = useTutorial('ladder')

  useEffect(() => {
    const ladder = useLadderStore.getState()
    // A round left mid-way on a previous visit counts as a fall.
    ladder.abandonOpenRound()
    // No start screen — landing here without a run starts one straight away. Checked on entry
    // only, so abandoning (which goes back to idle) routes home instead of restarting.
    if (ladder.status === 'idle') ladder.startRun()
  }, [])

  const used = useMemo(() => usedGames(s.cleared), [s.cleared])
  const available = useMemo(() => GAMES.map((g) => g.name).filter((g) => !used.has(g)), [used])
  const stats = useMemo(() => ladderStats(s.history), [s.history])

  useEffect(() => {
    if (s.status === 'climbing') available.forEach((g) => router.prefetch(`/ladder/${g}`))
  }, [s.status, available, router])

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="rounded-2xl bg-zinc-900 h-24" />
        <div className="rounded-2xl bg-zinc-900 h-80" />
      </div>
    )
  }

  const result = s.lastResult ? describeLadderResult(s.lastResult, s) : null

  function handlePick(game: GameName) {
    if (pending) return
    setPending(game)
    useLadderStore.getState().pickGame(game)
    router.push(`/ladder/${game}`)
  }

  return (
    <div className="flex flex-col gap-4 max-w-5xl w-full mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
            {LADDER_RUNGS} rungs · checkpoint every {CHECKPOINT_EVERY}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none mt-1">Ladder</h1>
        </div>
        <div className="flex flex-col sm:items-end gap-1">
          <button
            type="button"
            onClick={() => tutorial.setOpen(true)}
            className="self-start sm:self-end text-xs font-semibold text-violet-300 hover:text-violet-200 transition-colors"
          >
            How to play
          </button>
          {stats.runs > 0 && (
            <p className="text-xs text-zinc-500 tabular-nums">
              Best {formatChips(stats.bestPot)} · highest rung {stats.bestRung} · topped {stats.tops}×
            </p>
          )}
        </div>
      </header>

      <ModeTutorial
        id="ladder"
        title="Ladder"
        intro="Climb as high as you can, one all-in round per rung."
        steps={TUTORIAL}
        open={tutorial.open}
        onOpenChange={tutorial.setOpen}
      />

      {s.status !== 'climbing' ? (
        s.status === 'over' && s.history[0] ? (
          <>
            {result && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${TONE[result.tone]}`}>
                <b className="text-white">{result.title}.</b> {result.body}
              </div>
            )}
            <LadderResults record={s.history[0]} onNewRun={s.startRun} />
          </>
        ) : null
      ) : (
        <>
          {s.rung === 0 && s.lives === LADDER_LIVES && !result && <Rules />}

          {result && (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${TONE[result.tone]}`}>
              <b className="text-white">{result.title}.</b> {result.body}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Pot" value={formatChips(s.pot)} />
            <Stat label="Rung" value={`${s.rung + 1}/${LADDER_RUNGS}`} sub="Any profit climbs" />
            <Stat
              label="Lives"
              value={'❤️'.repeat(s.lives) + '🖤'.repeat(LADDER_LIVES - s.lives)}
            />
            <Stat
              label="Checkpoint"
              value={formatChips(s.checkpointPot)}
              sub={s.checkpointRung === 0 ? 'Ground' : `Rung ${s.checkpointRung}`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={s.cashOut}
              className="px-5 py-2 border border-emerald-700 hover:border-emerald-500 text-emerald-300 hover:text-emerald-200 font-bold rounded-lg transition-colors text-sm"
            >
              Cash out {formatChips(s.pot)}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAbandon(true)}
              className="px-5 py-2 border border-red-900/50 hover:bg-red-950/40 text-red-400 font-semibold rounded-lg transition-colors text-sm"
            >
              Abandon
            </button>
          </div>

          <Dialog open={confirmAbandon} onOpenChange={setConfirmAbandon}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Abandon this run?</DialogTitle>
                <DialogDescription>
                  Your {formatChips(s.pot)} pot won&apos;t be banked and the run won&apos;t count toward your stats.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <button className="text-sm px-4 py-2 rounded border border-zinc-700 text-muted-foreground hover:bg-zinc-800 transition-colors">
                    Cancel
                  </button>
                </DialogClose>
                <button
                  onClick={() => {
                    setConfirmAbandon(false)
                    s.abandonRun()
                    router.push('/')
                  }}
                  className="text-sm px-4 py-2 rounded bg-red-900/60 border border-red-800 text-red-300 hover:bg-red-900 transition-colors"
                >
                  Abandon run
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
            <div className="order-2 lg:order-1">
              <LadderRungs rung={s.rung} cleared={s.cleared} checkpointRung={s.checkpointRung} />
            </div>

            <div className="order-1 lg:order-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GAMES.map((entry) => {
                const game = entry.name
                const usedOn = s.cleared.findIndex((c) => c.game === game)
                const playable = usedOn === -1
                const isLoading = pending === game
                return (
                  <button
                    key={game}
                    type="button"
                    disabled={!playable || !!pending}
                    onClick={() => handlePick(game)}
                    className={[
                      'relative overflow-hidden rounded-xl border text-left transition-all duration-200',
                      `bg-gradient-to-br ${entry.gradient}`,
                      entry.accent,
                      playable && !pending ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] group' : 'cursor-default',
                      !playable ? 'opacity-35 saturate-50' : pending && !isLoading ? 'opacity-40' : '',
                    ].join(' ')}
                  >
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
                    <div className="relative p-3 flex flex-col gap-2 min-h-24">
                      <div className="flex items-start gap-2">
                        <span className="text-xl leading-none select-none shrink-0">{entry.symbol}</span>
                        <p className="text-white font-black text-sm sm:text-base leading-tight tracking-tight line-clamp-2">
                          {entry.label}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold uppercase tracking-wider text-white/60">
                          max {formatMaxMult(game)}
                        </span>
                        <span className="text-white/60">
                          {isLoading
                            ? 'Loading…'
                            : usedOn !== -1
                              ? `Rung ${usedOn + 1}`
                              : 'Play'}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
