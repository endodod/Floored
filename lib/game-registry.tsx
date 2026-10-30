import type { GameMode } from '@/store/types'
import type { ComponentType } from 'react'
import type { GameName } from '@/store/types'
import { BlackjackGame } from '@/components/games/blackjack/game'
import { CrashGame } from '@/components/games/crash/game'
import { PlinkoGame } from '@/components/games/plinko/game'
import { OverUnderGame } from '@/components/games/over-under/game'
import { WheelGame } from '@/components/games/wheel/game'
import { RunDiceGame } from '@/components/games/run-dice/game'
import { MinesGame } from '@/components/games/mines/game'
import { ChickenGame } from '@/components/games/chicken-road/game'
import { SlotsGame } from '@/components/games/slots/game'
import { RouletteGame } from '@/components/games/roulette/game'
import { DragonTowerGame } from '@/components/games/dragon-tower/game'
import { ChickenRaceGame } from '@/components/games/chicken-race/game'
import { StreetCupsGame } from '@/components/games/street-cups/game'
import { CaseBattlesGame } from '@/components/games/case-battles/game'
import { Poker1pGame } from '@/components/games/poker-1p/game'
import { HiLoGame } from '@/components/games/hilo/game'
import { KenoGame } from '@/components/games/keno/game'
import { CoinFlipGame } from '@/components/games/coin-flip/game'
import { DeckCountdownGame } from '@/components/games/deck-countdown/game'
import { TowerOfCardsGame } from '@/components/games/tower-of-cards/game'
import { BaccaratGame } from '@/components/games/baccarat/game'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGameComponent = ComponentType<{
  mode: GameMode
  bankroll: number
  onBet?: (amount: number) => void
  onResolve: (result: any) => any
}>

export const GAME_REGISTRY: Record<GameName, AnyGameComponent> = {
  'blackjack':    BlackjackGame,
  'crash':        CrashGame,
  'plinko':       PlinkoGame,
  'over-under':   OverUnderGame,
  'wheel':        WheelGame,
  'run-dice':     RunDiceGame,
  'mines':        MinesGame,
  'chicken-road': ChickenGame,
  'slots':        SlotsGame,
  'roulette':     RouletteGame,
  'dragon-tower': DragonTowerGame,
  'chicken-race': ChickenRaceGame,
  'street-cups':  StreetCupsGame,
  'case-battles': CaseBattlesGame,
  'poker-1p':     Poker1pGame,
  'hilo':         HiLoGame,
  'keno':         KenoGame,
  'coin-flip':    CoinFlipGame,
  'deck-countdown': DeckCountdownGame,
  'tower-of-cards': TowerOfCardsGame,
  baccarat: BaccaratGame,
}

export const GAME_NAMES = Object.keys(GAME_REGISTRY) as GameName[]
