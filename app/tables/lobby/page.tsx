'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHydrated } from '@/hooks/use-hydrated'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { TABLE_GAMES, TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import { cashStakeFor, limitsLabel, MIN_BUY_IN, TABLES_START_WALLET, TABLE_TIERS, TIER_BY_ID, ordinal, prizes } from '@/lib/tables/stakes'
import type { CashStakeId, TableFormat, TableGameName, TableTier } from '@/lib/tables/types'
import { useTablesStore } from '@/store/tables-store'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { FigureStrip, PageTitle, SectionTitle, signed, toneOf } from '@/components/ui/terminal'
import { GameTile } from '@/components/game-tile'
import { ScreenSkeleton } from '@/components/screen-skeleton'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const TIER_KEY = 'floored-tables-tier'
const FORMAT_KEY = 'floored-tables-format'

function readTier(): TableTier {
  try {
    const t = window.localStorage.getItem(TIER_KEY)
    return t === 'regular' || t === 'shark' ? t : 'rookie'
  } catch {
    return 'rookie'
  }
}

export default function TablesLobbyPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const isMobile = useIsMobile()
  const s = useTablesStore()
  const [tier, setTier] = useState<TableTier>('rookie')
  const [format, setFormat] = useState<TableFormat>('tournament')
  const [cashStake, setCashStake] = useState<CashStakeId>('low')
  const [pending, setPending] = useState<TableGameName | null>(null)
  const [cashGame, setCashGame] = useState<TableGameName | null>(null)
  const [buyIn, setBuyIn] = useState(0)

  useEffect(() => {
    setTier(readTier())
    try { setFormat(window.localStorage.getItem(FORMAT_KEY) === 'cash' ? 'cash' : 'tournament') } catch { /* Keep default. */ }
    try { window.localStorage.removeItem('floored-tables-difficulty') } catch { /* Ignore an obsolete preference. */ }
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
  const broke = s.wallet < MIN_BUY_IN
  const last = s.lastResult
  const lastGame = last ? TABLE_GAME_BY_NAME.get(last.game) : null

  function pickTier(t: TableTier) {
    setTier(t)
    try {
      window.localStorage.setItem(TIER_KEY, t)
    } catch {
      // Not remembered; nothing else to do.
    }
  }
  function pickFormat(next: TableFormat) {
    setFormat(next)
    try { window.localStorage.setItem(FORMAT_KEY, next) } catch { /* Keep current session only. */ }
  }

  function sitDown(game: TableGameName) {
    if (pending) return
    const entry = TABLE_GAME_BY_NAME.get(game)!
    const seats = isMobile ? entry.phoneSeats : entry.seats
    if (!useTablesStore.getState().sitDown(game, tier, seats)) return
    setPending(game)
    router.push(`/tables/${game}`)
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
        title="Choose a table"
        sub={format === 'cash' ? 'Bring chips from your wallet and play until you leave.' : 'Choose a buy-in, then pick a table.'}
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

      <FigureStrip
        items={[
          { label: 'Wallet', value: formatChips(s.wallet), sub: s.refills ? `${s.refills} refill${s.refills > 1 ? 's' : ''}` : 'Tables play money' },
          { label: 'Tables played', value: totals.played },
          { label: 'Won', value: totals.won, sub: `${totals.cashes} in the money` },
          { label: 'Net', value: signed(totals.net, formatChips), tone: toneOf(totals.net) },
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

      <div role="radiogroup" aria-label="Table format" className="flex gap-2 rounded-md bg-surface p-1">
        {(['tournament', 'cash'] as const).map((item) => <button key={item} type="button" role="radio" aria-checked={format === item} onClick={() => pickFormat(item)} className={cn('m-still flex-1 rounded px-3 py-2 text-sm font-semibold', format === item ? 'bg-felt text-white' : 'text-soft')}>
          {item === 'tournament' ? 'Tournaments' : 'Cash tables'}
        </button>)}
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="tables-stakes">
        <SectionTitle suit={1} note={format === 'cash' ? 'Table limits · bring any amount' : 'Choose a buy-in · bots vary by table'}>
          <span id="tables-stakes">Stakes</span>
        </SectionTitle>
        <div role="radiogroup" aria-label="Stakes" className="grid grid-cols-3 gap-2">
          {(format === 'tournament' ? TABLE_TIERS : [{ id: 'low', label: 'Low stakes', symbol: '🪙' }, { id: 'mid', label: 'Mid stakes', symbol: '💰' }, { id: 'high', label: 'High stakes', symbol: '💎' }]).map((t) => {
            const on = format === 'tournament' ? t.id === tier : t.id === cashStake
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => format === 'tournament' ? pickTier(t.id as TableTier) : setCashStake(t.id as CashStakeId)}
                className={cn(
                  'm-still flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors sm:px-4',
                  on ? 'border-felt bg-felt-tint shadow-[0_0_20px_-8px_rgba(79,174,132,0.7)]' : 'border-line bg-surface hover:border-control',
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-sm leading-none">{t.symbol}</span>
                  <span className={cn('text-[13px] font-semibold', on ? 'text-ink' : 'text-soft')}>{t.label}</span>
                </span>
                {format === 'tournament' ? <span className="num mt-0.5 text-[17px] text-ink">{formatChips((t as typeof TABLE_TIERS[number]).buyIn)}</span> : (
                  <span className="mt-1 grid w-full gap-0.5 text-xs text-ink">
                    {TABLE_GAMES.map((game) => <span key={game.name} className="flex items-baseline justify-between gap-2"><span className="text-soft">{game.label}</span><span className="num">{limitsLabel(game.name, cashStakeFor(game.name, t.id as CashStakeId))}</span></span>)}
                  </span>
                )}
                <span className="mt-0.5 text-xs text-dim">{format === 'tournament' ? 'Paid to the prize pool' : 'No prize pool · leave with your stack'}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="tables-games">
        <SectionTitle suit={3} note={format === 'tournament' ? `Buy-in ${formatChips(chosen.buyIn)} · paid into prize pool` : 'Choose a cash table'}>
          <span id="tables-games">Pick a table</span>
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TABLE_GAMES.map((g, i) => {
            const seats = isMobile ? g.phoneSeats : g.seats
            const prize = prizes(chosen.buyIn, seats, g.name)
            const affordable = format === 'cash' ? s.wallet > 0 : s.wallet >= chosen.buyIn
            return (
              <li key={g.name}>
                <GameTile
                  index={i}
                  roomy
                  label={g.label}
                  symbol={g.symbol}
                  sub={format === 'cash' ? g.cash.sub : g.sub}
                  meta={
                    <span className="num text-xs text-gold">
                      {format === 'cash' ? limitsLabel(g.name, cashStakeFor(g.name, cashStake)) : prize.length > 1
                        ? `1st ${formatChips(prize[0]!)} · 2nd ${formatChips(prize[1]!)}`
                        : `Winner takes ${formatChips(prize[0]!)}`}
                    </span>
                  }
                  action={affordable ? format === 'cash' ? 'Sit down' : `Sit down · ${formatChips(chosen.buyIn)}` : 'Not enough'}
                  disabled={!affordable || !!pending}
                  faded={!affordable || (!!pending && pending !== g.name)}
                  loading={pending === g.name}
                  onClick={() => format === 'cash' ? openCash(g.name) : sitDown(g.name)}
                >
                  <span className="text-xs text-soft">
                    {seats} seats · {format === 'cash' ? g.cash.format : g.format}
                  </span>
                </GameTile>
              </li>
            )
          })}
        </ul>
      </section>

      <Dialog open={cashGame != null} onOpenChange={(open) => !open && setCashGame(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bring chips to the table</DialogTitle><DialogDescription>{cashGame && `${cashStakeFor(cashGame, cashStake).label} · ${limitsLabel(cashGame, cashStakeFor(cashGame, cashStake))}`}</DialogDescription></DialogHeader>
          <input type="number" min={1} max={s.wallet} value={buyIn} onChange={(event) => setBuyIn(Math.max(0, Math.floor(Number(event.target.value))))} className="num w-full rounded border border-line bg-ground px-3 py-2 text-ink" aria-label="Chips to bring" />
          <div className="flex gap-2">{[['¼', .25], ['½', .5], ['All', 1]].map(([label, fraction]) => <button key={String(label)} type="button" onClick={() => setBuyIn(Math.max(1, Math.floor(s.wallet * Number(fraction))))} className="rounded border border-control px-3 py-1 text-sm text-soft">{label}</button>)}</div>
          <DialogFooter><Button onClick={sitDownCash} disabled={buyIn < 1 || buyIn > s.wallet}>Sit down</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
