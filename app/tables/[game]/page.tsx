'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TABLE_REGISTRY } from '@/lib/tables/registry'
import { isTableGame } from '@/lib/tables/catalog'
import { useHydrated } from '@/hooks/use-hydrated'
import { useTablesStore, type OpenTable } from '@/store/tables-store'

/**
 * One table. You only get here through the lobby's Sit down (which pays the
 * buy-in); a table already dealt on an earlier visit was left, so it is
 * forfeited and you go back to the lobby.
 */
export default function TableGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params)
  const router = useRouter()
  const hydrated = useHydrated()
  const [table, setTable] = useState<OpenTable | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!hydrated || started.current) return
    started.current = true
    const s = useTablesStore.getState()
    if (!isTableGame(game) || !s.open || s.open.game !== game) {
      router.replace('/tables/lobby')
      return
    }
    if (s.open.seated) {
      s.forfeit()
      router.replace('/tables/lobby')
      return
    }
    s.markSeated()
    setTable(useTablesStore.getState().open)
  }, [hydrated, game, router])

  function playAgain() {
    if (!table) return
    const s = useTablesStore.getState()
    if (!s.sitDown(table.game, table.tier, table.seats)) return
    s.markSeated()
    setTable(useTablesStore.getState().open)
  }

  if (!table) return <div className="flex-1" aria-busy="true" />
  const Table = TABLE_REGISTRY[table.game]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Table key={table.id} table={table} onPlayAgain={playAgain} />
    </div>
  )
}
