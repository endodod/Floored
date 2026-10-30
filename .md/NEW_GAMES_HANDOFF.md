# New games — handoff

Status as of 2026-10-30: **designed and owner-approved, nothing built.** Four new house games for Freeplay,
Daily, Ladder and Survival (not Tables):

| ID | Label | Kind | Closest existing game to copy from |
|---|---|---|---|
| `sic-bo` | Sic Bo | Three dice, chips on a mat, one roll | Roulette (chip rack, chips on the mat), Run Dice (dice) |
| `tower-of-cards` | Tower of Cards | Four card questions, cash out between them | HiLo (card climb, cash out / go on) |
| `deck-countdown` | Deck Countdown | Flip cards until a rank repeats, cash out any time | HiLo / Dragon Tower (fixed multiplier ladder) |
| `baccarat` | Baccarat | Player / Banker / Tie, fixed drawing rules | Roulette (chips on the mat), Blackjack (two dealt hands) |

This file says exactly what to build. Everything not stated here follows
[ARCHITECTURE.md](ARCHITECTURE.md) and [GAME_REDESIGN_HANDOFF.md](GAME_REDESIGN_HANDOFF.md);
read both first (the redesign doc's **Lessons from Phase 0**, **Short screens** and
**Motion** sections apply to every board below).

All numbers in this file were checked by exact enumeration or dynamic programming
(Python sketches in `scripts/new-games/`, see section 9). If you change a number, re-run the
check and update this file, the engine, `lib/game-tutorials.ts` and `BALANCE_AUDIT.md`
together.

---

## 0. Before you start

1. **Base branch.** Work on top of `claude/new-games-handoff` (this branch), or `main`
   once it is merged. It already contains the ¼ / ½ / All in pills for the chip rack
   (`GameDockChipPicker`'s `fraction` / `onSelectFraction` props and
   `stakeForFraction()`), which Sic Bo and Baccarat use.
2. **One game per session, one commit per game.** Order: **Deck Countdown → Tower of
   Cards → Baccarat → Sic Bo** (cheapest first; the two chip-on-mat games come last
   because Baccarat extracts the shared chip layer that Sic Bo then reuses).
3. **The shared wiring (section 1) is the same for all four.** Do it per game as part
   of that game's commit, not all at once. A `GameName` without an entry in every
   `Record<GameName, …>` fails `tsc`, so add the name and its entries together.
4. **Every owner question is answered** (section 7). Nothing is waiting on the owner.
5. **Survival floor selection (section 6.1)** changes with the first game's commit,
   because that commit grows the pool past 18.

---

## 1. Wiring every new game needs (checklist)

Do every line for each game. File paths are from the repo root.

| # | File | What to add |
|---|---|---|
| 1 | `games/<id>/types.ts`, `games/<id>/engine.ts` | Pure engine (section 2–5 of this file). No React, no `Math.random` outside the engine. |
| 2 | `store/types.ts` | `'<id>'` in `GameName`. |
| 3 | `lib/game-catalog.ts` | A `GAMES[]` entry at the end (pos 19–22). Fields in the table below. |
| 4 | `lib/ladder/rules.ts` | `GAME_MAX_MULT['<id>']` (values below). `LADDER_RUNGS` stays 18 (section 7, decision 1): in the first game's commit, change its comment to "18 rungs, one game each; with more games than rungs, some are left over each climb". |
| 5 | `components/games/<id>/game.tsx` | The component, exported as `<Pascal>Game`, same props as every game: `{ mode, bankroll, onBet?, onResolve }`. |
| 6 | `lib/game-registry.tsx` | Import it and add it to `GAME_REGISTRY`. |
| 7 | `lib/game-tutorials.ts` | `GAME_TUTORIALS['<id>']` (text below; keep the figures equal to the engine). |
| 8 | `lib/survival/balance.ts` | `'<id>'` in `SURVIVAL_GAME_POOL`. |
| 9 | `lib/survival/upgrades-catalog.ts` | `GAME_BOOST_LABELS['<id>']` and `GAME_PERK_DEFS['<id>']` (section 6). |
| 10 | `lib/survival/perk-proc.ts` | The perk's `effectKey` in `PROC_PERK_BASE_CHANCES` at `0.30` (all four perks are proc perks). |
| 11 | `hooks/use-survival-perks.ts` | Two fields: `<camel>: hasGamePerk(…, '<effectKey>')` and `<camel>Level: perkLevel('<effectKey>')`, next to the others. |
| 12 | `lib/survival/missions.ts` | Add the id to `HIGH_VARIANCE_GAME_IDS` or `LOW_VARIANCE_GAME_IDS` (below). |
| 13 | `app/globals.css` | The game's `@container board` block (`<prefix>-*` classes) and any new animation classes, each added to the `:root[data-motion='reduced']` block. |
| 14 | Docs | `README.md` game list; `.md/BALANCE_AUDIT.md` §1 pool size, §4 a `### <id>` entry in the existing format, §5 the perk table row and the "18 × 5 levels" counts, §7 rewritten for the new floor selection (section 6.1); `.md/ARCHITECTURE.md` "all 18 game components" / "the 18 tables" wording; `CLAUDE.md` "18 games"; tick this file's status table (section 8). |

