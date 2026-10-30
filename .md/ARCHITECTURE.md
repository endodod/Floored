# Floored — Architecture & Conventions

How the code is laid out and the rules that aren't obvious from reading it. For
what the modes are and how they play, see the [README](../README.md).

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · Zustand
(persisted to `localStorage`) · optional accounts via Neon Auth + Prisma/Postgres
(finished survival runs, and Freeplay / Daily / Ladder / Tables / Survival progress; see **Account sync**).

---

## Layout

| Path | What lives there |
|---|---|
| `app/` | Routes. Each mode has a hub (`app/<mode>/page.tsx`) and one dynamic game route (`app/<mode>/[game]/page.tsx`) — there are no per-game page files. |
| `app/how-to-play/[game]/` | Static rules page per game (content in `lib/game-tutorials.ts`). |
| `app/account/` | Local settings, motion preference, dev mode, sign-in. |
| `app/api/run/` | Survival run sync for signed-in players (`lib/survival/run-sync.ts`). |
| `app/api/state/` | Account sync of the Freeplay, Daily, Ladder, Tables and Survival stores (`components/account-sync.tsx`, `lib/sync/keys.ts`). |
| `games/<name>/` | `types.ts` + `engine.ts` — pure game logic, no React. |
| `components/games/<name>/game.tsx` | One React component per game, plus sub-components in the same folder. |
| `components/` | Shared UI: navbar, lobby, game tiles, game chrome, mode intros, tutorials. |
| `components/ui/` | Primitives: shadcn-style `button`, `dialog`, … and `terminal.tsx` (page title, section title, figure strip, unit tracks, suits). |
| `lib/game-catalog.ts` | `GAMES[]` — label, subtitle and mode availability for every game. |
| `lib/game-registry.tsx` | `GAME_REGISTRY` — the only file that imports all game components. |
| `lib/daily/`, `lib/ladder/`, `lib/survival/` | Mode rules. `lib/ladder/rules.ts` also holds `GAME_MAX_MULT` (the "up to …×" captions). |
| `lib/tables/`, `lib/bots/`, `components/tables/` | Tables mode: table games against bots, kept apart from `GameName` / `GAMES` / `GAME_REGISTRY` (own catalog, registry, store `store/tables-store.ts`). See [BOT_TABLES_HANDOFF.md](BOT_TABLES_HANDOFF.md). |
| `lib/features.ts` | `SURVIVAL_ENABLED`, `LADDER_ENABLED` — turning one off hides its entry points and 404s its routes. |
| `store/` | Zustand stores: `freeplay`, `daily`, `ladder`, `survival`, `settings`; shared types in `store/types.ts`. |
| `hooks/use-game-bankroll.ts` | `use{Freeplay,Survival,Daily,Ladder}GameBankroll` — each mode's bankroll math for the `[game]` pages. |
| `utils/format.ts` | `formatChips`, `formatMultiplier` — always use these for money and multipliers. |
| `utils/rng.ts` | Seeded RNG (`createRng`, `seedFromString`) for anything that must be reproducible (daily challenge, survival floors and missions). |

---

## Game architecture

### Engine purity
`games/<name>/engine.ts` is pure functions: no React, no side effects. All
randomness lives in the engine; the component calls engine functions and holds
UI state. Typical shape: `init<Game>()`, `start<Game>(bet)`, `<action>(state, …)`,
`settle<Game>(state)`.

### onResolve contract
A game component never touches a bankroll store. It receives `bankroll`, `onBet`
and `onResolve` from its `[game]` page and reports each round through
`resolveGame(onResolve, { outcome, betAmount, payout, multiplier })`. The page's
bankroll hook does the math (`bankroll - betAmount + payout`) and the mode's
bookkeeping. A push returns the stake (`payout === betAmount`).

### Modes inside a game
Components take `mode: GameMode` (`freeplay | daily | ladder | survival`).
Survival perks are read with `useSurvivalPerks(game)`; the minimum bet comes from
`useGameMinBet`; run endings (bust, floor done, rung lost, Daily out of bets or day over) from `useRunEnd`,
which shows them in the dock's result row and swaps Leave / Next for the run's action (no modals); the
Ladder's all-in pot from `useLadderAllIn`. Dev curse/bless/force-tie toggles only
apply in Freeplay and Survival, never in Daily or Ladder.

