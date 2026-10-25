'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDailyStore, betsLeft } from '@/store/daily-store'
import { dailyDateKey, generateDailyChallenge, totalDailyBets } from '@/lib/daily/challenge'
import { currentStreak, dailyMultiplier, formatMultiplier } from '@/lib/daily/share'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import { DailyCountdown } from '@/components/daily/countdown'
import { DailyResults } from '@/components/daily/daily-results'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import type { GameName } from '@/store/types'

const FELT = {
  backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
  backgroundSize: '6px 6px',
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-3 py-2.5">
      <p className="text-[10px] text-white/40 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-black tabular-nums ${tone ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

function BetPips({ total, used }: { total: number; used: number }) {
  return (
    <div className="flex gap-1" aria-label={`${total - used} of ${total} bets left`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-4 rounded-full ${i < used ? 'bg-white/15' : 'bg-white/80'}`}
        />
      ))}
    </div>
  )
}

export default function DailyPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const syncToday = useDailyStore((s) => s.syncToday)
  const abandonOpenRound = useDailyStore((s) => s.abandonOpenRound)
  const date = useDailyStore((s) => s.date)
  const bankroll = useDailyStore((s) => s.bankroll)
  const progress = useDailyStore((s) => s.progress)
  const finished = useDailyStore((s) => s.finished)
  const history = useDailyStore((s) => s.history)
  const cashOut = useDailyStore((s) => s.cashOut)
  const [pending, setPending] = useState<GameName | null>(null)
  const [cashOutOpen, setCashOutOpen] = useState(false)

  useEffect(() => {
    syncToday()
    abandonOpenRound()
  }, [syncToday, abandonOpenRound])

  const challenge = useMemo(() => generateDailyChallenge(date ?? dailyDateKey()), [date])
  const record = date ? history[date] : undefined

  useEffect(() => {
    challenge.games.forEach(({ game }) => router.prefetch(`/daily/${game}`))
  }, [challenge, router])

  if (!hydrated || !date || date !== dailyDateKey()) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        <div className="rounded-2xl bg-zinc-900 h-24" />
        <div className="rounded-2xl bg-zinc-900 h-80" />
      </div>
    )
  }

  const totalBets = totalDailyBets(challenge)
  const usedBets = challenge.games.reduce((sum, g) => sum + (progress[g.game]?.betsUsed ?? 0), 0)
  const started = usedBets > 0
  const net = bankroll - challenge.bankroll
  const records = Object.values(history)
  const best = records.reduce((m, r) => Math.max(m, dailyMultiplier(r)), 0)

  function handlePick(game: GameName) {
    if (pending) return
    setPending(game)
    router.push(`/daily/${game}`)
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl w-full mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-400/80">
            {new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-none mt-1">
            Daily #{challenge.number}
          </h1>
        </div>
        <p className="text-xs text-zinc-500">
          New daily in <DailyCountdown className="font-semibold text-zinc-300" />
        </p>
      </header>

      {record ? (
        <DailyResults record={record} />
      ) : (
        <>
          {!started && (
            <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/80 leading-relaxed">
              You get <b className="text-white">{formatChips(challenge.bankroll)}</b> for all six games. Each game allows a
              fixed number of bets — split your bankroll however you like to finish with as much as possible.
              One attempt per day, same challenge for everyone.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Bankroll" value={formatChips(bankroll)} />
            <Stat
              label="Net"
              value={`${net > 0 ? '+' : ''}${formatChips(net)}`}
              tone={net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-white'}
            />
            <Stat label="Bets left" value={`${totalBets - usedBets}/${totalBets}`} />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {challenge.games.map(({ game, bets }) => {
          const entry = GAME_BY_NAME.get(game)
          if (!entry) return null
          const p = progress[game]
          const left = betsLeft(progress, game, bets)
          const playable = !finished && left > 0 && bankroll >= 1
          const gameNet = p && p.betsUsed > 0 ? p.returned - p.wagered : null
          const isLoading = pending === game

          return (
            <button
              key={game}
              type="button"
              disabled={!playable || !!pending}
              onClick={() => handlePick(game)}
              className={[
                'relative overflow-hidden rounded-2xl border text-left transition-all duration-200',
                `bg-gradient-to-br ${entry.gradient}`,
                entry.accent,
                playable && !pending
                  ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] group'
                  : 'cursor-default',
                !playable ? 'opacity-50 saturate-50' : isLoading ? 'opacity-90' : pending ? 'opacity-40' : '',
              ].join(' ')}
            >
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={FELT} />
              <div className="relative p-4 sm:p-5 flex flex-col gap-3 min-h-36">
                <div className="flex items-start gap-2">
                  <span className="text-2xl leading-none select-none shrink-0">{entry.symbol}</span>
                  <p className="text-white font-black text-lg sm:text-xl leading-tight tracking-tight line-clamp-2">
                    {entry.label}
                  </p>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                      {bets} bet{bets === 1 ? '' : 's'}
                    </span>
                    {gameNet != null && (
                      <span className={`text-xs font-bold tabular-nums ${gameNet > 0 ? 'text-emerald-300' : gameNet < 0 ? 'text-red-300' : 'text-white/60'}`}>
                        {gameNet > 0 ? '+' : ''}{formatChips(gameNet)}
                      </span>
                    )}
                  </div>
                  <BetPips total={bets} used={bets - left} />
                  <span className="text-white/50 text-xs font-medium group-hover:text-white/80 transition-colors">
                    {isLoading ? 'Loading…' : left === 0 ? 'Done' : finished ? 'Closed' : `${left} left · Play`}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {!record && started && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setCashOutOpen(true)}
            className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white font-bold rounded-lg transition-colors text-sm"
          >
            Cash out &amp; end today
          </button>
        </div>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Played" value={String(records.length)} />
          <Stat label="Streak" value={String(currentStreak(history, dailyDateKey()))} />
          <Stat label="Best" value={formatMultiplier(best)} />
        </div>
      )}

      <Dialog open={cashOutOpen} onOpenChange={setCashOutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>End today&apos;s daily?</DialogTitle>
            <DialogDescription>
              You&apos;ll finish with {formatChips(bankroll)}. Unused bets are forfeited and you can&apos;t play again until tomorrow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <button className="text-sm px-4 py-2 rounded border border-zinc-700 text-muted-foreground hover:bg-zinc-800 transition-colors">
                Keep playing
              </button>
            </DialogClose>
            <button
              onClick={() => {
                setCashOutOpen(false)
                cashOut()
              }}
              className="text-sm px-4 py-2 rounded bg-amber-900/60 border border-amber-800 text-amber-200 hover:bg-amber-900 transition-colors"
            >
              Cash out
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
