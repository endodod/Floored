import { createHoldem, holdemCashConfig, holdemCashOps, holdemConfig, holdemEngine } from '@/games/holdem/engine'
import type { HoldemAction, HoldemState, HoldemView } from '@/games/holdem/types'
import { createLiars, liarsConfig, liarsEngine } from '@/games/liars-dice/engine'
import { createLiarsCash, liarsCashEngine, liarsCashOps } from '@/games/liars-dice/cash'
import type { LiarsAction, LiarsState, LiarsView } from '@/games/liars-dice/types'
import { createShowdown, showdownCashConfig, showdownCashOps, showdownConfig, showdownEngine } from '@/games/blackjack-showdown/engine'
import type { ShowdownAction, ShowdownState, ShowdownView } from '@/games/blackjack-showdown/types'
import { holdemPolicy } from '@/lib/bots/holdem'
import { liarsPolicy } from '@/lib/bots/liars-dice'
import { showdownPolicy } from '@/lib/bots/blackjack-showdown'
import type { BotPolicy } from '@/lib/bots/types'
import type { CashStake, } from './stakes'
import type { CashTableOps, TableEngine } from './types'

/** One table game: its engine, its bot policy, and a fresh table for `seats` players. */
export interface TableDef<S, V, A> {
  engine: TableEngine<S, V, A>
  policy: BotPolicy<V, A>
  create: (seats: number) => S
}

export interface CashTableDef<S, V, A> extends TableDef<S, V, A> {
  ops: CashTableOps<S>
  createCash: (seats: number, stake: CashStake) => S
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

export const holdemCashDef: CashTableDef<HoldemState, HoldemView, HoldemAction> = {
  ...holdemDef,
  ops: holdemCashOps,
  createCash: (seats, stake) => createHoldem(holdemCashConfig(seats, stake.limits.blinds ?? [5, 10])),
}

export const showdownCashDef: CashTableDef<ShowdownState, ShowdownView, ShowdownAction> = {
  ...showdownDef,
  ops: showdownCashOps,
  createCash: (seats, stake) => createShowdown(showdownCashConfig(seats, stake.limits.bets?.[0] ?? 10, stake.limits.bets?.[1] ?? null)),
}

export const liarsCashDef: CashTableDef<import('@/games/liars-dice/cash').LiarsCashState, import('@/games/liars-dice/cash').LiarsCashView, LiarsAction> = {
  engine: liarsCashEngine,
  policy: liarsPolicy,
  create: (seats) => createLiarsCash(seats, 50),
  ops: liarsCashOps,
  createCash: (seats, stake) => createLiarsCash(seats, stake.limits.ante ?? 50),
}
