'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GAME_DOCK_PRIMARY_BTN } from '@/components/game-dock-parts'
import { StoryHud } from '@/components/story/hud'
import { TableHostContext, type TableHost } from '@/components/tables/table-shell'
import { useHydrated } from '@/hooks/use-hydrated'
import { CITY_BY_ID } from '@/lib/story/cities'
import { TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import { TABLE_REGISTRY } from '@/lib/tables/registry'
import { ordinal, payoutsFor } from '@/lib/tables/stakes'
import { useStoryStore } from '@/store/story-store'
import type { OpenTable } from '@/store/tables-store'
import { formatChips } from '@/utils/format'

const money = (n: number) => `$${formatChips(n)}`
/** Remembers which practice table this browser already dealt, so a reload or a second visit counts as leaving. */
const SEATED_KEY = 'floored-story-practice-seated'
const noop = () => {}

type Result = { place: number; prize: number; buyIn: number; city: string }

/**
 * The high-roller room's practice table: the city boss's bot game as a tournament
 * against regular bots (no boss seated), on the Tables code. It takes the night in
 * place of bets. Your place pays from the pool as Tables tournaments pay; leaving
 * before it is decided, or coming back to a table already dealt, is last place.
 */
export default function StoryPracticeTablePage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const [table, setTable] = useState<OpenTable | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const started = useRef(false)
  const decided = useRef(false)

  useEffect(() => {
    if (!hydrated || started.current) return
    started.current = true
    const s = useStoryStore.getState()
    const t = s.tonight?.table
    if (!t || t.result) {
      router.replace('/story')
      return
    }
    let seen: string | null = null
    try {
      seen = window.localStorage.getItem(SEATED_KEY)
    } catch {}
    if (seen === String(t.seed)) {
      decided.current = true
      s.practiceResult(t.seats, 0)
      router.replace('/story')
      return
    }
    try {
      window.localStorage.setItem(SEATED_KEY, String(t.seed))
    } catch {}
    setTable({
      id: `practice-${t.seed}`,
      game: t.game,
      tier: 'regular',
      buyIn: t.buyIn,
      seats: t.seats,
      seed: t.seed,
      startedAt: new Date().toISOString(),
      seated: true,
      format: 'tournament',
    })
  }, [hydrated, router])

  const settle = useCallback((place: number, prize: number) => {
    if (decided.current) return
    decided.current = true
    const s = useStoryStore.getState()
    const t = s.tonight?.table
    if (!t) return
    s.practiceResult(place, prize)
    const paid = useStoryStore.getState().tonight?.table?.result?.prize ?? 0
    const next: Result = { place, prize: paid, buyIn: t.buyIn, city: s.city }
    // A beat to read the last hand before the panel.
    setTimeout(() => setResult(next), 1500)
  }, [])

  const onProgress = useCallback<TableHost['onProgress']>(
    ({ standings, place }) => {
      if (decided.current || place == null || !table) return
      settle(place, payoutsFor(standings, table.buyIn, table.seats, table.game)[0] ?? 0)
    },
    [settle, table],
  )

  const cityName = result ? (CITY_BY_ID.get(result.city as never)?.name ?? 'the city') : ''
  const gameName = table ? (TABLE_GAME_BY_NAME.get(table.game)?.label ?? 'table') : ''
  const host = useMemo<TableHost>(
    () => ({
      backHref: '/story',
      backLabel: 'Story',
      statusLabel: 'Practice table',
      leaveText: 'Leave now and you finish last. The buy-in stays in the pot, and the night is over.',
      onProgress,
      onForfeit: () => settle(table?.seats ?? 4, 0),
      result: result && (
        <>
          <p className={result.prize > result.buyIn ? 'text-[17px] font-semibold text-gold glow-gold' : 'text-[17px] font-semibold text-ink'}>
            {ordinal(result.place)} at the {gameName} table
          </p>
          <p className="mt-1 text-[13px] text-soft">
            {result.prize ? (
              <>
                The pot pays <span className="num text-gold">{money(result.prize)}</span> on a <span className="num text-ink">{money(result.buyIn)}</span> buy-in.
              </>
            ) : (
              <>
                The <span className="num text-ink">{money(result.buyIn)}</span> buy-in stays in the pot. Good practice for the back room.
              </>
            )}
          </p>
          <div className="mt-5 flex justify-center">
            <Link href="/story" className={GAME_DOCK_PRIMARY_BTN + ' inline-flex items-center justify-center'}>
              Back to {cityName}
            </Link>
          </div>
        </>
      ),
    }),
    [onProgress, settle, result, cityName, gameName, table],
  )

  if (!table) return <div className="flex-1" aria-busy="true" />
  const Table = TABLE_REGISTRY[table.game]
  // The story frame and HUD around the table; leaving goes through the table's own corner button (a forfeit asks first).
  return (
    <div className="st-screen flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
      <StoryHud title="The high-roller room" />
      <div className="st-room flex min-h-0 flex-1 flex-col sm:p-3">
        <TableHostContext.Provider value={host}>
          <Table table={table} onPlayAgain={noop} />
        </TableHostContext.Provider>
      </div>
    </div>
  )
}