### Match history
The settled round's entry is staged in `pendingResult` and pushed into
`matchHistory` on the **next** round (`handleNext`), so the player sees the
result in the dock before it scrolls into history:
`setMatchHistory((h) => [entry, ...h].slice(0, 80))`.

### autoReBet
`useSettingsStore().autoReBet` restores the last bet (and the last pick where a
game has one — Chicken Race's chicken, Keno's numbers or quick pick) on Next.

---

## Game UI conventions

Every game is built from the same shell, so the game tables look and behave alike.
`components/games/mines/game.tsx` is a good reference.

**Shell** (`components/game-layout.ts`): `GAME_CARD_SHELL` › `GAME_STATUS_BAR`
(name left, message right) › `GameFieldWithHistory` with `GAME_BOARD_ARENA` (the
felt table, with the history drawer) › `GAME_CONTROL_DOCK_M`.

**Board.** Each game draws its own board on the felt; the per-game redesign and
its rules are in [GAME_REDESIGN_HANDOFF.md](GAME_REDESIGN_HANDOFF.md) — read it
before changing a board. Shared pieces:
- `components/games/board-tile.tsx` — `BoardTile` / `TileMark` for grid games
  (Mines is the reference; Keno, Dragon Tower and Chicken Road use it too).
- `components/games/playing-card.tsx` — the one card for every card game.
- `app/globals.css` — `.board-fit` (every board is a size container named
  `board`, so sizes use `cqh`/`cqw` with `clamp()` floors), the motion kit
  (`g-*` classes), `.felt-print`, and per-game `@container board` blocks.
- Boards must fit their space at every size and never scroll.

**Dock** (`components/game-dock-parts.tsx`): `GAME_DOCK_INNER` with three rows —
`GameDockChipRow` (chips, ¼, ½, All in; a quote while a round plays),
`GAME_DOCK_SETTLED_SLOT` (`GameDockBetRow` while betting, `GameDockSettledRow`
when settled), and `GAME_DOCK_ACTIONS`. Buttons: `GAME_DOCK_PRIMARY_BTN` (start /
next / in-round action), `GAME_DOCK_SECONDARY_BTN`, `GameDockLeaveButton`, `GameDockSettledActions`,
`GameDockGameOverButton`; `GameDockChipPicker` for games where chips are placed
on a table (Roulette). `GameDockBackButton` shows the hub link and the
**How to play** link top-left between rounds; `GameActiveBetBadge` shows the
live bet there during a round.

**Colour rules.** Felt green = selected or won, loss red = lost, gold = special
(jackpots, cash-outs, the All-in pill). Greys come from the tokens (`ink`,
`soft`, `dim`, `line`, `control`, …) in `app/globals.css` / `tailwind.config.ts`
— no raw `zinc-*` or per-game accent colours. Tailwind's
`/opacity` modifier does not work on the token colours (they are CSS variables
holding hex) — use an arbitrary `rgba()` value instead.

**Layout stability.** Nothing on the board or in the dock may move or resize
between betting, playing and settled. Keep elements mounted and hide them with
`invisible pointer-events-none`; use fixed-height slots (`min-h-10`, `h-9`)
whose content swaps; prefer one adaptive button over several conditional ones.

**Tailwind JIT.** Class names must appear literally in source. Never build them
from data (`bg-${color}-500`); store colours as hex and apply them via `style`.

---

## Survival internals

Constants and formulas live in `lib/survival/balance.ts`; the full numbers are in
[BALANCE_AUDIT.md](BALANCE_AUDIT.md).

- A floor ends after `FLOOR_BET_LIMIT` bets (no timer). Quota met → floor
  complete panel → shop → `advanceFloor`; floor 10 cleared → victory or endless.
- Runs always start on Normal. Hard/Nightmare exist in the balance tables
  (`DIFFICULTY_QUOTA_MULT`, `DIFFICULTY_SHOP_PRICE_MULT`) but have no UI;
  `components/difficulty-dialog.tsx` is not mounted.
