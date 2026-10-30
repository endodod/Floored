'use client'

import { useMemo } from 'react'
import type { CashTableDef } from '@/lib/tables/defs'
import { cashStakeFor } from '@/lib/tables/stakes'
import { useTablesStore, type OpenTable } from '@/store/tables-store'

/**
 * The runner's `cash` options for a table, or undefined at a tournament. Your
 * chips stay synced to the store on every change, and leaving cashes out
 * exactly what you leave with.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useCashOptions<S>(table: OpenTable, def: CashTableDef<S, any, any>) {
  const syncCashStack = useTablesStore((s) => s.syncCashStack)
  return useMemo(() => {
    if (table.format !== 'cash') return undefined
    return {
      game: table.game,
      ops: def.ops,
      createCash: def.createCash,
      stake: cashStakeFor(table.game, table.stake ?? 'low'),
      stack: table.stack ?? 0,
      onStack: syncCashStack,
      onLeave: (stack: number) => {
        const s = useTablesStore.getState()
        s.syncCashStack(stack, s.open?.hands ?? 0)
        s.cashOut()
      },
    }
    // The table's opening stack is read once, when the runner seats you.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.id, def, syncCashStack])
}