Catalog entries (`symbol` is a text glyph, no emoji; `gradient` / `accent` are not
rendered anywhere today but are required fields, so use unused palette names):

| id | label | sub | symbol | gradient | accent |
|---|---|---|---|---|---|
| `sic-bo` | Sic Bo | Bet on three dice | `⚄` | `from-blue-950 to-blue-900` | `border-blue-600 hover:border-blue-500` |
| `tower-of-cards` | Tower of Cards | Four calls, cash out between them | `▲` | `from-neutral-950 to-neutral-900` | `border-neutral-600 hover:border-neutral-500` |
| `deck-countdown` | Deck Countdown | Flip until a rank repeats | `♠` | `from-gray-950 to-gray-900` | `border-gray-600 hover:border-gray-500` |
| `baccarat` | Baccarat | Player, Banker or Tie | `♣` | `from-zinc-950 to-zinc-900` | `border-zinc-600 hover:border-zinc-500` |

All four: `availableFreeplay: true`, `availableSurvival: true`.

`GAME_MAX_MULT`: `sic-bo: 70`, `tower-of-cards: 756.92` (re-check with the script),
`deck-countdown: 9178.56` (no cap, section 7 decision 3), `baccarat: 12`.

Mission variance lists: `sic-bo` → LOW (Small/Big are near coin flips), `baccarat` → LOW,
`tower-of-cards` → HIGH, `deck-countdown` → HIGH.

### Component skeleton every game follows

Copy the structure of `components/games/hilo/game.tsx` (cash-out games) or
`components/games/roulette/game.tsx` (chip-on-mat games). These must all be present:

- Shell: `GAME_CARD_SHELL` › `GAME_STATUS_BAR` (label left, `round.message` right) ›
  `GameFieldWithHistory` (`className={GAME_BOARD_ARENA}`, `entries`, `gameLabel`) ›
  board wrapper › `GAME_CONTROL_DOCK_M` › `GAME_DOCK_INNER`.
- Top-left badges: `GameDockBackButton` (visible while betting and not game over) and
  `GameActiveBetBadge` (during a round). Keep the top ~4rem of the board free for them.
- Hooks: `useGameMinBet(mode)`, `useBetGuard()` (`lock()` on start, `unlock()` on
  Next), `useRunEnd(mode, { idle })`, `useCurse()`, `useBless()`, `useSurvivalPerks(id)`,
  `usePerkProc(owned, effectKey, level)`, `useSettingsStore().autoReBet`, and for
  single-stake games `useLadderAllIn(mode, bankroll, currentBet, setCurrentBet)`.
- Result: `resolveGame(onResolve, { outcome, betAmount, payout, multiplier })` exactly
  once per round at settle, then `buildPendingResult(...)` into `pendingResult`; push it
  into `matchHistory` on Next (`.slice(0, 80)`). Survival: call `survivalAfterNext(mode)`
  in Next and return early when it says so.
- Dock rows: chips (`GameDockChipRow` or `GameDockChipPicker`), `GAME_DOCK_SETTLED_SLOT`
  (`GameDockBetRow` / a live line / `GameDockSettledRow`), `GAME_DOCK_ACTIONS`
  (`GAME_DOCK_PRIMARY_BTN`, `GameDockSettledActions`, `GameDockGameOverButton`).
  While a round plays, the chip row shows the quote (`showQuote`, `pickQuote`).
- Dev outcomes: blessed → engine `win…` function, cursed → engine `lose…` function.
  They never apply in Daily or Ladder (the hooks already handle that).
- Layout stability: nothing moves between betting, playing and settled. Keep elements
  mounted and hide them with `invisible pointer-events-none`.
- Colours only from tokens (`felt` win/selected, `loss` lost, `gold` money/premium);
  figures get `num`; money through `formatChips`, multipliers through `formatMultiplier`.
- Fit every board size with no scroll; check with the design-check scripts (section 9).

---

## 2. Deck Countdown (`deck-countdown`)

### Rules

One shuffled 52-card deck per round. Cards are flipped one at a time from the top.
**A card whose rank has already been flipped this round busts the round.** The 13 ranks
are the countdown: every new rank lights one of 13 slots on the board.

- Start: the player places a bet and presses **Deal**. The first card is flipped
  automatically (it can never bust). Multiplier shows `1.00×`; **Cash out is not offered
  yet** (cashing out at 1.00× would be a free push).
- Then the player presses **Flip** for each next card. After every safe flip from the
  second on, they may **Cash out** at the current multiplier or **Flip** again.
- A repeated rank: the round is lost. The busting card is shown next to the lit slot of
  its rank.
- After the 13th distinct rank the round cashes out automatically at the top multiplier.

Suits do not matter. Ace is just one of the 13 ranks.

> This is a deliberate change from the first pitch ("face cards multiply, 2–5 bust").
> That version does not work: with any pay scale, the best play is to flip once and
> stop, or the game pays more than it takes. The repeated-rank rule keeps the idea
> (the deck thins, the odds you see get worse, you choose when to stop) and has an
> exact, fair-looking pay table.

### The odds are fixed, so the pay table is fixed

