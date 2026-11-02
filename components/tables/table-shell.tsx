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
import { cashEventText } from '@/lib/tables/cash'
import { cashStakeFor, limitsLabel, ordinal, payoutsFor, TIER_BY_ID } from '@/lib/tables/stakes'
import { placeIn } from '@/lib/tables/standings'
import type { Standings } from '@/lib/tables/types'
import { useTablesStore, type OpenTable } from '@/store/tables-store'
import { formatChips } from '@/utils/format'
import { signed } from '@/components/ui/terminal'
import { cn } from '@/lib/utils'
import type { CashControls } from './use-table-runner'

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
  cash = null,
  leaveInPlay,
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
  /** Cash tables: the session's controls and figures. */
  cash?: CashControls | null
  /** Cash: the confirm line for leaving during a hand ("You fold this hand and leave with"), followed by the stack. */
  leaveInPlay?: string
}) {
  const router = useRouter()
  const finish = useTablesStore((s) => s.finish)
  const forfeit = useTablesStore((s) => s.forfeit)
  const cashOut = useTablesStore((s) => s.cashOut)
  const wallet = useTablesStore((s) => s.wallet)
  const syncCashStack = useTablesStore((s) => s.syncCashStack)
  const storeTopUp = useTablesStore((s) => s.topUp)
  const lastCashResult = useTablesStore((s) => s.lastCashResult)
  const openTable = useTablesStore((s) => s.open)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmCashLeave, setConfirmCashLeave] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState(0)
  const [eventEntries, setEventEntries] = useState<MatchHistoryEntry[]>([])
  const cashedOut = useRef(false)
  const [resultReady, setResultReady] = useState(false)
  const settled = useRef(false)
  const tier = TIER_BY_ID.get(table.tier)!
  const isCash = table.format === 'cash'
  // Brought in so far (the first sit plus top ups): live from the store, then from the session record.
  const brought =
    openTable?.id === table.id ? (openTable.broughtIn ?? 0) : lastCashResult?.id === table.id ? lastCashResult.broughtIn : (table.broughtIn ?? 0)
  const stake = isCash ? cashStakeFor(table.game, table.stake ?? 'low') : null
  const prizes = payoutsFor(standings, table.buyIn, table.seats, table.game)
  const prize = place != null ? (prizes[0] ?? 0) : 0

  useEffect(() => {
    if (isCash || place == null || settled.current) return
    settled.current = true
    finish(place, prize)
  }, [isCash, place, prize, finish])

  // Cash: the store always holds your chips behind, so a reload or a closed tab leaves with exactly that.
  const cashStack = cash?.stack ?? 0
  const cashHands = cash?.hands ?? 0
  const cashLeft = cash?.left ?? null
  useEffect(() => {
    if (!cash || cashLeft) return
    syncCashStack(cashStack, cashHands)
  }, [cash, cashLeft, cashStack, cashHands, syncCashStack])

  // You stood up: the stack goes back to the wallet and the session is recorded.
  useEffect(() => {
    if (!cashLeft || cashedOut.current) return
    cashedOut.current = true
    syncCashStack(cashLeft.stack, cashLeft.hands)
    cashOut()
  }, [cashLeft, syncCashStack, cashOut])

  // Arrivals and departures join the hand history.
  const cashEvents = cash?.events
  useEffect(() => {
    if (!cashEvents?.length) return
    setEventEntries((entries) => {
      const seen = new Set(entries.map((e) => e.id))
      const fresh = cashEvents
        .filter((e) => !seen.has(`e${e.id}`))
        .map((e): MatchHistoryEntry => ({ id: `e${e.id}`, at: new Date(), title: cashEventText(e), subtitle: `Before hand ${e.hand + 1}`, tone: 'neutral' }))
      return fresh.length ? [...fresh, ...entries].slice(0, 30) : entries
    })
  }, [cashEvents])
  const allHistory = isCash ? [...history, ...eventEntries].sort((a, b) => b.at.getTime() - a.at.getTime()) : history

  function leave() {
    if (cash) {
      if (cashLeft) router.push('/tables')
      else if (cash.inPlay) setConfirmCashLeave(true)
      else cash.leave()
    } else if (isCash) {
      cashOut()
      router.push('/tables')
    } else if (place == null) setConfirmLeave(true)
    else router.push('/tables')
  }

  function openTopUp() {
    setTopUpAmount(Math.min(wallet, brought || wallet))
    setTopUpOpen(true)
  }

  function confirmTopUp() {
    const chips = Math.floor(topUpAmount)
    if (!cash || chips < 1 || chips > wallet) return
    if (!storeTopUp(chips)) return
    cash.topUp(chips)
    setTopUpOpen(false)
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
          {isCash ? game.cash.label : game.label}
          <span className="ml-2 hidden font-normal text-dim sm:inline">
            {stake ? `${stake.label} · ${limitsLabel(table.game, stake)}` : tier.label}
          </span>
        </span>
        {cash ? (
          <span className="flex min-w-0 items-baseline gap-3 text-[13px]">
            <span className="hidden truncate text-dim lg:inline">{message}</span>
            <span className="num whitespace-nowrap text-soft" aria-label="Your session">
              <span className="hidden text-dim sm:inline">Brought {formatChips(brought)} · </span>
              Stack <span className="text-ink">{formatChips(cash.stack)}</span>
              {' · '}
              <span className={cash.stack - brought > 0 ? 'text-felt' : cash.stack - brought < 0 ? 'text-loss' : 'text-dim'}>
                {signed(cash.stack - brought, formatChips)}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-[13px] text-dim">{message}</span>
        )}
      </div>

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col"
        entries={allHistory}
        gameLabel={game.label}
        emptyHint="No hands played yet."
      >
        <div className="absolute left-3 top-3 z-20 flex gap-2">
          <button type="button" onClick={leave} className={CORNER_BTN} disabled={!!cash?.leaving}>
            {isCash ? (cash?.leaving ? 'Leaving…' : 'Leave table') : '← Tables'}
          </button>
          {cash && !cashLeft && (
            <button type="button" onClick={openTopUp} className={CORNER_BTN} disabled={cash.leaving || wallet < 1}>
              Top up
            </button>
          )}
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

        {cash?.leaving && !cashLeft && (
          <p className="rise pointer-events-none absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 rounded-full border border-control bg-ground px-3 py-1 text-[12px] text-soft sm:block">
            Leaving after this hand
          </p>
        )}
        {cash && cash.pendingTopUp > 0 && !cashLeft && (
          <p className="rise pointer-events-none absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 rounded-full border border-control bg-ground px-3 py-1 text-[12px] text-soft sm:block">
            <span className="num text-ink">+{formatChips(cash.pendingTopUp)}</span> before the next {table.game === 'liars-dice' ? 'game' : 'hand'}
          </p>
        )}

        {cashLeft && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(10,12,11,0.62)] p-4 backdrop-blur-[2px]">
            <section className="tb-result rise w-full max-w-sm rounded-md bg-surface p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] shadow-[inset_0_0_0_1px_var(--line)]" aria-live="polite">
              {(() => {
                const net = cashLeft.stack - brought
                return (
                  <>
                    <p className={cn('text-[17px] font-semibold', net > 0 ? 'text-felt' : net < 0 ? 'text-loss' : 'text-ink')}>
                      You left the table <span className="num">{signed(net, formatChips)}</span>
                    </p>
                    <p className="mt-1 text-[13px] text-soft">
                      Brought <span className="num text-ink">{formatChips(brought)}</span> · leaving with{' '}
                      <span className="num text-ink">{formatChips(cashLeft.stack)}</span> after <span className="num">{cashLeft.hands}</span>{' '}
                      {table.game === 'liars-dice' ? (cashLeft.hands === 1 ? 'game' : 'games') : cashLeft.hands === 1 ? 'hand' : 'hands'}.
                    </p>
                  </>
                )
              })()}
              <div className="mt-5 flex justify-center">
                <button type="button" onClick={() => router.push('/tables')} className={GAME_DOCK_PRIMARY_BTN}>
                  Back to Tables
                </button>
              </div>
            </section>
          </div>
        )}

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

              <div className="mt-5 flex flex-nowrap justify-center gap-2">
                {!over && (
                  <button type="button" onClick={onWatch} className={GAME_DOCK_LEAVE_BTN}>
                    Watch
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

      <div className={GAME_CONTROL_DOCK_M}>
        {dock}
        {/* Out of chips: you sit out until you top up or leave. Covers the dock so nothing in it moves. */}
        {cash?.broke && !cashLeft && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ground p-4 text-center">
            <p className="text-[14px] text-ink">You&apos;re out of chips</p>
            <p className="text-[12px] text-dim">The table plays on without you. Top up from your wallet, or leave.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => cash.leave()} className={GAME_DOCK_SECONDARY_BTN}>
                Leave table
              </button>
              <button type="button" onClick={openTopUp} disabled={wallet < 1} className={GAME_DOCK_PRIMARY_BTN}>
                Top up
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={confirmCashLeave} onOpenChange={setConfirmCashLeave}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave the table?</DialogTitle>
            <DialogDescription>
              {leaveInPlay ?? 'You leave with'} <span className="num text-ink">{formatChips(cash?.stack ?? 0)}</span>
              {table.game === 'blackjack-showdown' ? ' plus whatever this hand pays.' : '.'}
              {table.game === 'holdem' ? ' Chips already in the pot stay there.' : table.game === 'liars-dice' ? ' Your ante stays in the pot.' : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end">
            <DialogClose asChild>
              <Button variant="outline">Stay</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setConfirmCashLeave(false)
                cash?.leave()
              }}
            >
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Top up</DialogTitle>
            <DialogDescription>Chips from your wallet join your stack before the next {table.game === 'liars-dice' ? 'game' : 'hand'}.</DialogDescription>
          </DialogHeader>
          <p className="num text-[13px] text-soft">
            Wallet <span className="text-ink">{formatChips(wallet)}</span>
          </p>
          <ChipAmount value={topUpAmount} max={wallet} onChange={setTopUpAmount} label="Chips to add" />
          <DialogFooter>
            <Button onClick={confirmTopUp} disabled={topUpAmount < 1 || topUpAmount > wallet}>
              Add <span className="num ml-1">{formatChips(Math.max(0, Math.floor(topUpAmount)))}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave the table?</DialogTitle>
            <DialogDescription>
              You forfeit your <span className="num text-ink">{formatChips(table.buyIn)}</span> buy-in and finish last.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end">
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

/**
 * An amount from the wallet: a number field with − / + steps and ¼ · ½ · All of
 * the wallet. Shared by the lobby's cash sit-down dialog and the top up.
 */
export function ChipAmount({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  const step = Math.max(1, 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, max))) - 1))
  const clampTo = (n: number) => Math.max(0, Math.min(max, Math.floor(n)))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" className={GAME_DOCK_SECONDARY_BTN + ' !min-w-0 h-10 w-10 !px-0'} aria-label="Less" disabled={value <= 1} onClick={() => onChange(clampTo(value - step))}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={(event) => onChange(clampTo(Number(event.target.value)))}
          className="num h-10 min-w-0 flex-1 rounded border border-line bg-ground px-3 text-center text-ink"
          aria-label={label}
        />
        <button type="button" className={GAME_DOCK_SECONDARY_BTN + ' !min-w-0 h-10 w-10 !px-0'} aria-label="More" disabled={value >= max} onClick={() => onChange(clampTo(value + step))}>
          +
        </button>
      </div>
      <div className="flex justify-center gap-2">
        {([['¼', 0.25], ['½', 0.5], ['All', 1]] as const).map(([text, fraction]) => (
          <button
            key={text}
            type="button"
            onClick={() => onChange(Math.max(max >= 1 ? 1 : 0, Math.floor(max * fraction)))}
            className="h-8 rounded-full border border-control px-3.5 text-[13px] text-soft transition-colors hover:border-dim hover:text-ink"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
