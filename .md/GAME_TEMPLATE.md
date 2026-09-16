FLOORED — GAME COMPONENT TEMPLATE
===================================
Reference: components/blackjack-game.tsx (primary), components/roulette-game.tsx, components/dragon-tower-game.tsx

This document describes the exact conventions used for all table-game components in this project.
Copy this template when building a new game.


────────────────────────────────────────────
1. FILE STRUCTURE
────────────────────────────────────────────

games/<game-name>/types.ts      — TypeScript types and interfaces
games/<game-name>/engine.ts     — Pure game logic (no React, no side effects)
components/<game-name>-game.tsx — React component
app/freeplay/<game-name>/page.tsx
app/survival/<game-name>/page.tsx  (if applicable)


────────────────────────────────────────────
2. PAGE ROUTE (app/freeplay/<game>/page.tsx)
────────────────────────────────────────────

'use client'

import { <GameName>Game } from '@/components/<game-name>-game'
import { BankruptModal } from '@/components/bankrupt-modal'
import { useFreeplayStore } from '@/store/freeplay-store'

export default function Freeplay<GameName>Page() {
  const bankroll    = useFreeplayStore((s) => s.bankroll)
  const setBankroll = useFreeplayStore((s) => s.setBankroll)
  const bust        = useFreeplayStore((s) => s.bust)
  const markBust    = useFreeplayStore((s) => s.markBust)
  const reset       = useFreeplayStore((s) => s.reset)

  function handleResolve(result: { outcome: 'win'|'loss'; betAmount: number; payout: number; multiplier: number }) {
    const newB = bankroll - result.betAmount + result.payout
    setBankroll(newB)
    if (newB <= 10) markBust()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {bust && <BankruptModal onReset={reset} />}
      <GameNameGame mode="freeplay" bankroll={Math.max(0, bankroll)} onResolve={handleResolve} />
    </div>
  )
}

Survival variant: swap useFreeplayStore → useSurvivalStore, use recordResultPayout and deductBet.


────────────────────────────────────────────
3. LOBBY REGISTRATION (components/lobby.tsx)
────────────────────────────────────────────

Add an entry to the GAMES array:
{
  name: '<game-name>',          // must match GameName in store/types.ts and the route slug
  label: 'Display Name',
  sub: 'One-line description',
  symbol: '🎯',                 // single emoji
  availableFreeplay: true,
  availableSurvival: false,     // true only if survival mode is wired up
  gradient: 'from-<color>-950 to-<color>-900',
  accent: 'border-<color>-600 hover:border-<color>-500',
}

Also add the name to the GameName union type in store/types.ts.


────────────────────────────────────────────
4. COMPONENT PROPS CONTRACT
────────────────────────────────────────────

interface <GameName>Result {
  outcome: 'win' | 'loss'    // push is 'loss' unless explicitly supported
  betAmount: number
  payout: number             // total chips returned (0 on loss, bet×multiplier on win)
  multiplier: number         // payout / betAmount
}

interface <GameName>GameProps {
  mode: 'survival' | 'freeplay'
  bankroll: number           // current balance (read-only; component never writes it)
  onResolve: (result: <GameName>Result) => void
}


────────────────────────────────────────────
5. LAYOUT SKELETON
────────────────────────────────────────────

