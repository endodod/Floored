'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GAME_BOARD_ARENA, GAME_CARD_SHELL, GAME_CONTROL_DOCK_M, GAME_STATUS_BAR } from '@/components/game-layout'
import { GAME_DOCK_LEAVE_BTN, GAME_DOCK_PRIMARY_BTN, GAME_DOCK_SECONDARY_BTN } from '@/components/game-dock-parts'
import { GameFieldWithHistory, type MatchHistoryEntry } from '@/components/game-match-history'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TableGameEntry } from '@/lib/tables/catalog'
import { cashStakeFor, limitsLabel, ordinal, payoutsFor, TIER_BY_ID } from '@/lib/tables/stakes'
import { placeIn } from '@/lib/tables/standings'
import type { Standings } from '@/lib/tables/types'
import { useTablesStore, type OpenTable } from '@/store/tables-store'
import { formatChips } from '@/utils/format'
import { signed, toneOf } from '@/components/ui/terminal'
import type { CashRunner } from './use-table-runner'
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
  cash: cashRunner = null,
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
  /** Cash tables: the runner's seat, chips and leave / top-up controls. */
  cash?: CashRunner | null
}) {
  const router = useRouter()
  const finish = useTablesStore((s) => s.finish)
  const forfeit = useTablesStore((s) => s.forfeit)
  const wallet = useTablesStore((s) => s.wallet)
  const storeTopUp = useTablesStore((s) => s.topUp)
  const lastCash = useTablesStore((s) => s.lastCashResult)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmCashLeave, setConfirmCashLeave] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [resultReady, setResultReady] = useState(false)
  const settled = useRef(false)
  const tier = TIER_BY_ID.get(table.tier)!
  const cash = table.format === 'cash'
  const stake = cash ? cashStakeFor(table.game, table.stake ?? 'low') : null
  // This session's summary, once you have left (the store cashes out through the table's onLeave).
  const session = cash && lastCash?.id === table.id ? lastCash : null
  const prizes = payoutsFor(standings, table.buyIn, table.seats, table.game)
  const prize = place != null ? (prizes[0] ?? 0) : 0

  useEffect(() => {
    if (cash || place == null || settled.current) return
    settled.current = true
    finish(place, prize)
  }, [cash, place, prize, finish])

  function leave() {
    if (cash) {
      if (session) router.push('/tables/lobby')
      else if (cashRunner?.inPlay) setConfirmCashLeave(true)
      else cashRunner?.leave()
    } else if (place == null) setConfirmLeave(true)
    else router.push('/tables/lobby')
  }

  function topUp(amount: number) {
    if (!cashRunner?.betweenHands || amount < 1 || amount > wallet) return
    // Table and wallet move together: the table only takes chips between hands, the wallet only what it has.
    if (cashRunner.topUp(amount)) storeTopUp(amount)
    setTopUpOpen(false)
  }

  // Arrivals and departures join the hand history.
  const entries = useMemo(() => {
    if (!cashRunner?.log.length) return history
    const seatEvents: MatchHistoryEntry[] = cashRunner.log.map((e) => ({
      id: `cash-${e.id}`,
      at: e.at,
      tone: 'neutral',
      title: e.kind === 'sit' ? `${e.name} sits down` : e.kind === 'leave' ? `${e.name} leaves` : `${e.name} tops up`,
      subtitle: `${e.kind === 'leave' ? 'with' : e.kind === 'sit' ? 'with' : 'adds'} ${formatChips(e.amount)}`,
    }))
    return [...seatEvents, ...history].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 80)
  }, [cashRunner?.log, history])

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
          <span className="ml-2 hidden font-normal text-dim sm:inline">
            {cash && stake ? `${stake.label} · ${limitsLabel(table.game, stake)}` : tier.label}
          </span>
        </span>
        <span className="text-[13px] text-dim">{message}</span>
      </div>

      {cash && cashRunner && (
        <CashSessionStrip broughtIn={table.broughtIn ?? 0} stack={cashRunner.stack} hands={table.hands ?? 0} />
      )}

      <GameFieldWithHistory
        className={GAME_BOARD_ARENA}
        boardClassName="relative flex min-h-0 flex-col"
        entries={entries}
        gameLabel={game.label}
        emptyHint="No hands played yet."
      >
        <div className="absolute left-3 top-3 z-20 flex gap-2">
          <button type="button" onClick={leave} className={CORNER_BTN}>
            {cash ? (cashRunner?.leaving ? 'Leaving…' : 'Leave table') : '← Tables'}
          </button>
          {cash && (
            <button
              type="button"
              onClick={() => setTopUpOpen(true)}
              disabled={!cashRunner?.betweenHands || wallet < 1 || !!session || cashRunner?.leaving}
              title={cashRunner?.betweenHands ? undefined : 'Top up between hands'}
              className={`${CORNER_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
            >
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

        {place != null && watching && !over && (
          <p className="tb-watch rise pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-control bg-ground px-3 py-1 text-[12px] text-soft">
            You finished {ordinal(place)} · watching
          </p>
        )}

        {cash && cashRunner?.broke && !session && !cashRunner.leaving && (
          <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center px-3">
            <section className="tb-result rise flex w-full max-w-sm flex-col items-center gap-3 rounded-md bg-surface p-4 text-center shadow-[inset_0_0_0_1px_var(--line),0_30px_80px_-30px_rgba(0,0,0,0.95)]" aria-live="polite">
              <p className="text-[15px] font-semibold text-ink">You&apos;re out of chips</p>
              <p className="text-[13px] text-soft">
                {wallet > 0 ? (
                  <>Top up from your wallet (<span className="num text-ink">{formatChips(wallet)}</span>) to keep playing, or leave the table.</>
                ) : (
                  'Your wallet is empty too. Leave the table to refill it.'
                )}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => cashRunner.leave()} className={GAME_DOCK_SECONDARY_BTN}>
                  Leave table
                </button>
                <button type="button" onClick={() => setTopUpOpen(true)} disabled={wallet < 1 || !cashRunner.betweenHands} className={GAME_DOCK_PRIMARY_BTN + ' min-w-0'}>
                  Top up
                </button>
              </div>
            </section>
          </div>
        )}

        {session && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(10,12,11,0.62)] p-4 backdrop-blur-[2px]">
            <section className="tb-result rise w-full max-w-sm rounded-md bg-surface p-5 shadow-[inset_0_0_0_1px_var(--line),0_30px_80px_-30px_rgba(0,0,0,0.95)]" aria-live="polite">
              <p className={cn('text-[17px] font-semibold', session.cashedOut > session.broughtIn ? 'text-felt glow-felt' : 'text-ink')}>You left the table</p>
              <p className="mt-1 text-[13px] text-soft">
                Brought <span className="num text-ink">{formatChips(session.broughtIn)}</span> · leaving with{' '}
                <span className="num text-ink">{formatChips(session.cashedOut)}</span> ·{' '}
                <span className={cn('num', toneOf(session.cashedOut - session.broughtIn) === 'win' ? 'text-felt' : toneOf(session.cashedOut - session.broughtIn) === 'loss' ? 'text-loss' : 'text-soft')}>
                  {signed(session.cashedOut - session.broughtIn, formatChips)}
                </span>{' '}
                in {session.hands} {table.game === 'liars-dice' ? (session.hands === 1 ? 'game' : 'games') : session.hands === 1 ? 'hand' : 'hands'}
              </p>
              <div className="mt-5 flex justify-center">
                <button type="button" onClick={() => router.push('/tables/lobby')} className={GAME_DOCK_PRIMARY_BTN}>
                  Back to tables
                </button>
              </div>
            </section>
          </div>
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
                <button type="button" onClick={() => router.push('/tables/lobby')} className={GAME_DOCK_SECONDARY_BTN}>
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

      <Dialog open={confirmCashLeave} onOpenChange={setConfirmCashLeave}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave the table?</DialogTitle>
            <DialogDescription>
              {table.game === 'holdem' ? (
                <>You fold this hand and leave with <span className="num text-ink">{formatChips(cashRunner?.stack ?? 0)}</span>. Chips already in the pot stay there.</>
              ) : table.game === 'liars-dice' ? (
                <>You give up your dice and leave with <span className="num text-ink">{formatChips(cashRunner?.stack ?? 0)}</span>. Your ante stays in the pot.</>
              ) : (
                <>You stand and leave when this hand settles.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end">
            <DialogClose asChild>
              <Button variant="outline">Stay</Button>
            </DialogClose>
            <Button
              onClick={() => {
                setConfirmCashLeave(false)
                cashRunner?.leave()
              }}
            >
              Leave table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CashChipsDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        title="Top up"
        description={stake ? `${stake.label} · ${limitsLabel(table.game, stake)} · from your wallet` : ''}
        wallet={wallet}
        action="Add chips"
        onConfirm={topUp}
      />

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
                router.push('/tables/lobby')
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

/** Brought in · stack · net, under the status bar of a cash table. */
function CashSessionStrip({ broughtIn, stack, hands }: { broughtIn: number; stack: number; hands: number }) {
  const net = stack - broughtIn
  const tone = toneOf(net)
  return (
    <div className="tb-session flex h-7 shrink-0 items-center justify-center gap-4 border-b border-rule px-3 text-[12px] text-dim">
      <span>
        Brought <span className="num text-soft">{formatChips(broughtIn)}</span>
      </span>
      <span>
        Stack <span className="num text-ink">{formatChips(stack)}</span>
      </span>
      <span className={cn('num', tone === 'win' ? 'text-felt' : tone === 'loss' ? 'text-loss' : 'text-soft')}>{signed(net, formatChips)}</span>
      <span className="hidden sm:inline">
        <span className="num text-soft">{hands}</span> played
      </span>
    </div>
  )
}

/**
 * Choose an amount of chips from the wallet: field, quick picks
 * (¼ · ½ · All of the wallet), confirm. Sitting down at a cash table and
 * topping up both use it.
 */
export function CashChipsDialog({
  open,
  onOpenChange,
  title,
  description,
  wallet,
  action,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  wallet: number
  action: string
  onConfirm: (amount: number) => void
}) {
  const [amount, setAmount] = useState(wallet)
  useEffect(() => {
    if (open) setAmount(wallet)
  }, [open, wallet])
  const valid = amount >= 1 && amount <= wallet
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-[12px] text-dim">
          Chips · wallet <span className="num text-soft">{formatChips(wallet)}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={wallet}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="num w-full rounded-md border border-control bg-ground px-3 py-2 text-[15px] text-ink focus:border-felt focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          {([['¼', 0.25], ['½', 0.5], ['All', 1]] as const).map(([label, share]) => (
            <button
              key={label}
              type="button"
              onClick={() => setAmount(Math.max(1, Math.floor(wallet * share)))}
              className="m-still h-9 flex-1 rounded-full border border-control text-[13px] font-semibold text-ink transition-colors hover:border-felt hover:bg-felt-tint"
            >
              {label}
            </button>
          ))}
        </div>
        <DialogFooter className="flex-row justify-end">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => valid && onConfirm(amount)} disabled={!valid}>
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
