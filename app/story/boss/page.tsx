'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GAME_DOCK_PRIMARY_BTN } from '@/components/game-dock-parts'
import { LiarsDiceTable } from '@/components/tables/liars-dice-table'
import { TableHostContext, type TableHost } from '@/components/tables/table-shell'
import { useHydrated } from '@/hooks/use-hydrated'
import { BOSS_SEATS, CUTTER_HALE, bossOutcome } from '@/lib/story/boss'
import { CITY_BY_ID } from '@/lib/story/cities'
import { BOSS_BUYIN_M, BOSS_PURSE_M } from '@/lib/story/economy'
import { useStoryStore } from '@/store/story-store'
import type { OpenTable } from '@/store/tables-store'
import { formatChips } from '@/utils/format'

const money = (n: number) => `$${formatChips(n)}`
/** Remembers which boss table this browser already dealt, so a reload or a second visit counts as leaving. */
const SEATED_KEY = 'floored-story-boss-seated'

const BOTS = [null, CUTTER_HALE]
const noop = () => {}

type Result = { won: boolean; city: string; purse: number; backOn: number | null }

/**
 * The Dustwater boss: Liar's Dice against Cutter Hale on the Tables code. Beat
 * him (his seat out before yours) and the store pays the purse; lose, or leave,
 * and he sits down again in two nights. A table already dealt on an earlier
 * visit was left, so it is a loss.
 */
export default function StoryBossPage() {
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
    if (!s.bossTable) {
      router.replace('/story')
      return
    }
    const seed = s.bossTable.seed
    let seen: string | null = null
    try {
      seen = window.localStorage.getItem(SEATED_KEY)
    } catch {}
    if (seen === String(seed)) {
      decided.current = true
      s.bossResult(false)
      router.replace('/story')
      return
    }
    try {
      window.localStorage.setItem(SEATED_KEY, String(seed))
    } catch {}
    setTable({
      id: `boss-${seed}`,
      game: 'liars-dice',
      tier: 'regular',
      buyIn: BOSS_BUYIN_M * s.minBet(),
      seats: BOSS_SEATS,
      seed,
      startedAt: new Date().toISOString(),
      seated: true,
      format: 'tournament',
    })
  }, [hydrated, router])

  const settle = useCallback((won: boolean) => {
    if (decided.current) return
    decided.current = true
    const before = useStoryStore.getState()
    const city = before.city
    const purse = BOSS_PURSE_M * before.minBet()
    before.bossResult(won)
    const next: Result = { won, city, purse, backOn: useStoryStore.getState().bossBackOn }
    // A beat to read the last reveal before the panel.
    setTimeout(() => setResult(next), 1500)
  }, [])

  const onProgress = useCallback<TableHost['onProgress']>(
    ({ standings, over }) => {
      if (decided.current) return
      const outcome = bossOutcome(standings, over)
      if (outcome) settle(outcome === 'won')
    },
    [settle],
  )

  const cityName = result ? (CITY_BY_ID.get(result.city as never)?.name ?? 'the city') : ''
  const host = useMemo<TableHost>(
    () => ({
      backHref: '/story',
      backLabel: 'Story',
      statusLabel: 'The boss table',
      leaveText: 'Walk away and Cutter takes the table. The buy-in is gone and he is back in two nights.',
      onProgress,
      onForfeit: () => settle(false),
      result: result && (
        <>
          <p className={result.won ? 'text-[17px] font-semibold text-gold glow-gold' : 'text-[17px] font-semibold text-ink'}>
            {result.won ? 'You beat Cutter Hale' : 'Cutter took the table'}
          </p>
          <p className="mt-1 text-[13px] text-soft">
            {result.won ? (
              <>
                Purse <span className="num text-gold">{money(result.purse)}</span> · {cityName} is behind you.
              </>
            ) : result.backOn != null ? (
              <>
                The buy-in is gone. He sits down again on night <span className="num text-ink">{result.backOn + 1}</span>.
              </>
            ) : (
              'The buy-in is gone.'
            )}
          </p>
          <div className="mt-5 flex justify-center">
            <Link href="/story" className={GAME_DOCK_PRIMARY_BTN + " inline-flex items-center justify-center"}>
              Back to {cityName}
            </Link>
          </div>
        </>
      ),
    }),
    [onProgress, settle, result, cityName],
  )

  if (!table) return <div className="flex-1" aria-busy="true" />
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TableHostContext.Provider value={host}>
        <LiarsDiceTable table={table} onPlayAgain={noop} bots={BOTS} />
      </TableHostContext.Provider>
    </div>
  )
}