After `k − 1` distinct ranks have been flipped, `53 − k` cards remain, and exactly
`3 × (k − 1)` of them bust (the three unseen suits of each seen rank). So the bust
chance of flip `k` does not depend on which ranks came up:

`pSafe(k) = (56 − 4k) / (53 − k)`

Multiplier after a safe flip `n` (n ≥ 2), with a 3% edge applied once:

`mult(n) = floor2( 0.97 × Π_{k=2..n} (53 − k) / (56 − 4k) )`  (floor2 = round down to 2 decimals)

Put the table in the engine as a constant computed by this formula, and a test that it
matches these values:

| Flip | Cards left | Bust cards | Bust chance | Multiplier after a safe flip |
|---|---|---|---|---|
| 1 | 52 | 0 | 0% | — (1.00×, no cash out) |
| 2 | 51 | 3 | 5.9% | 1.03× |
| 3 | 50 | 6 | 12.0% | 1.17× |
| 4 | 49 | 9 | 18.4% | 1.43× |
| 5 | 48 | 12 | 25.0% | 1.91× |
| 6 | 47 | 15 | 31.9% | 2.80× |
| 7 | 46 | 18 | 39.1% | 4.61× |
| 8 | 45 | 21 | 46.7% | 8.65× |
| 9 | 44 | 24 | 54.5% | 19.03× |
| 10 | 43 | 27 | 62.8% | 51.16× |
| 11 | 42 | 30 | 71.4% | 179.09× |
| 12 | 41 | 33 | 80.5% | 917.85× |
| 13 | 40 | 36 | 90.0% | 9178.56× (top prize, no cap) |

RTP: **97%** for any stopping point (less the rounding). Payout =
`Math.round(bet × multiplier)` (as HiLo). Worst case −1× bet.

### Engine (`games/deck-countdown/`)

```ts
// types.ts
import type { HiLoCard } from '@/games/hilo/types' // reuse the card type: { suit, rank, value }
export type DeckCountdownStage = 'betting' | 'playing' | 'settled'
export interface DeckCountdownState {
  stage: DeckCountdownStage
  deck: HiLoCard[]            // the rest of the shuffled deck, top first
  flipped: HiLoCard[]         // safe cards in order
  bustCard: HiLoCard | null
  betAmount: number
  multiplier: number          // current cash-out multiplier (1 before flip 2)
  outcome: 'win' | 'loss' | null
  message: string
}
```

Functions:
- `DECK_COUNTDOWN_MULTS: number[]` — index = number of safe flips (`[0, 1, 1.03, 1.17, …]`).
- `initDeckCountdown()`, `startDeckCountdown(bet)` (shuffles, flips card 1).
- `flipDeckCountdown(state)` — pops the top card; repeat rank → `settled` / `loss`;
  13th distinct rank → `settled` / `win` at the top multiplier.
- `cashOutDeckCountdown(state)` — only when `flipped.length >= 2`.
- `bustChance(state)` — `(3 × flipped.length) / deck.length`, for the board.
- Dev: `winFlip(state)` moves a safe card (unseen rank) to the top, then flips;
  `loseFlip(state)` moves a busting card to the top, then flips. If no such card exists,
  fall back to `flipDeckCountdown`.

### Board

A row of **13 rank slots** (2 … 10, J, Q, K, A) printed on the felt, with the deck and
the last flipped card above it.

- Top band: on the left the face-down deck (`PlayingCard variant="back"` with a
  `.plaque` count "40 left"), on the right the last flipped card (`PlayingCard`, new card
  `g-deal` then `g-flip`).
- Middle: the 13 slots, each a small `.plaque` with the rank in `felt-print`. A seen
  rank lights felt with the flipped card's suit glyph (`<Suit index={…} />` from `components/ui/terminal.tsx`, index order ♠ ♥ ♦ ♣) and `g-pop`. The bust card's slot turns
  `loss` and the board `g-shake`s.
- Under the slots: two figures on `.plaque` panels: **Next flip busts** `xx%`
  (`bustChance`, `num`) and **Next flip pays** `xx×` (gold-print). They update live and
  are the reason this game is interesting; never hide them.
- On boards under ~360px wide the 13 slots go to two rows (7 + 6).
- Short wide boards (`@container board (max-height: 300px) and (min-aspect-ratio: 2/1)`):
  cards left, slots and figures right.
- Prefix `dcd-*`. Card size: `--card-h: clamp(3.5rem, calc(100cqh - 15rem), 7.5rem)`;
  tune with the check scripts.

### Dock

- Betting: `GameDockChipRow` (with ¼, ½, All in), `GameDockBetRow`, **Deal →**.
- Playing: board buttons, as HiLo does: **Flip** (gold outline, shows the next
  multiplier) and **Cash out** with the amount (`GAME_DOCK_PRIMARY_BTN`); Cash out is
  `invisible` until flip 2. Settled slot: "Cash out now for `amount`".
- Settled: `GameDockSettledRow`; result text "`n` ranks" on a win, "Repeat `rank`" on a
  loss. History subtitle: `formatBetSummary(bet)` → "`n` ranks · `mult`" or "Bust on `rank`".

