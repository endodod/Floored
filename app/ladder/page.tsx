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
        {stats.runs > 0 && (
          <p className="text-xs text-zinc-500 tabular-nums">
            Best {formatChips(stats.bestPot)} · highest rung {stats.bestRung} · topped {stats.tops}×
          </p>
        )}
      </header>

      {s.status !== 'climbing' ? (
        <>
          {s.status === 'over' && s.history[0] ? (
            <>
              {result && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${TONE[result.tone]}`}>
                  <b className="text-white">{result.title}.</b> {result.body}
                </div>
              )}
              <LadderResults record={s.history[0]} onNewRun={s.startRun} />
            </>
          ) : (
            <>
              <Rules />
              <button
                type="button"
                onClick={s.startRun}
                className="self-start px-7 py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-xl transition-colors shadow-lg"
              >
                Start climbing
              </button>
            </>
          )}
        </>
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
          </div>

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
