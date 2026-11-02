'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHydrated } from '@/hooks/use-hydrated'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { TABLE_GAMES, TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import { cashStakeFor, limitsLabel, MIN_BUY_IN, TABLES_START_WALLET, TABLE_TIERS, TIER_BY_ID, ordinal, prizes } from '@/lib/tables/stakes'
import type { CashStakeId, TableGameName, TableTier } from '@/lib/tables/types'
import { useTablesStore } from '@/store/tables-store'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { FigureStrip, PageTitle, SectionTitle, signed, toneOf } from '@/components/ui/terminal'
import { GameTile } from '@/components/game-tile'
import { ScreenSkeleton } from '@/components/screen-skeleton'
import { cn } from '@/lib/utils'
import { HowItWorks } from '@/components/mode-intro'
import { TABLES_STEPS } from '@/lib/tables/tutorials'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChipAmount } from '@/components/tables/table-shell'

const TIER_KEY = 'floored-tables-tier'
const CASH_STAKE_IDS: CashStakeId[] = ['low', 'mid', 'high']
const MAX_BUY_IN = Math.max(...TABLE_TIERS.map((t) => t.buyIn))

function readTier(): TableTier {
  try {
    const t = window.localStorage.getItem(TIER_KEY)
    return t === 'regular' || t === 'shark' ? t : 'rookie'
  } catch {
    return 'rookie'
  }
}