### Timing

Deal/flip animation ≤ 350 ms per card; input is locked only while a card is moving
(the game has no other waits). Reduced motion: `g-flip` already shortens to a fade.

### Tutorial (`lib/game-tutorials.ts`)

```
intro: 'Flip cards until a rank comes up twice. Every new rank raises the payout.'
steps:
  Place your bet — Add chips and deal. The first card is free.
  Flip — Each flip that shows a new rank climbs the pay table: 1.03×, 1.17×, 1.43×, 1.91×, 2.80×, 4.61× and up.
  Watch the odds — The board shows how many cards left would bust you. It grows with every rank you clear.
  Cash out — Take the multiplier any time from the second card. A repeated rank loses the bet.
notes: ['Suits do not matter: only ranks count.', 'Clear all 13 ranks and the round pays the top multiplier.']
```

---

## 3. Tower of Cards (`tower-of-cards`)

### Rules

One shuffled 52-card deck per round, no replacement. Four calls in a fixed order;
after each right call the player may **Cash out** or **Go on**. A wrong call loses the
bet. The fourth right call cashes out automatically.

| Step | Call | Wins when the new card is… | Options |
|---|---|---|---|
| 1 | Colour | red (♥♦) or black (♠♣) as called | Red / Black |
| 2 | Higher / Lower | strictly higher or strictly lower than card 1 (Ace high: 2 … 14); equal loses | Higher / Lower |
| 3 | Inside / Outside | strictly between cards 1 and 2, or strictly outside them; equal to either loses | Inside / Outside |
| 4 | Suit | the called suit | ♠ ♥ ♦ ♣ |

### Pay

Each option shows its own step multiplier, computed from the cards left in the deck:

- Step 1: **1.94×** for either colour (the only house edge: 26/52 × 1.94 = 97%).
- Steps 2–4: `floor2(cardsLeft / winningCardsLeft)` (fair odds, rounded down).
- An option with zero winning cards is shown disabled ("—").
- Running multiplier = `round2(previous × step)`. Payout = `Math.round(bet × multiplier)`.

Because steps 2–4 are fair and rounded down, the return is **at most 97%** at every
cash-out point, whatever the player calls. Highest possible multiplier: **756.92×**
(4♠, Lower → 2♠, Inside → 3♠, then ♠ at 10/49). Max is found by brute force; keep the
script result and `GAME_MAX_MULT` equal.

### Engine (`games/tower-of-cards/`)

```ts
export type TowerStage = 'betting' | 'playing' | 'riding' | 'settled'
export type TowerCall =
  | { step: 1; pick: 'red' | 'black' }
  | { step: 2; pick: 'higher' | 'lower' }
  | { step: 3; pick: 'inside' | 'outside' }
  | { step: 4; pick: '♠' | '♥' | '♦' | '♣' }
export interface TowerState {
  stage: TowerStage          // playing = waiting for a call; riding = right call, cash out or go on
  deck: HiLoCard[]
  cards: HiLoCard[]          // one per answered step
  step: 1 | 2 | 3 | 4        // the next call to make
  betAmount: number
  multiplier: number         // 0 until step 1 is won
  outcome: 'win' | 'loss' | null
  lastCall: TowerCall | null
  message: string
}
```

Functions: `initTower()`, `startTower(bet)`, `optionsFor(state)` → `{ pick, mult | null }[]`
for the current step (the board renders exactly this), `callTower(state, call)`,
`goOnTower(state)` (riding → playing, next step), `cashOutTower(state)`, and dev
`winCall(state, call)` / `loseCall(state, call)` (move a matching card to the top of the
deck; `loseCall` falls back to `callTower` if every card wins, e.g. never in practice).

### Board

A rising stair of **four card slots**, left to right, each one step higher than the
last (the "tower"), on wide boards; a 2 × 2 block on narrow ones.

- Each slot: a `PlayingCard variant="slot"` with its question above in `felt-print`
  ("Colour", "Higher / Lower", "Inside / Outside", "Suit") and, once answered, the step
  multiplier under it in `gold-print`. The current step's slot is ringed in felt.
- A right card deals in (`g-deal`), flips (`g-flip`) and glows (`g-win`); the wrong card
  shakes (`g-shake`) and the cards before it dim (`g-dim`).
- Steps 2 and 3 need cards 1 and 2 visible at once: the stair keeps all answered
  cards face up.
- The running multiplier sits above the stair in gold (`num glow-gold`), like HiLo's streak.
- Prefix `toc-*`. Side-by-side layout for short wide boards as in HiLo
  (`hilo-board` pattern: put layout classes on an inner wrapper, not the board).

### Call buttons (on the felt, under the stair)

One fixed-height slot (`h-12`), contents swap by step and stage (HiLo pattern; never
mount/unmount the slot):

- Step 1: **Red** (`toc-red`, fill `#a92b42`, the Roulette red) and **Black**
  (`toc-black`, fill `#141318`), each with a gold hairline like `.hilo-higher`.
