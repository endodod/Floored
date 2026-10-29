'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GAME_BOARD_ARENA, GAME_CARD_SHELL, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GAME_DOCK_LEAVE_BTN, GAME_DOCK_PRIMARY_BTN, GAME_DOCK_SECONDARY_BTN } from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TableGameEntry } from '@/lib/tables/catalog'
import { ordinal, payoutsFor, TIER_BY_ID } from '@/lib/tables/stakes'
import { placeIn } from '@/lib/tables/standings'
import type { Standings } from '@/lib/tables/types'
import { useTablesStore, type OpenTable } from '@/store/tables-store'
import { formatChips } from '@/utils/format'
import { signed } from '@/components/ui/terminal'
import { cn } from '@/lib/utils'

const CORNER_BTN =
  'h-8 rounded-full border border-control bg-ground px-3.5 text-[13px] font-medium text-soft transition-colors hover:border-dim hover:text-ink'

/**
 * The frame every table shares: status bar, the felt (with the hand history
 * drawer), the dock, the way out, and the result once your place is decided.
 * Settles the table with the store exactly once.
 */
export function TableShell({
  game,
  table,
  names,
  standings,
  place,
  over,
  watching,
  onWatch,
  onPlayAgain,
  message,
  history,
  board,
  dock,
}: {
  game: TableGameEntry
  table: OpenTable
  /** Seat names, "You" first. */
  names: string[]
  standings: Standings
  place: number | null
  over: boolean
  watching: boolean
  onWatch: () => void
  onPlayAgain: () => void
  message: ReactNode
  history: MatchHistoryEntry[]
  board: ReactNode
  dock: ReactNode
}) {
  const router = useRouter()
  const finish = useTablesStore((s) => s.finish)
  const forfeit = useTablesStore((s) => s.forfeit)
  const wallet = useTablesStore((s) => s.wallet)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [resultReady, setResultReady] = useState(false)
  const settled = useRef(false)
  const tier = TIER_BY_ID.get(table.tier)!
  const botSkill = table.botSkill ?? table.tier
  const prizes = payoutsFor(standings, table.buyIn, table.seats, table.game)
  const prize = place != null ? (prizes[0] ?? 0) : 0

  useEffect(() => {
    if (place == null || settled.current) return
    settled.current = true
    finish(place, prize)
  }, [place, prize, finish])

  function leave() {
    if (place == null) setConfirmLeave(true)
    else router.push('/tables')
  }

  useEffect(() => {
    setResultReady(false)
    if (place == null) return
    const timer = setTimeout(() => setResultReady(true), place === 1 ? 0 : 1800)
    return () => clearTimeout(timer)
  }, [place])

  const showResult = place != null && resultReady && (!watching || over)
  const canAgain = wallet >= table.buyIn

  return (
    <div className={GAME_CARD_SHELL}>
      <div className={GAME_STATUS_BAR}>
        <span className="text-[13px] font-semibold text-ink">
          {game.label}
          <span className="ml-2 hidden font-normal text-dim sm:inline">{tier.label} · {botSkill === 'shark' ? 'Expert bots' : botSkill === 'regular' ? 'Regular bots' : 'For fun'}</span>
        </span>
        <span className="text-[13px] text-dim">{message}</span>
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col"
        entries={history}
        gameLabel={game.label}
        emptyHint="No hands played yet."
      >
        <div className="absolute left-3 top-3 z-20 flex gap-2">
          <button type="button" onClick={leave} className={CORNER_BTN}>
            ← Tables
          </button>
          <Link
            href={`/how-to-play/tables/${game.name}`}
            target="_blank"
            aria-label={`How to play ${game.label} (opens in a new tab)`}
            className={`${CORNER_BTN} inline-flex w-8 items-center justify-center px-0`}
          >
            <span aria-hidden>?</span>
          </Link>
        </div>

        {board}

        {place != null && watching && !over && (
          <p className="tb-watch rise pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-control bg-ground px-3 py-1 text-[12px] text-soft">
            You finished {ordinal(place)} · watching
          </p>
        )}

        {showResult && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(10,12,11,0.62)] p-4 backdrop-blur-[2px]">
            <section
              className={cn(
                'tb-result rise w-full max-w-sm rounded-md bg-surface p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)]',
                prize > 0 ? 'shadow-[inset_0_0_0_1px_rgba(217,164,65,0.35)]' : 'shadow-[inset_0_0_0_1px_var(--line)]',
              )}
              aria-live="polite"
            >
              <p className={cn('text-[17px] font-semibold', place === 1 ? 'text-gold glow-gold' : prize > 0 ? 'text-felt' : 'text-ink')}>
                {place === 1 ? 'You won the table' : prize > 0 ? `You finished ${ordinal(place!)}` : "You're bankrupt"}
              </p>
              <p className="mt-1 text-[13px] text-soft">
                {prize > 0 ? (
                  <>
                    Prize <span className="num text-gold">{formatChips(prize)}</span> ·{' '}
                    <span className="num">{signed(prize - table.buyIn, formatChips)}</span> on your buy-in
                  </>
                ) : (
                  <>
                    No prize · <span className="num">{signed(-table.buyIn, formatChips)}</span>
                  </>
                )}
              </p>

              {over ? (
                <ol className="mt-4 flex flex-col">
                  {names
                    .map((name, seat) => ({ name, seat, place: placeIn(standings, seat) ?? table.seats }))
                    .sort((a, b) => a.place - b.place)
                    .map((row) => (
                      <li key={row.seat} className="flex items-baseline justify-between gap-3 border-t border-rule py-1.5 text-[13px]">
                        <span className={row.seat === 0 ? 'text-ink' : 'text-soft'}>
                          <span className="num mr-2 text-dim">{ordinal(row.place)}</span>
                          {row.name}
                        </span>
                        <span className={cn('num', prizes[row.seat] ? 'text-gold' : 'text-dim')}>
                          {prizes[row.seat] ? formatChips(prizes[row.seat]!) : '—'}
                        </span>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="mt-3 text-[13px] leading-5 text-dim">The table plays on without you. Your result is banked.</p>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {!over && (
                  <button type="button" onClick={onWatch} className={GAME_DOCK_LEAVE_BTN}>
                    Watch the rest
                  </button>
                )}
                <button type="button" onClick={() => router.push('/tables')} className={GAME_DOCK_SECONDARY_BTN}>
                  Tables
                </button>
                <button
                  type="button"
                  onClick={onPlayAgain}
                  disabled={!canAgain}
                  className={GAME_DOCK_PRIMARY_BTN + ' min-w-0'}
                  title={canAgain ? undefined : 'Not enough in your wallet'}
                >
                  Again · <span className="num">{formatChips(table.buyIn)}</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </GameFieldWithHistory>

      <div className={GAME_CONTROL_DOCK_M}>{dock}</div>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave the table?</DialogTitle>
            <DialogDescription>
              You forfeit your <span className="num text-ink">{formatChips(table.buyIn)}</span> buy-in and finish last.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Stay</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmLeave(false)
                forfeit()
                router.push('/tables')
              }}
            >
              Leave and forfeit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Seconds left on a deadline, ticking; null when there is none. */
export function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline == null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline])
  return deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}