<div className={GAME_CARD_SHELL}>                         ← zinc-950 bg, rounded-2xl, shadow

  {/* Status bar */}
  <div className={GAME_STATUS_BAR}>                       ← black bg, border-b zinc-800
    <span className="text-sm font-semibold tracking-widest uppercase text-zinc-600">
      Game Name
    </span>
    <span className="text-sm text-zinc-600">{message}</span>
  </div>

  {/* Board area */}
  <GameFieldWithHistory
    className={GAME_BOARD_ARENA}                          ← flex-1, min-h-[min(360px,52vh)]
    boardClassName="relative flex min-h-0 flex-col items-center justify-center px-4 py-4 gap-4"
    entries={matchHistory}
    gameLabel="Game Name"
  >
    {/* Back button — only during betting stage */}
    {isBetting && (
      <button onClick={() => router.push(`/${mode}`)}
        className="absolute left-2 top-2 z-10 rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 shadow-lg text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-400 hover:text-white transition-colors">
        ← Back
      </button>
    )}

    {/* Active bet badge — during in-progress / play stage */}
    {isPlaying && betAmount > 0 && (
      <div className="absolute left-2 top-2 z-10 select-none pointer-events-none rounded-xl border border-zinc-800/90 bg-zinc-950/95 px-3 py-2 shadow-lg">
        <p className="text-[9px] uppercase tracking-wider text-zinc-600">Bet</p>
        <p className="text-sm font-bold text-white tabular-nums">{formatChips(betAmount)}</p>
      </div>
    )}

    {/* ── GAME BOARD CONTENT HERE ── */}
    {/* Board stack: fixed-height slots (stats, selectors, playfield, hints).
        Never mount/unmount rows that change height — use invisible + fixed h-*.
        Anchor with justify-start on the arena so the playfield does not re-center. */}

  </GameFieldWithHistory>

  {/* Control zone */}
  <div className={GAME_CONTROL_DOCK_M}>                   ← shrink-0, fixed min-height, zinc-900 bg
    ...
  </div>

</div>


────────────────────────────────────────────
6. BOARD ARENA LAYOUT STABILITY
────────────────────────────────────────────

CRITICAL RULE: Game components in the board arena must NOT move between betting / playing /
settled. The playfield (grid, wheel, track, etc.) must stay at the same pixel position every phase.

- Wrap board content in a fixed stack: stats row, option selectors (e.g. difficulty), playfield,
  hint row — each with explicit height (h-10, h-9, min-h-10) always in the DOM.
- Hide phase-specific rows with `invisible pointer-events-none`, not conditional render.
- Swap hint text inside a fixed min-height slot; use `\u00A0` when empty.
- Use `justify-start` (not `justify-center`) on boardClassName so flex centering does not
  re-position the stack when total height is constant.
- Reference: `components/mines-game.tsx` board stack.

────────────────────────────────────────────
7. CONTROL ZONE LAYOUT
────────────────────────────────────────────

CRITICAL RULE: Never use conditional rendering for layout-affecting elements in the control
zone. All phase transitions must be invisible/content-swap only — no DOM nodes entering or
leaving that have height. Violating this causes the board area to shift up/down between phases.

Three fixed DOM rows inside GAME_CONTROL_DOCK_M > div.flex.min-h-[188px].flex-col.justify-between.py-3:

Use `justify-between` on the inner dock wrapper so the betting controls are distributed evenly
inside the fixed-height dock, and so the start/action/next button remains at the same vertical
position across betting, playing, and settled states.

  ROW 1 — Chip strip (always in DOM, hidden outside betting via `invisible pointer-events-none`):

    <div className={`flex flex-nowrap justify-center gap-2 ${!isBetting ? 'invisible pointer-events-none' : ''}`}>
      {CHIPS.map(...)}
      <button>½</button>
      <button>All In</button>
    </div>

  ROW 2 — Info strip (fixed h-10, swaps content per phase with conditional rendering inside):

    <div className="h-10 flex items-center justify-center">
      {isBetting && <div>Bet  $X  [Clear]</div>}
      {isPlaying  && <p>…playing hint or current value…</p>}
      {isSettled  && <div>Win/No win label + payout amount</div>}
    </div>

    Payout amount: text-2xl font-black — text-emerald-400 (win) / text-red-400 (loss)
    Outcome label: text-xs uppercase tracking-widest text-zinc-500

  ROW 3 — Single adaptive action button (always in DOM, same position every phase):

    <div className="flex justify-center">
      <button
        onClick={isSettled ? handleNext : isPlaying ? handleAction : handleStart}
        disabled={(isBetting && !canStart) || (isPlaying && actionDisabled)}
        className={[
          'min-w-[10.5rem] px-7 py-2 font-bold rounded-lg transition-colors text-base shadow-lg',
          specialColorCondition
            ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white'
            : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-900',
        ].join(' ')}
      >
        {isSettled ? 'Next →' : isPlaying ? 'Action →' : 'Start →'}
      </button>
    </div>

  ROW 4 (optional) — Min-bet hint, only shown during betting:

    {minBet > 1 && isBetting && (
      <p className="text-center text-zinc-600 text-sm">Min bet: {formatChips(minBet)}</p>
    )}

    This row is genuinely optional content — it only ever appears during betting so it cannot
    cause cross-phase layout shifts. Safe to conditionally render.