- Step 2: reuse `.hilo-higher` / `.hilo-lower` with ↑ / ↓.
- Step 3: neutral outlined pills **Inside** / **Outside**.
- Step 4: four round pills with the suit glyph (`<Suit index={0…3} />` from `components/ui/terminal.tsx`, order ♠ ♥ ♦ ♣;
  hearts and diamonds in the card red).
- Every option shows its multiplier (`num`) after the label; a zero-chance option is
  `disabled` and shows "—".
- Riding: **Cash out `amount`** (`GAME_DOCK_PRIMARY_BTN`) and **Go on** (gold outline,
  as HiLo's Go again), no multiplier on Go on (the next step's options show theirs).

### Dock

Betting: `GameDockChipRow`, `GameDockBetRow`, **Deal →**. Playing: quote in the chip row;
the settled slot says "Cash out now for `amount`" while riding. Settled:
`GameDockSettledRow`, result "Step `n`" + "`mult`" or "Wrong `call`".

### Tutorial

```
intro: 'Four calls on four cards. Every right call multiplies your bet; cash out between them.'
steps:
  Colour — Call red or black. A right call pays 1.94×.
  Higher or lower — Call the next card against the first. Equal loses.
  Inside or outside — Call whether the third card falls between the first two or outside them. Equal to either loses.
  Suit — Call the suit of the fourth card. Four right calls cash out automatically.
notes: ['Each button shows what that call multiplies by, from the cards still in the deck.', 'Ace counts high.', 'You can cash out after any right call.']
```

---

## 4. Baccarat (`baccarat`)

### Rules (punto banco, fixed drawing; the player makes no choices after betting)

- Each card is drawn independently and uniformly from a full 52-card deck (an infinite
  shoe, as HiLo draws). Values: A = 1, 2–9 face value, 10/J/Q/K = 0. A hand's total is
  its sum mod 10.
- Deal order: Player, Banker, Player, Banker.
- **Naturals:** if either two-card total is 8 or 9, both hands stand.
- **Player:** draws a third card on 0–5, stands on 6–7.
- **Banker**, if the Player stood: draws on 0–5, stands on 6–7.
- **Banker**, if the Player drew a third card worth `p3`:

  | Banker total | Draws when `p3` is |
  |---|---|
  | 0–2 | always |
  | 3 | anything but 8 |
  | 4 | 2–7 |
  | 5 | 4–7 |
  | 6 | 6–7 |
  | 7 | never |

- Higher total wins; equal totals are a Tie.

### Bets and pay (return multipliers, "pays N for 1" as on the Roulette mat)

| Spot | Wins when | Returns | RTP (exact, infinite shoe) |
|---|---|---|---|
| Player | Player total higher | 2× | 98.77% |
| Banker | Banker total higher | 1.95× (5% commission) | 98.94% |
| Tie | Totals equal | 9× | 85.88% |
| Player Pair | Player's first two cards same rank | 12× | 92.31% |
| Banker Pair | Banker's first two cards same rank | 12× | 92.31% |

On a **Tie, Player and Banker bets are returned** (payout = stake). Probabilities:
Player 44.615%, Banker 45.843%, Tie 9.543%.

