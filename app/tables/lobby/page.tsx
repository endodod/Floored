'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHydrated } from '@/hooks/use-hydrated'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { TABLE_GAMES, TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import { MIN_BUY_IN, TABLES_START_WALLET, TABLE_TIERS, TIER_BY_ID, ordinal, prizes } from '@/lib/tables/stakes'
import type { TableGameName, TableTier } from '@/lib/tables/types'
import { useTablesStore } from '@/store/tables-store'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { FigureStrip, PageTitle, SectionTitle, signed, toneOf } from '@/components/ui/terminal'
import { GameTile } from '@/components/game-tile'
import { ScreenSkeleton } from '@/components/screen-skeleton'
import { cn } from '@/lib/utils'

const TIER_KEY = 'floored-tables-tier'

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
  const [pending, setPending] = useState<TableGameName | null>(null)

  useEffect(() => {
    setTier(readTier())
    try { window.localStorage.removeItem('floored-tables-difficulty') } catch { /* Ignore an obsolete preference. */ }
    // A table left mid-way counts as a forfeit; one bought but never dealt is refunded.
    const st = useTablesStore.getState()
    if (st.open?.seated) st.forfeit()
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

  function sitDown(game: TableGameName) {
    if (pending) return
    const entry = TABLE_GAME_BY_NAME.get(game)!
    const seats = isMobile ? entry.phoneSeats : entry.seats
    if (!useTablesStore.getState().sitDown(game, tier, seats)) return
    setPending(game)
    router.push(`/tables/${game}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-6 pb-12">
      <PageTitle
        title="Choose a table"
        sub="Choose a buy-in, then pick a table."
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

      <section className="flex flex-col gap-4" aria-labelledby="tables-stakes">
        <SectionTitle suit={1} note="Choose a buy-in · bots vary by table">
          <span id="tables-stakes">Stakes</span>
        </SectionTitle>
        <div role="radiogroup" aria-label="Stakes" className="grid grid-cols-3 gap-2">
          {TABLE_TIERS.map((t) => {
            const on = t.id === tier
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickTier(t.id)}
                className={cn(
                  'm-still flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors sm:px-4',
                  on ? 'border-felt bg-felt-tint shadow-[0_0_20px_-8px_rgba(79,174,132,0.7)]' : 'border-line bg-surface hover:border-control',
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className="text-sm leading-none">{t.symbol}</span>
                  <span className={cn('text-[13px] font-semibold', on ? 'text-ink' : 'text-soft')}>{t.label}</span>
                </span>
                <span className="num mt-0.5 text-[17px] text-ink">{formatChips(t.buyIn)}</span>
                <span className="mt-0.5 text-xs text-dim">Paid to the prize pool</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="tables-games">
        <SectionTitle suit={3} note={`Buy-in ${formatChips(chosen.buyIn)} · paid into prize pool`}>
          <span id="tables-games">Pick a table</span>
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TABLE_GAMES.map((g, i) => {
            const seats = isMobile ? g.phoneSeats : g.seats
            const prize = prizes(chosen.buyIn, seats, g.name)
            const affordable = s.wallet >= chosen.buyIn
            return (
              <li key={g.name}>
                <GameTile
                  index={i}
                  roomy
                  label={g.label}
                  symbol={g.symbol}
                  sub={g.sub}
                  meta={
                    <span className="num text-xs text-gold">
                      {prize.length > 1
                        ? `1st ${formatChips(prize[0]!)} · 2nd ${formatChips(prize[1]!)}`
                        : `Winner takes ${formatChips(prize[0]!)}`}
                    </span>
                  }
                  action={affordable ? `Sit down · ${formatChips(chosen.buyIn)}` : 'Not enough'}
                  disabled={!affordable || !!pending}
                  faded={!affordable || (!!pending && pending !== g.name)}
                  loading={pending === g.name}
                  onClick={() => sitDown(g.name)}
                >
                  <span className="text-xs text-soft">
                    {seats} seats · {g.format}
                  </span>
                </GameTile>
              </li>
            )
          })}
        </ul>
      </section>

    </div>
  )
}
