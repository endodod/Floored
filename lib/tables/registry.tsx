import type { ComponentType } from 'react'
import { HoldemTable } from '@/components/tables/holdem-table'
import { LiarsDiceTable } from '@/components/tables/liars-dice-table'
import { ShowdownTable } from '@/components/tables/blackjack-showdown-table'
import type { OpenTable } from '@/store/tables-store'
import type { TableGameName } from './types'

/** The table components — the Tables mode's own registry, apart from GAME_REGISTRY. */
export const TABLE_REGISTRY: Record<TableGameName, ComponentType<{ table: OpenTable; onPlayAgain: () => void }>> = {
  holdem: HoldemTable,
  'liars-dice': LiarsDiceTable,
  'blackjack-showdown': ShowdownTable,
}