Payout per spot: `Math.floor(amount × returnMult)` (Banker's 1.95 makes this matter).
Round outcome over all spots, as Roulette: total payout > staked → `win`; equal →
`push`; less → `loss` (a partial return is a loss with payout > 0).

### Engine (`games/baccarat/`)

```ts
export type BaccaratSpot = 'player' | 'banker' | 'tie' | 'player-pair' | 'banker-pair'
export type BaccaratBets = Partial<Record<BaccaratSpot, number>>
export interface BaccaratState {
  stage: 'betting' | 'settled'
  player: HiLoCard[]; banker: HiLoCard[]     // 2–3 cards each, in deal order
  playerTotal: number; bankerTotal: number
  winner: 'player' | 'banker' | 'tie' | null
  totalBetAmount: number; totalPayout: number
  outcome: 'win' | 'loss' | 'push' | null
  message: string
}
```

Functions: `cardValue`, `handTotal`, `bankerDraws(bankerTotal, p3 | null)` (the table
above, exported for the test), `dealBaccarat(bets, firstPlayerCard?)` (the optional card
is for the perk), `settleBaccarat(bets, player, banker)`, `payoutFor(bets, state)`,
dev `winGame(bets)` / `loseGame(bets)` (redeal until the bets pay more than / nothing of
the stake, max 500 tries, then take the best / worst seen; same idea as Roulette's
`pickPocket`). Keep the deal sequence explicit (`deal: { hand, card }[]`) so the
component can animate it card by card.

### Board

Two hands across the top half, the betting mat across the bottom half.

- **Hands:** "Player" left, "Banker" right in `felt-print`; cards via `PlayingCard`
  (`--card-h` from the board), third card set slightly lower and turned 90° as on a real
  table (`transform: rotate(90deg)`; it is visual only). Each total on a `.plaque` chip
  next to the label (Blackjack's total chip). Winner glows (`g-win`), loser dims
  (`g-dim`); on a Tie both get the gold ring.
- **Mat** (wood-and-gold frame like `.poker-frame`, felt inside, prefix `bac-*`):
  three big spots in a row **Player · Tie · Banker**, with **P Pair** and **B Pair** as
  small spots on the outer ends. Each spot shows its pay in `felt-print`
  ("1 to 1", "8 to 1", "0.95 to 1", "11 to 1"). Tie spot in gold print. Chips sit on
  the spots on a layer over the mat, as Roulette's `ChipLayer`.
- **Extract the chip layer first** (in this game's commit): move `chipFor` and
  `ChipLayer` out of `components/games/roulette/game.tsx` into
  `components/games/table-chips.tsx`, generalised to take a `cellFor(target)` grid
  placement function. Roulette keeps its `betCell` and passes it in. This is a move, not
  a change: Roulette must look and behave the same (check it in the browser).
- Short wide boards: hands left, mat right.

### Placing bets

Exactly Roulette's flow: `GameDockChipPicker` (with the ¼ / ½ / All in fractions) +
**Undo**; tap a spot to add the picked chip; `GameDockBetRow` with Clear; **Deal →**.
Ladder: a tap puts the whole pot on that one spot (Roulette's `placeChip` ladder branch).
Survival opening ticket: the ticket chip, no fractions (as Roulette). autoReBet restores
the last bet map.

### Timing

Cards deal at 350 ms apart (4 cards), each third card 500 ms after the previous
card, then settle 400 ms after the last card. Total 1.8–2.7 s. Reduced motion: no deal
arc; cards appear face up at the same moments (the moments carry the drama, keep them).

### Tutorial

```
intro: 'Bet on the Player hand, the Banker hand or a Tie. The cards play themselves.'
steps:
  Place chips — Pick a chip and tap Player, Banker, Tie or a Pair spot.
  Deal — Two cards to each hand. Tens and faces count 0, aces 1; only the last digit of the total counts.
  Third cards — Fixed rules decide whether each hand takes a third card. You make no choices.
  Collect — Player pays 2×, Banker 1.95×, Tie 9×, a Pair 12×.
notes: ['On a Tie, Player and Banker bets are returned.', 'A natural 8 or 9 on the first two cards ends the deal.', 'Banker wins a little more often, so it pays 5% less.']
```

---

## 5. Sic Bo (`sic-bo`)

### Rules

Three dice are rolled once. The player covers any number of spots on the mat before the
roll. Every spot is settled on its own; the round's outcome is the sum (as Roulette).

### Bets and pay (return multipliers)

| Spot | Wins when | Returns | RTP |
|---|---|---|---|
| Small | total 4–10, not a triple | 2× | 97.22% |
| Big | total 11–17, not a triple | 2× | 97.22% |
| Any Triple | all three dice equal | 35× | 97.22% |
| Total 4 / 17 | total equals it | 70× | 97.22% |
| Total 5 / 16 | | 35× | 97.22% |
| Total 6 / 15 | | 21× | 97.22% |
| Total 7 / 14 | | 14× | 97.22% |
| Total 8 / 13 | | 10× | 97.22% |
| Total 9 / 12 | | 8.4× | 97.22% |
| Total 10 / 11 | | 7.75× | 96.88% |
| Double 1–6 | at least two dice show it | 13× | 96.30% |
| Single 1–6 | one / two / three dice show it | 2× / 3× / 15× | 97.22% |

Totals include triples (a 2-2-2 wins Total 6). Payout per spot:
`Math.floor(amount × returnMult)`. Win / push / loss over all spots exactly as
Roulette's `settleRouletteSpin`.

### Engine (`games/sic-bo/`)

```ts
export type SicBoTarget =
  | 'small' | 'big' | 'any-triple'
  | `total-${4|5|6|7|8|9|10|11|12|13|14|15|16|17}`
  | `double-${1|2|3|4|5|6}`
  | `single-${1|2|3|4|5|6}`
export type SicBoBets = Partial<Record<SicBoTarget, number>>
export type SicBoRoll = [number, number, number]
export interface SicBoState {
  stage: 'betting' | 'settled'
  dice: SicBoRoll | null
  totalBetAmount: number; totalPayout: number
  outcome: 'win' | 'loss' | 'push' | null
  message: string
}
```

Functions: `returnFor(target, roll)` (the table above, the single source of every
figure), `rollSicBo(bets)`, `settleSicBo(bets, roll)`, `payoutForRoll(bets, roll)`,
`bestPayout(bets)` (max over all 216 rolls, for the "A hit pays" line), `ALL_ROLLS`
(216), dev `winGame(bets)` / `loseGame(bets)` (pick a random roll from the 216 that pays
more than the stake / nothing; fallback best / worst, as Roulette's `pickPocket`), and
for the perk `coldFaces(roll, count = 2)` (two faces that appear on no die, at random).

### Board

Dice on the left, mat on the right (dice above the mat on portrait boards).

- **Dice:** three `Die` (`components/games/die.tsx`, already shared with Liar's Dice)
  inside a round glass dome on a wood-and-gold base (local SVG or CSS, prefix `sb-*`,
  the Roulette rim colours). While rolling the dice tumble (reuse the `dice-*` keyframes
  if they fit, else a new `sb-tumble` added to the reduced block) for 1.2 s, land with a
  stagger of 120 ms, then the result total appears under the dome on a `.plaque`. Winning
  dice glow (`tone="win"`).
- **Mat** (wood-and-gold frame, felt inside, cells with the Roulette dark outline):
  - Row 1: **Small** `4–10` (wide) · **Any Triple** (centre, gold print) · **Big** `11–17` (wide).
  - Row 2: **Doubles** — six cells, each two small drawn pips of the face.
  - Row 3: **Totals** — 14 cells 4 … 17, the pay under each in `felt-print`.
  - Row 4: **Singles** — six cells, each one drawn die face.
  - Print under the mat: "Small / Big pay 2 for 1 · lose on any triple".
  - Covered cells light like Roulette's covered numbers; after the roll, winning cells
    glow felt, the rest dim.
- Chips: the shared `components/games/table-chips.tsx` from Baccarat, with a
  `cellFor(target)` for this grid.
- On narrow boards the totals row splits into two rows of 7.
- A 14-cell totals row is the tightest part: check it at 360px wide and on a 195px-tall
  board. If it cannot stay readable, stop and ask (no scrolling).

### Placing bets, Ladder, ticket, autoReBet

Same as Baccarat / Roulette (chip picker with fractions, Undo, Clear, Ladder whole pot on
one spot, opening-ticket chip, autoReBet restores the map).

### Timing

`ROLL_MS = 1800` (tumble 1200 ms + landing stagger), settle at `ROLL_MS`. Reduced: dice
appear on their faces after 400 ms, settle at 400 ms.

### Tutorial

```
intro: 'Bet on three dice: their total, a number, a pair or a triple.'
steps:
  Pick a chip — Choose a chip value, or ¼, ½ or All in, from the rack.
  Place chips — Tap any spots on the mat. Cover as many as you like.
  Roll — Three dice land under the dome.
  Collect — Every winning spot pays on its own: Small or Big 2×, a total up to 70×, a double 13×, a triple 35×.
notes: ['Small and Big lose on any triple.', 'A single number pays 2× for one die, 3× for two, 15× for three.']
```

---

## 6. Survival: boosts and perks

Boosts need only the label (the catalog builds the five levels). Every perk is a
proc perk (`0.30` base, +11.25% a level, 75% cap) rolled with `usePerkProc` when the
round starts (or, for perks that act during betting, when the betting phase starts, as
Roulette's Ball Tracker does). Show an active perk with `PerkHint` in the status bar and
mark what it affects on the board with the felt ring + dot used by Dragon Tower's
blind spot.

| Game | Boost name | Perk | effectKey | Rarity / base cost | Effect |
|---|---|---|---|---|---|
| sic-bo | Hot Dice | **Cold Faces** | `perk_sic_bo_cold` | rare / 20 | During betting, the roll is pre-rolled (`pendingRoll` ref, as Roulette's `pendingSpinResult`) and two faces that appear on no die are crossed out on the Singles and Doubles rows. |
| tower-of-cards | High Card | **Safety Net** | `perk_tower_net` | rare / 20 | When active this round, a wrong call from step 2 on pays the multiplier banked before it instead of losing (a wrong step-1 call is a push). Settle as `win` if that pays more than the stake, else `push`. |
| deck-countdown | Card Memory | **Burn Card** | `perk_deck_burn` | rare / 22 | When active this round, the first repeated rank is burned instead of busting: it goes face down beside the deck, the multiplier and count stay, and the next flip is the same flip number. |
| baccarat | Shoe Reader | **Shoe Peek** | `perk_baccarat_peek` | epic / 22 | During betting, the Player's first card is drawn early and shown face up on the table; `dealBaccarat(bets, firstPlayerCard)` uses it. |

Perk effect on the house edge (for `BALANCE_AUDIT.md`): Shoe Peek, when active and the
player bets the better side, returns **106.7%** (exact; Banker is better after a first
Player card of 0–5, Player after 6–9). Cold Faces and Burn Card are smaller; Safety Net
turns a deep loss into the last banked multiplier. These are in line with Ball Tracker
and Safe Lane. Write the numbers into the audit's §4 entry in the existing format.

Mission notes: `min_multiplier` uses `multiplier` from the resolve payload, so always
pass the real round multiplier (`payout / bet` for the chip-on-mat games, as Roulette).

### 6.1 Floor game selection: favour games not offered yet (owner-approved)

**Today** (`lib/survival/floor-generator.ts`): the whole run's schedule is a plain
seeded shuffle of the pool in batches of `floor(pool / 6)` floors. Nothing looks at
upgrades ("Invested-game guarantee: Not implemented", `BALANCE_AUDIT.md` §7). With
22 games, 4 sit out each batch, so a game can miss a whole run.

**New:** pick each floor's six games when the floor is generated, by a seeded,
weighted draw without replacement. Each game's weight is the product of:

| Factor | Weight | Why |
|---|---|---|
| Not offered on any earlier floor this run | **× 3** | The owner's ask: new games come up sooner, every game gets a turn |
| The player owns that game's boost or perk (any level) | **× 2** | Upgrades you bought come back (the "invested game" the audit lists as missing) |
| Offered on the previous floor | **× 0.5** | Fewer repeats floor to floor |
| Already offered on 5 floors this run | **× 0** | Hard cap |

Simulated over 4,000 runs of 10 floors with 22 games (a player buying an upgrade for
a game every second floor): **0.012 games per run never offered** (1.1 with a plain
draw), no game on more than 5 floors, owned games offered on 3.6 floors on average
against 2.5 for the rest.

Implementation:

- `generateFloor` input gains `previousFloors: GameName[][]` (from `floorHistory`
  plus the floor just finished; include lobby-reroll replacements, i.e. the final
  `floorGames` of each floor) and `ownedGames: GameName[]` (games with a `game`-scope
  item in `purchasedUpgrades`; add a helper `ownedUpgradeGames(purchasedUpgrades)` in
  `lib/survival/survival-perks.ts`).
- RNG: `createRng(seedFromString(`${runSeed}:floor:${floor}`))`. The same seed, the
  same history and the same upgrades give the same floor.
- Draw: repeat six times — weights as above, pick by cumulative weight, remove the
  pick. If every weight is 0 (impossible with 22 games and a cap of 5 over 10 floors,
  but guard it), fall back to a uniform draw.
- Endless floors (> 10) use the same draw; the cap counts only the last 10 floors.
- `generateRunSchedule` is no longer used; delete it. The three `generateFloor` calls
  in `store/survival-store.ts` pass the new inputs (floor 1: empty history, no
  upgrades).
- Weights and the cap are constants in `lib/survival/balance.ts`
  (`FLOOR_UNSEEN_WEIGHT = 3`, `FLOOR_OWNED_WEIGHT = 2`, `FLOOR_REPEAT_WEIGHT = 0.5`,
  `FLOOR_MAX_APPEARANCES = 5`).
- Lobby reroll ticket (`pickLobbyGameReroll`): use the same weights over the games it
  may offer, so a reroll also prefers unseen games.
- Docs: rewrite `BALANCE_AUDIT.md` §7 (selection algorithm, the invested-game line,
  pool size) and the floor-generator comment.
- Check: a script run of 1,000 seeds printing the three figures above.

---

## 7. Owner decisions (all answered, 2026-10-30)

1. **Ladder length: keep 18 rungs.** With 22 games, four are left over each climb.
   Update the `LADDER_RUNGS` comment in `lib/ladder/rules.ts` (first game's commit) and
   the README's Ladder line "every game once per run" → "one game per rung, never the
   same game twice". The picker's "`n` of `GAMES.length` games left" already adapts.
2. **Survival floors: weighted draw (section 6.1).** Runs in progress may get different
   later floors; accepted.
3. **Deck Countdown top prize: keep 9178.56×**, no cap.
4. **Daily: merge just after 00:00 UTC.** Adding games changes the daily shuffle for
   every date. Whoever opens the PR says so in its description, so the owner merges at
   the right time. Nothing to build for it.

---

## 8. Status

| Game | Engine | Board | Survival | Docs | Browser-checked |
|---|---|---|---|---|---|
| Deck Countdown | ✓ | ✓ | ✓ | ✓ | — |
| Tower of Cards | — | — | — | — | — |
| Baccarat | — | — | — | — | — |
| Sic Bo | — | — | — | — | — |

Tick each column in the game's commit.

---

## 9. Checking

Per game, before the commit:

1. `npx tsc --noEmit` and `pnpm lint` (the known errors are listed in `CLAUDE.md`).
2. **Engine numbers.** Add a script `scripts/check-new-games.ts` (run with
   `npx tsx scripts/check-new-games.ts`) that, for the game you built:
   - Deck Countdown: rebuilds the pay table from the formula and compares it with
     `DECK_COUNTDOWN_MULTS`; simulates 200k rounds stopping at flips 2, 5 and 8 and prints
     the RTP (≈ 0.97).
   - Tower of Cards: brute-forces every path (52 × 2 × 51 × 2 × 50 × 4) for the max
     multiplier and checks that step 1 returns 0.97 and every step-2–4 option returns at most
     1.00 × the multiplier banked before it (fair odds rounded down).
   - Baccarat: exact infinite-shoe enumeration of P(Player), P(Banker), P(Tie) (44.615% /
     45.843% / 9.543%) using the engine's `bankerDraws`.
   - Sic Bo: enumerates the 216 rolls and prints every spot's RTP (table above).
   The Python sketches that produced this plan's figures are in `scripts/new-games/`
   (see its README); port the logic, then delete nothing: they stay as references.
3. **Board fit.** `node scripts/design-check/responsive-check.cjs ./out /freeplay/<id>` and
   `play-responsive-check.cjs` into a round (steps in `GAME_REDESIGN_HANDOFF.md`). No
   `FAIL` lines; look at phone, 720p, 1440p and one Motion = reduced screenshot.
4. **Modes.** Play one round each in Freeplay, Ladder (whole pot; a push replays the rung; Baccarat Tie on Player is a push), and
   Survival (min bet, opening ticket, the perk with dev Grant upgrades, curse and bless).
   Daily can't be forced to a game; it uses the same component with `mode="daily"`, so
   read the code paths instead: min bet from `useGameMinBet`, curse / bless off, autoReBet.
5. Update this file's status table and the docs in the wiring checklist.