Reference implementations: components/chicken-race-game.tsx, components/dragon-tower-game.tsx


────────────────────────────────────────────
7. CHIP CONSTANTS (copy verbatim)
────────────────────────────────────────────

const CHIPS = [
  { value: 10,  label: '$10',  cls: 'bg-blue-950 hover:bg-blue-900 border-blue-800 text-blue-300' },
  { value: 25,  label: '$25',  cls: 'bg-blue-900 hover:bg-blue-800 border-blue-700 text-blue-200' },
  { value: 100, label: '$100', cls: 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white' },
  { value: 500, label: '$500', cls: 'bg-blue-200 hover:bg-blue-100 border-blue-300 text-blue-900' },
]

Chip button: w-12 h-12 rounded-full border-2 font-bold text-sm shadow-lg
             transition-all duration-100 active:scale-90 hover:scale-105
             disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100


────────────────────────────────────────────
8. MATCH HISTORY
────────────────────────────────────────────

Each round that ends must push a MatchHistoryEntry when the player advances to the next round:

  setMatchHistory(h => [entry, ...h].slice(0, 80))

Entry shape:
  {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    at: new Date(),
    title: '+$200' | '−$100' | 'Push',   // net change, shown large
    subtitle: '$100 bet · Win · 2.00×',  // details, shown small
    tone: 'win' | 'loss' | 'push' | 'partial' | 'neutral',
  }

The GameFieldWithHistory component renders the last entry as an overlay button (top-right of board)
and opens a slide-out panel showing all history. Layout is never affected.


────────────────────────────────────────────
9. BET GUARD (required for every game)
────────────────────────────────────────────

import { useBetGuard } from '@/hooks/use-bet-guard'

  const { lock, unlock } = useBetGuard()

Prevents the player from committing more chips than they have by rapid-clicking
before React can re-render with the updated bankroll prop.

Rules:
  - Call lock() at the TOP of every bet handler, before any state changes.
    If lock() returns false a bet is already in flight — bail out immediately.
  - Call unlock() as the FIRST line of handleNext / handleNewRound so the
    guard resets the moment the round returns to the betting phase.

  function handleStart() {
    if (!canStart || !lock()) return   // ← lock guards the handler
    // ... place bet
  }

  function handleNext() {             // or handleNewRound
    unlock()                          // ← always first
    // ... reset to betting stage
  }

Never skip unlock() — if a game has multiple exit paths back to betting
(e.g. cash-out vs bust), add unlock() to each one.


────────────────────────────────────────────
10. AUTO-REBET
────────────────────────────────────────────

const { autoReBet } = useSettingsStore()

On handleNext / handleNewRound (after unlock()):
  if (autoReBet && lastBet > 0 && lastBet <= bankroll) {
    setCurrentBet(lastBet)
  }


────────────────────────────────────────────
11. COLOR PALETTE
────────────────────────────────────────────

Background:    zinc-950 (card), zinc-900 (control dock), black (status bar)
Borders:       zinc-800 (subtle), zinc-700 (medium), zinc-600 (interactive)
Text:          white (active values), zinc-200 (labels), zinc-500/600 (hints/captions)
Win:           emerald-400 (text), emerald-600/700 (bg)
Loss:          red-400 (text), red-800 (bg)
Push/Neutral:  zinc-300 (text)
Selection:     yellow-400 (highlight border/bg on selected tile or bet type)
Primary CTA:   bg-white text-zinc-900 hover:bg-zinc-100 (main action button)
Secondary CTA: bg-zinc-800 text-white hover:bg-zinc-700
Tertiary CTA:  bg-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-25

Active row / in-focus element accent: use the game's lobby color
  (e.g., fuchsia for Dragon Tower, slate for Chicken Race, emerald for Roulette)


────────────────────────────────────────────
12. GAME STATES CONVENTION
────────────────────────────────────────────

Every game has at minimum three stages:

  'betting'   → player sets bet amount, no board interaction
  '<action>'  → active play (climbing, racing, spinning, in-progress…)
  'settled'   → round is over, result shown, Next button available

Derived booleans (compute at render time, never store):
  const isBetting  = stage === 'betting'
  const isPlaying  = stage === '<action>'
  const isSettled  = stage === 'settled' (or any terminal stage)

The engine is a set of pure functions (init, start, action, settle).
All randomness lives in the engine. The component only dispatches engine calls and manages UI state.


────────────────────────────────────────────
13. DYNAMIC CLASS NAMES WARNING
────────────────────────────────────────────

Tailwind JIT only includes classes it can statically scan.
Do NOT build class names dynamically from data (e.g. `bg-${color}-500`).

For game-specific colors that come from data objects, use inline styles:
  style={{ backgroundColor: chicken.color }}   // hex value stored in engine data
  style={{ borderColor: chicken.color }}

Safe to use dynamic classes from within .tsx files (string concatenation with full class names).


────────────────────────────────────────────
14. CURSE MECHANIC (required for every game)
────────────────────────────────────────────

Every game engine MUST export a loseGame() function that rigs the outcome invisibly.
Every game component MUST wire it in via useCurse().

ENGINE (games/<game-name>/engine.ts):

  /**
   * Cursed outcome: forces a loss that looks like natural bad luck.
   * Called instead of the normal action function when the player is cursed.
   */
  export function loseGame(/* same params as the normal action fn */): <GameName>State {
    // Pick a losing outcome from the same pool the normal function uses.
    // Always return a settled loss — never a win or push.
  }

  Rules:
  - Use the same state shape and message format as a real loss.
  - Never return 'win' or 'push' as outcome.
  - If multiple action phases exist (e.g. riding/streak), add a loseGame variant per phase.
  - Fallback to the normal function only if no losing outcome exists in the remaining pool
    (edge case guard — should be nearly unreachable in practice).

COMPONENT (components/<game-name>-game.tsx):

  import { useCurse } from '@/hooks/use-curse'
  import { loseGame, ... } from '@/games/<game-name>/engine'

  const { cursed } = useCurse()

  // In the action handler, swap in loseGame when cursed:
  const next = cursed ? loseGame(...) : normalAction(...)

  The swap must be invisible to the player — same animation, same message style, same timing.


────────────────────────────────────────────
15. BLESS MECHANIC (required for every game)
────────────────────────────────────────────

Every game engine MUST export a winGame() function that rigs the outcome to a win.
Every game component MUST wire it in via useBless().

Priority order in every action handler: blessed → cursed → normal.
Blessed overrides curse — if both are active, the player wins.

ENGINE (games/<game-name>/engine.ts):

  /**
   * Blessed outcome: forces a win that looks like natural good luck.
   * Called instead of the normal action function when the player is blessed.
   */
  export function winGame(/* same params as the normal action fn */): <GameName>State {
    // Pick a winning outcome from the same pool the normal function uses.
    // Always return a win — never a loss or push.
  }

  Rules:
  - Use the same state shape and message format as a real win.
  - Never return 'loss' or 'push' as outcome.
  - Give variety — do NOT hardcode the minimum win every time. Use weighted randomness
    so rarer/better outcomes still appear (e.g. slots: spin one weighted reel symbol for
    all three reels; blackjack: deal from A/7/8/9/10 as first card so totals vary 17–BJ).
  - Respect any held/selected state the player already set before the action (e.g. poker:
    keep held cards, fill non-held slots to match the most-common held rank; do NOT replace
    the entire hand ignoring what the player held).
  - Player skill can still matter: if the player makes a clearly bad move (e.g. holds nothing
    in poker), the blessed draw is still favoured but not guaranteed to win.
  - If multiple action phases exist (e.g. riding/streak), add a winGame variant per phase.
  - For games with a manual cash-out and a visual settlement board (e.g. mines): also export
    a blessedCashOut variant that correctly populates the settled board to match game rules
    (correct mine count for the chosen difficulty, distributed randomly among unrevealed tiles).

COMPONENT (components/<game-name>-game.tsx):

  import { useBless } from '@/hooks/use-bless'
  import { winGame, ... } from '@/games/<game-name>/engine'

  const { blessed } = useBless()

  // In the action handler, priority: blessed → cursed → normal:
  const next = blessed ? winGame(...) : cursed ? loseGame(...) : normalAction(...)

  The swap must be invisible to the player — same animation, same message style, same timing.