- Floors, missions and shop offers are seeded from the run seed
  (`floor-generator.ts`, `missions.ts`, `shop-offers.ts`).
- Upgrades: `upgrades-catalog.ts` (what exists), `upgrade-levels.ts` (per-level
  values and costs), `survival-perks.ts` (reading them; the combined payout
  multiplier is capped by `RAW_PAYOUT_MULT_CAP`).
- Active items are designed but not built — see
  [ACTIVE_ITEMS_SPEC.md](ACTIVE_ITEMS_SPEC.md).

---

## Account sync

Signed-in players' Freeplay, Daily, Ladder, Tables and Survival stores (a Survival
run in progress included) follow the account
(`components/account-sync.tsx`, mounted in `app/layout.tsx`; route `app/api/state`;
table `UserState`, one row per user and store holding the store's persisted
`{ state, version }`). The game stays local-first: the stores still live in
`localStorage` and the sync only copies them.

- **Pull** once per page load (and when a tab hidden for 30+ minutes comes back).
  Per store, the newest change wins: the account's copy replaces the local one
  unless this device changed it more recently. First sign-in on a device: the
  account wins; stores the account doesn't have are uploaded from the device.
  A change counts only when the store's saved value changed, and changes made
  before the first pull lands (a page rolling Daily to a new day as it opens) wait
  for it and are dropped for stores the account replaces. Nothing is uploaded until
  a pull has succeeded (a failed pull retries after 2, 4 and 6 minutes), so a device
  that couldn't check the account never overwrites it.
- Two devices playing the same store without syncing in between: the later change
  wins and replaces the other's progress for that store.
- **Push** in batches: at most every 15 minutes while playing, plus when the tab
  is hidden or closed (`keepalive`). The server keeps a store only if its
  `changedAt` is newer than the stored one.
- **Why batched:** Neon's free compute stays awake 5 minutes after each query and
  the Free plan has 100 CU-hours a month. A write per bet would keep the database
  awake for a whole session; batching keeps it to roughly 15 minutes per 30-minute
  session (~0.06 CU-hours at 0.25 CU). Ten players with one or two sessions a day
  come to about 25–55 CU-hours a month at most (less when sessions overlap). If
  the allowance runs out, Neon suspends the compute until the next month (no
  charge); the game keeps working locally and syncs again after.
- Adding a store to the sync: add its key to `SYNCED_STORE_KEYS` and the store to
  `STORES` in the component. Finished Survival runs still go to `/api/run` as well
  (the run history and account stats); settings, hidden tutorials and the bots'
  memory of the player stay per device.
- The `UserState` table comes from `prisma/migrations/20261030120000_add_user_state`;
  the build doesn't migrate, so run `npx prisma migrate deploy` against the
  database when deploying this. Until then `/api/state` fails and the game simply
  stays local.

## Dev mode

Unlocked with a password in Account → Dev mode (`app/account/page.tsx`). Toggles:
cursed / normal / blessed outcomes, force a HiLo tie, show all games in the
survival lobby, infinite bets per floor, plus bankroll / sparks setters and
grant / clear upgrades. Stored in `store/settings-store.ts`.

---

## Adding a new game

1. `games/<name>/types.ts` and a pure `games/<name>/engine.ts`.
2. Add `'<name>'` to `GameName` in `store/types.ts`.
3. Add its entry to `GAMES[]` in `lib/game-catalog.ts` and its maximum
   multiplier to `GAME_MAX_MULT` in `lib/ladder/rules.ts`.
4. `components/games/<name>/game.tsx`, built from the shell, board and dock
   pieces above, following `GAME_REDESIGN_HANDOFF.md` (fit, motion, reduced motion).
5. Register it in `GAME_REGISTRY` (`lib/game-registry.tsx`).
6. Write its rules in `GAME_TUTORIALS` (`lib/game-tutorials.ts`).
7. Survival: add it to `SURVIVAL_GAME_POOL` and give it a boost / perk track in
   `upgrades-catalog.ts` if it should have one.
