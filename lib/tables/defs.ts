import { createHoldem, holdemConfig, holdemEngine } from '@/games/holdem/engine'
import type { HoldemAction, HoldemState, HoldemView } from '@/games/holdem/types'
import { createLiars, liarsConfig, liarsEngine } from '@/games/liars-dice/engine'
import type { LiarsAction, LiarsState, LiarsView } from '@/games/liars-dice/types'
import { createShowdown, showdownConfig, showdownEngine } from '@/games/blackjack-showdown/engine'
import type { ShowdownAction, ShowdownState, ShowdownView } from '@/games/blackjack-showdown/types'
import { holdemPolicy } from '@/lib/bots/holdem'
import { liarsPolicy } from '@/lib/bots/liars-dice'
import { showdownPolicy } from '@/lib/bots/blackjack-showdown'
import type { BotPolicy } from '@/lib/bots/types'
import type { TableEngine } from './types'

/** One table game: its engine, its bot policy, and a fresh table for `seats` players. */
export interface TableDef<S, V, A> {
  engine: TableEngine<S, V, A>
  policy: BotPolicy<V, A>
  create: (seats: number) => S
}

export const holdemDef: TableDef<HoldemState, HoldemView, HoldemAction> = {
  engine: holdemEngine,
  policy: holdemPolicy,
  create: (seats) => createHoldem(holdemConfig(seats)),
}

export const liarsDef: TableDef<LiarsState, LiarsView, LiarsAction> = {
  engine: liarsEngine,
  policy: liarsPolicy,
  create: (seats) => createLiars(liarsConfig(seats)),
}

export const showdownDef: TableDef<ShowdownState, ShowdownView, ShowdownAction> = {
  engine: showdownEngine,
  policy: showdownPolicy,
  create: (seats) => createShowdown(showdownConfig(seats)),
}
