import type { ComponentType } from 'react'
import { BlackjackShowdownGame } from '@/components/games/blackjack-showdown/game'
import { LiarsDiceGame } from '@/components/games/liars-dice/game'
import { HoldemGame } from '@/components/games/holdem/game'
import type { TableGameName } from './types'

export const TABLE_GAME_REGISTRY: Record<TableGameName, ComponentType> = {
  'blackjack-showdown': BlackjackShowdownGame,
  'liars-dice': LiarsDiceGame,
  holdem: HoldemGame,
}