export default function TablesPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const isMobile = useIsMobile()
  const s = useTablesStore()
  const [tier, setTier] = useState<TableTier>('rookie')
  const [tourGame, setTourGame] = useState<TableGameName | null>(null)
  const [cashStake, setCashStake] = useState<CashStakeId>('low')
  const [pending, setPending] = useState<TableGameName | null>(null)
  const [cashGame, setCashGame] = useState<TableGameName | null>(null)
  const [buyIn, setBuyIn] = useState(0)

  useEffect(() => {
    setTier(readTier())
    // Obsolete preferences: the old difficulty picker and the Tournaments / Cash toggle.
    try {
      window.localStorage.removeItem('floored-tables-difficulty')
      window.localStorage.removeItem('floored-tables-format')
    } catch {
      /* Ignore. */
    }
    // A table left mid-way counts as a forfeit; one bought but never dealt is refunded.
    const st = useTablesStore.getState()
    if (st.open?.format === 'cash') st.cashOut()
    else if (st.open?.seated) st.forfeit()
    else if (st.open) st.cancelUnseated()
  }, [])

  useEffect(() => {
    TABLE_GAMES.forEach((g) => router.prefetch(`/tables/${g.name}`))
  }, [router])

  if (!hydrated) return <ScreenSkeleton />

  const chosen = TIER_BY_ID.get(tier)!
  const totals = Object.values(s.stats).reduce(
    (acc, st) => ({ played: acc.played + st.played, won: acc.won + st.won, cashes: acc.cashes + st.cashes, net: acc.net + st.net }),
    { played: 0, won: 0, cashes: 0, net: 0 },
  )
  const cashTotals = Object.values(s.cashStats).reduce((acc, st) => ({ sessions: acc.sessions + st.sessions, net: acc.net + st.net }), { sessions: 0, net: 0 })
  const broke = s.wallet < MIN_BUY_IN
  // Show the newer of the last tournament and the last cash session.
  const lastCash = s.lastCashResult
  const cashIsNewer = !!lastCash && (!s.lastResult || lastCash.endedAt > s.lastResult.endedAt)
  const last = cashIsNewer ? null : s.lastResult
  const lastGame = last ? TABLE_GAME_BY_NAME.get(last.game) : null
  const lastCashGame = cashIsNewer && lastCash ? TABLE_GAME_BY_NAME.get(lastCash.game) : null
  const tourEntry = tourGame ? TABLE_GAME_BY_NAME.get(tourGame)! : null
  const tourSeats = tourEntry ? (isMobile ? tourEntry.phoneSeats : tourEntry.seats) : 0
  const cashEntry = cashGame ? TABLE_GAME_BY_NAME.get(cashGame)! : null

  function pickTier(t: TableTier) {
    setTier(t)
    try {
      window.localStorage.setItem(TIER_KEY, t)
    } catch {
      // Not remembered; nothing else to do.
    }
  }

  function sitDown(game: TableGameName) {
    if (pending) return
    const entry = TABLE_GAME_BY_NAME.get(game)!
    const seats = isMobile ? entry.phoneSeats : entry.seats
    if (!useTablesStore.getState().sitDown(game, tier, seats)) return
    setPending(game)
    router.push(`/tables/${game}`)
  }
  function openTour(game: TableGameName) {
    // Preselect the remembered buy-in, or the biggest one the wallet still covers.
    if (s.wallet < chosen.buyIn) {
      const fits = [...TABLE_TIERS].reverse().find((t) => t.buyIn <= s.wallet)
      if (fits) pickTier(fits.id)
    }
    setTourGame(game)
  }
  function openCash(game: TableGameName) {
    setCashGame(game)
    setBuyIn(s.wallet)
  }
  function sitDownCash() {
    if (!cashGame || pending) return
    const entry = TABLE_GAME_BY_NAME.get(cashGame)!
    const seats = isMobile ? entry.phoneSeats : entry.seats
    if (!useTablesStore.getState().sitDownCash(cashGame, cashStake, buyIn, seats)) return
    setPending(cashGame)
    router.push(`/tables/${cashGame}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-6 pb-12">
      <PageTitle
        title="Tables"
        sub="Play against bots. Tournaments pay a prize pool; cash tables let you bring any amount and leave when you like."
      />

      {last && lastGame && (
        <div
          className={cn(
            'rise relative overflow-hidden rounded-md bg-surface px-5 py-4',
            last.prize > 0 ? 'shadow-[inset_2px_0_0_var(--felt)]' : 'shadow-[inset_2px_0_0_var(--loss)]',
          )}
          role="status"
        >
          <p className={cn('text-[15px] font-semibold', last.prize > 0 ? 'text-felt glow-felt' : 'text-loss glow-loss')}>
            {last.forfeited ? `Left the ${lastGame.label} table.` : last.place === 1 ? `You won the ${lastGame.label} table.` : `${ordinal(last.place)} at ${lastGame.label}.`}
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-soft">
            {last.forfeited
              ? `Leaving before your place was decided forfeits the ${formatChips(last.buyIn)} buy-in.`
              : last.prize > 0
                ? `Prize ${formatChips(last.prize)} on a ${formatChips(last.buyIn)} buy-in.`
                : `No prize this time; the ${formatChips(last.buyIn)} buy-in went to the pool.`}
          </p>
        </div>
      )}

      {lastCash && lastCashGame && (
        <div
          className={cn(
            'rise relative overflow-hidden rounded-md bg-surface px-5 py-4',
            lastCash.cashedOut - lastCash.broughtIn > 0 ? 'shadow-[inset_2px_0_0_var(--felt)]' : lastCash.cashedOut < lastCash.broughtIn ? 'shadow-[inset_2px_0_0_var(--loss)]' : 'shadow-[inset_2px_0_0_var(--line)]',
          )}
          role="status"
        >
          <p
            className={cn(
              'text-[15px] font-semibold',
              lastCash.cashedOut > lastCash.broughtIn ? 'text-felt glow-felt' : lastCash.cashedOut < lastCash.broughtIn ? 'text-loss glow-loss' : 'text-ink',
            )}
          >
            Left the {lastCashGame.cash.label} table <span className="num">{signed(lastCash.cashedOut - lastCash.broughtIn, formatChips)}</span>
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-soft">
            Brought {formatChips(lastCash.broughtIn)}, left with {formatChips(lastCash.cashedOut)} after {lastCash.hands}{' '}
            {lastCash.game === 'liars-dice' ? (lastCash.hands === 1 ? 'game' : 'games') : lastCash.hands === 1 ? 'hand' : 'hands'}.
          </p>
          <button type="button" onClick={s.dismissCashResult} className="absolute right-3 top-3 text-[12px] text-dim hover:text-ink" aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <FigureStrip
        items={[
          { label: 'Wallet', value: formatChips(s.wallet), sub: s.refills ? `${s.refills} refill${s.refills > 1 ? 's' : ''}` : 'Tables play money' },
          { label: 'Tournaments', value: totals.played, sub: `${totals.won} won · ${totals.cashes} in the money` },
          { label: 'Tournament net', value: signed(totals.net, formatChips), tone: toneOf(totals.net) },
          { label: 'Cash net', value: signed(cashTotals.net, formatChips), tone: toneOf(cashTotals.net), sub: `${cashTotals.sessions} session${cashTotals.sessions === 1 ? '' : 's'}` },
        ]}
      />

      {broke && (
        <div className="rise flex flex-col gap-3 rounded-md bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-soft">
            Your wallet can&apos;t cover the smallest buy-in. Refill it to {formatChips(TABLES_START_WALLET)} and sit back down.
          </p>
          <Button onClick={s.refill}>Refill wallet</Button>
        </div>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="tables-games">
        <SectionTitle suit={1} note={`Buy-in ${formatChips(MIN_BUY_IN)}–${formatChips(MAX_BUY_IN)} · paid into a prize pool`}>
          <span id="tables-games">Tournaments</span>
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TABLE_GAMES.map((g, i) => {
            const seats = isMobile ? g.phoneSeats : g.seats
            return (
              <li key={g.name}>
                <GameTile
                  index={i}
                  label={g.label}
                  symbol={g.symbol}
                  sub={`${seats} seats · ${g.format}`}
                  meta={<span className="num text-xs text-gold">Buy-in from {formatChips(MIN_BUY_IN)}</span>}
                  action={broke ? 'Not enough' : 'Choose stakes'}
                  disabled={broke || !!pending}
                  faded={broke || (!!pending && pending !== g.name)}
                  loading={pending === g.name}
                  onClick={() => openTour(g.name)}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="tables-cash">
        <SectionTitle suit={3} note="Bring any amount · leave with your stack">
          <span id="tables-cash">Cash tables</span>
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TABLE_GAMES.map((g, i) => {
            const seats = isMobile ? g.phoneSeats : g.seats
            const affordable = s.wallet > 0
            return (
              <li key={g.name}>
                <GameTile
                  index={i + TABLE_GAMES.length}
                  label={g.cash.label}
                  symbol={g.symbol}
                  sub={`${seats} seats · ${g.cash.format}`}
                  meta={<span className="text-xs text-soft">{g.cash.sub}</span>}
                  action={affordable ? 'Sit down' : 'Not enough'}
                  disabled={!affordable || !!pending}
                  faded={!affordable || (!!pending && pending !== g.name)}
                  loading={pending === g.name}
                  onClick={() => openCash(g.name)}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <Dialog open={tourGame != null} onOpenChange={(open) => !open && setTourGame(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tourEntry ? `${tourEntry.label} tournament` : 'Tournament'}</DialogTitle>
            <DialogDescription>Choose a buy-in. It goes into the prize pool; bots vary by table.</DialogDescription>
          </DialogHeader>
          <WalletLine wallet={s.wallet} />
          <StakePicker
            label="Buy-in"
            value={tier}
            onChange={(id) => pickTier(id as TableTier)}
            options={TABLE_TIERS.map((t) => {
              const prize = tourEntry ? prizes(t.buyIn, tourSeats, tourEntry.name) : []
              return {
                id: t.id,
                symbol: t.symbol,
                label: t.label,
                value: formatChips(t.buyIn),
                note: prize.length > 1 ? `1st ${formatChips(prize[0]!)} · 2nd ${formatChips(prize[1]!)}` : prize.length ? `Winner takes ${formatChips(prize[0]!)}` : '',
                disabled: s.wallet < t.buyIn,
              }
            })}
          />
          <DialogFooter>
            <Button onClick={() => tourGame && sitDown(tourGame)} disabled={!tourGame || s.wallet < chosen.buyIn || !!pending}>
              Sit down · {formatChips(chosen.buyIn)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashGame != null} onOpenChange={(open) => !open && setCashGame(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bring chips to the table</DialogTitle>
            <DialogDescription>{cashEntry ? `${cashEntry.cash.label} · no prize pool, leave with your stack.` : ''}</DialogDescription>
          </DialogHeader>
          <WalletLine wallet={s.wallet} />
          <StakePicker
            label="Table limits"
            value={cashStake}
            onChange={(id) => setCashStake(id as CashStakeId)}
            options={CASH_STAKE_IDS.map((id, i) => ({
              id,
              symbol: TABLE_TIERS[i]!.symbol,
              label: TABLE_TIERS[i]!.label,
              value: cashGame ? limitsLabel(cashGame, cashStakeFor(cashGame, id)) : '',
            }))}
          />
          <ChipAmount value={buyIn} max={s.wallet} onChange={setBuyIn} label="Chips to bring" />
          <DialogFooter>
            <Button onClick={sitDownCash} disabled={buyIn < 1 || buyIn > s.wallet || !!pending}>
              Sit down · <span className="num ml-1">{formatChips(Math.max(0, buyIn))}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HowItWorks steps={TABLES_STEPS} delay={180} />
    </div>
  )
}

interface StakeOption {
  id: string
  symbol: string
  label: string
  value: string
  note?: string
  disabled?: boolean
}

/** Stakes as a stacked radio list inside a dialog: label and amount, an optional note under it. */
function StakePicker({ label, value, onChange, options }: { label: string; value: string; onChange: (id: string) => void; options: StakeOption[] }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              'm-still flex flex-col rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              on ? 'border-felt bg-felt-tint shadow-[0_0_20px_-8px_rgba(79,174,132,0.7)]' : 'border-line bg-surface hover:border-control',
            )}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-sm leading-none">{o.symbol}</span>
                <span className={cn('text-[13px] font-semibold', on ? 'text-ink' : 'text-soft')}>{o.label}</span>
              </span>
              <span className="num text-[15px] text-ink">{o.value}</span>
            </span>
            {o.note && <span className="num mt-0.5 text-xs text-gold">{o.note}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** The Tables wallet, shown in the stake dialogs so buy-ins and chips can be weighed against it. */
function WalletLine({ wallet }: { wallet: number }) {
  return (
    <p className="flex items-baseline justify-between rounded-md bg-ground px-3 py-2 text-[13px] text-soft">
      <span>Your wallet</span>
      <span className="num text-[15px] text-ink">{formatChips(wallet)}</span>
    </p>
  )
}
