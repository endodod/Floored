'use client'

import type { OpenTable } from '@/store/tables-store'

/** Placeholder until the Blackjack Showdown board is built (work in progress). */
export function ShowdownTable(_: { table: OpenTable; onPlayAgain: () => void }) {
  return <p className="p-6 text-[13px] text-dim">Blackjack Showdown table: not built yet.</p>
}
