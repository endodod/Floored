import type { GameName } from '@/store/types'

export interface GameEntry {
  name: GameName
  label: string
  sub: string
  symbol: string
  /** Shown on /freeplay — game list */
  availableFreeplay: boolean
  /** Shown on /survival lobby */
  availableSurvival: boolean
  gradient: string
  accent: string
}

export const GAMES: GameEntry[] = [
  {
    // pos 1 — Crimson
    name: 'blackjack',
    label: 'Blackjack',
    sub: 'Beat the dealer',
    symbol: '♠',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-red-950 to-red-900',
    accent: 'border-red-600 hover:border-red-500',
  },
  {
    // pos 2 — Teal
    name: 'crash',
    label: 'Crash',
    sub: 'Cash out before the crash',
    symbol: '🚀',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-teal-950 to-teal-900',
    accent: 'border-teal-600 hover:border-teal-500',
  },
  {
    // pos 3 — Amber
    name: 'plinko',
    label: 'Plinko',
    sub: 'Drop balls down the board',
    symbol: '⚪',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-amber-950 to-amber-900',
    accent: 'border-amber-600 hover:border-amber-500',
  },
  {
    // pos 4 — Indigo
    name: 'over-under',
    label: 'Over-Under',
    sub: 'Stay inside your safe zone',
    symbol: '⇅',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-indigo-950 to-indigo-900',
    accent: 'border-indigo-600 hover:border-indigo-500',
  },
  {
    // pos 5 — Lime
    name: 'wheel',
    label: 'Fortune Wheel',
    sub: 'Pick a color and spin',
    symbol: '◎',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-lime-950 to-lime-900',
    accent: 'border-lime-600 hover:border-lime-500',
  },
  {
    // pos 6 — Violet
    name: 'run-dice',
    label: 'Run Dice',
    sub: 'Roll dice up the meter',
    symbol: '⚅',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-violet-950 to-violet-900',
    accent: 'border-violet-600 hover:border-violet-500',
  },
  {
    // pos 7 — Coral
    name: 'mines',
    label: 'Mines',
    sub: 'Find the safe tiles',
    symbol: '💣',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-orange-950 to-orange-900',
    accent: 'border-orange-500 hover:border-orange-400',
  },
  {
    // pos 8 — Sky
    name: 'chicken-road',
    label: 'Chicken Road',
    sub: 'Cross the road safely',
    symbol: '🐔',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-sky-950 to-sky-900',
    accent: 'border-sky-600 hover:border-sky-500',
  },
  {
    // pos 9 — Rose
    name: 'slots',
    label: 'Slots',
    sub: 'Spin the reels for payouts',
    symbol: '🎰',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-rose-950 to-rose-900',
    accent: 'border-rose-600 hover:border-rose-500',
  },
  {
    // pos 10 — Emerald
    name: 'roulette',
    label: 'Roulette',
    sub: 'Bet on the wheel and spin',
    symbol: '🎡',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-emerald-950 to-emerald-900',
    accent: 'border-emerald-600 hover:border-emerald-500',
  },
  {
    // pos 11 — Fuchsia
    name: 'dragon-tower',
    label: 'Dragon Tower',
    sub: 'Climb as high as you dare',
    symbol: '🐉',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-fuchsia-950 to-fuchsia-900',
    accent: 'border-fuchsia-700 hover:border-fuchsia-600',
  },
  {
    // pos 12 — Slate
    name: 'chicken-race',
    label: 'Chicken Race',
    sub: 'Pick the winning chicken',
    symbol: '🏁',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-slate-950 to-slate-900',
    accent: 'border-slate-500 hover:border-slate-400',
  },
  {
    // pos 13 — Stone
    name: 'street-cups',
    label: 'Street Cups',
    sub: 'Find the cup with the crown',
    symbol: '👑',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-stone-950 to-stone-800',
    accent: 'border-stone-500 hover:border-stone-400',
  },
  {
    // pos 14 — Cyan
    name: 'case-battles',
    label: 'Case Battles',
    sub: 'Open cases and beat rivals',
    symbol: '🎁',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-cyan-950 to-cyan-900',
    accent: 'border-cyan-600 hover:border-cyan-500',
  },
  {
    // pos 15 — Green
    name: 'poker-1p',
    label: '1 Player Poker',
    sub: 'Build the best poker hand',
    symbol: '🃏',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-green-950 to-green-900',
    accent: 'border-green-600 hover:border-green-500',
  },
  {
    // pos 16 — Purple
    name: 'hilo',
    label: 'HiLo',
    sub: 'Guess higher or lower each card',
    symbol: '↕',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-purple-950 to-purple-900',
    accent: 'border-purple-600 hover:border-purple-500',
  },
  {
    // pos 17 — Pink (between purple HiLo and stone Street Cups; avoids cyan above)
    name: 'keno',
    label: 'Keno',
    sub: 'Match numbers to the draw',
    symbol: '🎱',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-pink-950 to-pink-900',
    accent: 'border-pink-600 hover:border-pink-500',
  },
  {
    // pos 18 — Gold
    name: 'coin-flip',
    label: 'Coin Flip',
    sub: 'Call heads or tails on a flip',
    symbol: '🪙',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-yellow-950 to-yellow-900',
    accent: 'border-yellow-600 hover:border-yellow-500',
  },
  {
    // pos 19 — Deck Countdown
    name: 'deck-countdown',
    label: 'Deck Countdown',
    sub: 'Flip until a rank repeats',
    symbol: '⏳',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-gray-950 to-gray-900',
    accent: 'border-gray-600 hover:border-gray-500',
  },
  {
    // pos 20 — Tower of Cards
    name: 'tower-of-cards',
    label: 'Tower of Cards',
    sub: 'Four calls, cash out between them',
    symbol: '🏯',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-neutral-950 to-neutral-900',
    accent: 'border-neutral-600 hover:border-neutral-500',
  },
  {
    // pos 21 — Baccarat
    name: 'baccarat',
    label: 'Baccarat',
    sub: 'Player, Banker or Tie',
    symbol: '🎴',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-zinc-950 to-zinc-900',
    accent: 'border-zinc-600 hover:border-zinc-500',
  },
  {
    // pos 22 — Sic Bo
    name: 'sic-bo',
    label: 'Sic Bo',
    sub: 'Bet on three dice',
    symbol: '🎲',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-blue-950 to-blue-900',
    accent: 'border-blue-600 hover:border-blue-500',
  },
  {
    // pos 23 — Andar Bahar
    name: 'andar-bahar',
    label: 'Andar Bahar',
    sub: 'Find the matching pile',
    symbol: '🃏',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-red-950 to-red-900',
    accent: 'border-red-600 hover:border-red-500',
  },
  {
    // pos 24 — Dragon Tiger
    name: 'dragon-tiger',
    label: 'Dragon Tiger',
    sub: 'Pick the higher card',
    symbol: '🐯',
    availableFreeplay: true,
    availableSurvival: true,
    gradient: 'from-emerald-950 to-emerald-900',
    accent: 'border-emerald-600 hover:border-emerald-500',
  },
]

export const GAME_BY_NAME = new Map(GAMES.map((g) => [g.name, g]))
