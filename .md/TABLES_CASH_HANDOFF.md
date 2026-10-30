# Tables: Cash tables — handoff

Status as of 2026-10-30: **partly implemented on `claude/new-games-handoff` and
`main`.** Cash stakes, catalog, wallet/session records, the Hold'em and Blackjack
cash engine foundations, and the initial runner/lobby/table wiring are present.
Liar's Dice now has a cash wrapper and board integration. Bot churn, cash-specific
checks/simulation, top-up/leave UX, tutorials, final documentation and browser
verification remain; use the phase table below as the source of truth.

## What the owner asked for

A second category inside the **Tables** mode for the same three games (Hold'em,
Liar's Dice, Blackjack). Players **sit down with chips from their own bankroll**
(the Tables wallet) instead of a fixed buy-in, there are **no prize pools or
places**, and they **play until they leave or run out of chips**.

The owner first called this "Sit n Go" and then agreed to the poker names:
**Cash tables** for the new category and **Tournaments** for today's tables (which
are fixed-buy-in Sit & Go tournaments). In code the format ids are `'cash'` and
`'tournament'`. Don't use "Sit n Go" in the UI.

Read first: [BOT_TABLES_HANDOFF.md](BOT_TABLES_HANDOFF.md) (how Tables is built and
its **Ground rules**: bots decide only from their seat's view; engines are pure with
an injected RNG), and [ARCHITECTURE.md](ARCHITECTURE.md). Nothing here touches
`GameName`, Freeplay, Survival, Ladder or Daily.

Already done on this branch (don't redo): tournament buy-ins are **100 / 1,000 /
10,000** (`TABLE_TIERS` in `lib/tables/stakes.ts`).

---

## 1. How cash tables play

| | Tournaments (today) | Cash tables (new) |
|---|---|---|
| Entry | Fixed buy-in per stake (100 / 1,000 / 10,000) into a prize pool | **Any amount** from the wallet, 1 chip up to all of it (the dialog starts at all of it) |
| Chips at the table | Tournament chips | **Your real wallet chips** |
| Ends | When your place is decided | **When you leave, or your stack reaches 0** |
| Pay | Prizes by place | **Your stack goes back to the wallet** when you leave |
| Leaving early | Forfeits the buy-in | **Any time**; in play you fold / stand / give up your dice first (1.2) |
| Opponents | Fixed for the table | Bots **come and go** (1.4) |
| Blinds / bets | Rise over time | **Fixed** for the stake |
| Wallet | One Tables wallet for both categories | (same) |

### 1.1 Stakes

The stake sets only the table's limits. There is no buy-in range and nothing is
disabled by the wallet: a short stack plays its chips all in (1.2). Each level is
×10 the one below, like the tournament buy-ins.

| Game | Low | Mid | High |
|---|---|---|---|
| Hold'em | blinds 5 / 10 | blinds 50 / 100 | blinds 500 / 1,000 |
| Liar's Dice | ante 50 a game | ante 500 | ante 5,000 |
| Blackjack | bets 10 – 500 | bets 100 – 5,000 | bets from 1,000, no max |

Wallet: unchanged. 10,000 to start; **Refill** to 10,000 when it is below 100 (the
smallest tournament buy-in) and no table is open. Chips at a cash table are not in
the wallet, so the navbar and home figures (which show the wallet) drop while you
sit; that is expected, as with a tournament buy-in.

### 1.2 Leaving, short stacks, topping up

- **Leave table** (the corner button; it reads "← Tables" at tournaments):
  - Between hands / games: you leave at once with your whole stack.
  - In a Hold'em hand you haven't folded: confirm "You fold this hand and leave
    with `stack`." Chips already in the pot stay there.
  - In a Blackjack hand (your bet is down): confirm "You stand and leave when this
    hand settles." Your remaining decisions are stands; you leave at settle with
    the stack after the payout.
  - In a Liar's Dice game: confirm "You give up your dice and leave with `stack`."
    Your ante stays in the pot; your dice leave the game. If one player is left,
    that game ends and they take the pot.
- **Closing the tab or reloading** counts as leaving at that moment with the same
  rules. The store always holds your chips behind (2.5), so the lobby returns
  exactly that. There is no way to dodge a hand by closing the tab.
- **Stack 0** (only then): the table shows **Top up** or **Leave**. Until 0 you
  always play:
  - Hold'em: all in for less with side pots (the engine already does this); a stack
    smaller than a blind posts what it has (the engine already does this).
  - Liar's Dice: a stack smaller than the ante antes all it has and can win at most
    that much from each other player; the rest of each bigger ante goes back to its
    owner when the game ends.
  - Blackjack: below the table minimum you may bet your whole stack (and only
    that); a double with too few chips doubles for the rest of your stack.
- **Top up** between hands / games: any amount from the wallet. Not during a hand.
- **Leaving ends the session.** There is no "sit back down at the same table".

### 1.3 Per game

**Hold'em.** The existing engine with one fixed blind level, no levels and no "last
player wins". 6 seats (4 on phones, as today), no rake. A player who sits down
between hands **posts a big blind** and plays the next hand at once (the players
seated when the table opens don't).

**Liar's Dice.** A session is a run of games. Each game: every seat with chips
antes, then a normal game with the existing rules and **5 dice each**; the last
player with dice takes the pot (minus any returned excess, 1.2). Between games
players leave, top up, and bots come and go.

**Blackjack.** The Showdown engine without the tournament: each seat plays its own
hand against the house dealer from the shared shoe, as long as it likes. Same rules
as Showdown (3:2 blackjack = 2.5× return, double on two cards, no split, dealer hits
≤ 16). **No 12-hand limit, no rising minimum, no secret final bet, no standings.**
The house pays wins, so this is the one cash game with a house edge (~1%, the solo
Blackjack figure in `BALANCE_AUDIT.md`). Its label in this category is **Blackjack**
(sub "Play the house at a shared table").

### 1.4 Bots

- Bankrolls are **unlimited**; only the human's chips are tracked.
- At the start, seat bots as today (`seatBots(count, rng)` with the table seed), each
  with a random skill and a stack drawn uniformly from **40–200 big blinds**
  (Hold'em), **5–25 antes** (Liar's Dice) or **20–100 minimum bets** (Blackjack),
  rounded to that unit. Call it the bot's `sitStack`.
- **Churn**, only between hands / games, all from the table RNG (a seed replays):
  - a bot with 0 chips leaves;
  - a bot with more than 2 × its `sitStack` leaves with probability 0.06 a hand
    (0.15 a game in Liar's Dice);
  - any bot leaves with probability 0.01 a hand (0.03 a game in Liar's Dice);
  - a bot below half its `sitStack` tops up to `sitStack` with probability 0.5;
  - an empty seat is filled after 1–3 hands (games), uniformly, by a bot from the
    roster not already at the table, with a fresh skill and `sitStack`;
  - the table never has fewer than 2 bots: if churn would drop below that, fill a
    seat at once.
- Arrivals and departures go into the hand history: "Mara sits down with 860",
  "Theo leaves with 2,140". Name and chips only: a bot's style and skill are never
  shown anywhere (ground rule in `BOT_TABLES_HANDOFF.md`).

---

## 2. Code plan

### 2.1 Types (`lib/tables/types.ts`)

```ts
export type TableFormat = 'tournament' | 'cash'

/** Cash-table operations. All pure; the seat-changing ones only between hands / games. */
export interface CashTableOps<State> {
  /** True between hands / games: seats may change now. */
  betweenHands: (state: State) => boolean
  /** Put a player in an empty seat with `stack` chips; `newcomer` makes a Hold'em seat post a big blind. Throws if taken. */
  sit: (state: State, seat: number, stack: number, newcomer: boolean) => State
  /** Empty a seat; returns the new state and the chips the seat leaves with. */
  stand: (state: State, seat: number) => { state: State; stack: number }
  /** Add chips to a seated player (top up). */
  addChips: (state: State, seat: number, amount: number) => State
  /** Chips in front of a seat that are not in a pot right now (what leaving takes). */
  stackBehind: (state: State, seat: number) => number
  /** True while the seat is in a hand / game (leaving needs the 1.2 rule). */
  inPlay: (state: State, seat: number) => boolean
  /** The fold / give-up a seat makes when it leaves in play (Blackjack: no-op, the runner waits). */
  leaveAction: (state: State, seat: number) => State
  emptySeats: (state: State) => number[]
  /** Hands (games) dealt so far, for the session record. */
  handsPlayed: (state: State) => number
}
```

Empty seats: add `empty: boolean` to each game's seat type (tournaments never set
it). Every engine loop that skips `out` seats must also skip `empty` seats — grep
each engine and its view for `.out` and handle `empty` beside it. `viewFor` shows
empty seats as empty (no cards / dice / stack).

### 2.2 Engines

Add `format: TableFormat` to each config (default `'tournament'`, so today's tables
are unchanged) and export a `…CashOps`. **Tournament behaviour must not change:**
run `pnpm check:tables` and `pnpm sim:bots` (all three games, seed 1) before you
start and save the output; after Phase 2 the output must be identical.

| Engine | Cash config | Changes |
|---|---|---|
| `games/holdem` | `holdemCashConfig(seats, [sb, bb])`: `blinds: [[sb, bb]]`, `handsPerLevel: Infinity`, `startingStack: 0`, `format: 'cash'`; `createHoldem` makes every seat `empty` when the format is cash | `isOver` never true in cash. `standings` returns `[]`, `placeOf` returns null, no `busts`. A seat at 0 chips is skipped by `startHand` (not "busted"). A seat with `newcomer: true` posts the big blind in addition to the normal blinds (as a live bet, so it can check if nobody raises) and the flag clears. `needsAdvance` is false while fewer than 2 seats have chips (the runner fills seats first). `HoldemView` gets `format`. |
| `games/liars-dice` | New file `games/liars-dice/cash.ts`: `LiarsCashState { config: { seats, ante, dicePerSeat: 5 }; stacks: number[]; empty: boolean[]; antes: number[]; game: LiarsState \| null; seatMap: number[]; games: number }` | Wrap the existing engine, don't change it. `advance` between games: take `min(ante, stack)` from every seat with chips into `antes`, build `createLiars(liarsConfig(n))` for those seats (`seatMap` maps inner seats to table seats) and do its first roll; during a game, `toAct` / `apply` / `viewFor` / `advance` delegate to the inner engine through `seatMap`; when the inner game is over, pay out `settleLiarsPot(antes, winner)`, clear `antes`, set `game: null`. The pot shown is the sum of `antes`. `leaveAction` removes the seat's dice from the inner game (add a small pure `removeSeat(state, seat)` to the inner engine). |
| `games/blackjack-showdown` | `showdownCashConfig(seats, minBet, maxBet \| null)`: `hands: Infinity`, `format: 'cash'`; seats start `empty` | `showdownMinBetForHand` returns the config min in cash; `secretBets` always false; never over; no standings. Shoe reshuffles by the existing cut-card rule. Legal bets: `[minBet, maxBet ?? stack]`, or exactly `stack` when `stack < minBet`. A double with too few chips doubles for the rest of the stack. A seat at 0 chips gets no betting turn. |

Liar's Dice short-ante rule, exactly: the winner `w` takes `min(antes[j], antes[w])`
from every player `j` (their own ante included), and every player `j` gets back
`antes[j] − min(antes[j], antes[w])`. So a winner who anted less than the others wins
only their own ante's worth from each; when everyone anted the full ante, the
winner takes the whole pot. Put it in one pure
`settleLiarsPot(antes: number[], winner: number): number[]` (payout per seat; the
payouts sum to the antes) with `check:tables` cases.

### 2.3 Table defs (`lib/tables/defs.ts`)

```ts
export interface CashTableDef<S, V, A> extends TableDef<S, V, A> {
  ops: CashTableOps<S>
  /** An empty table at this stake (every seat empty). */
  createCash: (seats: number, stake: CashStake) => S
}
export const holdemCashDef, liarsCashDef, showdownCashDef
export const CASH_DEFS: Record<TableGameName, CashTableDef<any, any, any>>
```

The Liar's Dice cash view type is the inner `LiarsView` plus `{ pot, stacks, ante, games }`;
the bot policy only reads the inner part.

### 2.4 Stakes and catalog

`lib/tables/stakes.ts`:

```ts
export type CashStakeId = 'low' | 'mid' | 'high'
export interface CashStake {
  id: CashStakeId
  label: string   // 'Low stakes' | 'Mid stakes' | 'High stakes'
  /** Hold'em [sb, bb]; Liar's Dice ante; Blackjack [min, max | null]. */
  limits: { blinds?: [number, number]; ante?: number; bets?: [number, number | null] }
}
export const CASH_STAKES: Record<TableGameName, CashStake[]>   // the table in 1.1
export function limitsLabel(game: TableGameName, stake: CashStake): string
// '5 / 10' · 'Ante 50' · 'Bets 10–500' · 'Bets from 1,000'
export const BOT_SIT_RANGE = { holdem: [40, 200], 'liars-dice': [5, 25], 'blackjack-showdown': [20, 100] } // in units of bb / ante / min bet
export const CHURN = { leaveWhenUp: 0.06, leaveWhenUpGame: 0.15, leaveAny: 0.01, leaveAnyGame: 0.03, topUp: 0.5, refillAfter: [1, 3] }
```

`lib/tables/catalog.ts`: add `cash: { label: string; sub: string; format: string }` to
`TableGameEntry`:

| Game | cash.label | cash.sub | cash.format |
|---|---|---|---|
| holdem | Texas Hold'em | No-limit cash table, bring your own stack | Play until you leave or run out of chips |
| liars-dice | Liar's Dice | Ante each game, last cup standing takes the pot | (same) |
| blackjack-showdown | Blackjack | Play the house at a shared table | (same) |

Also change Hold'em's tournament `sub` "No-limit Sit & Go against five bots" →
"No-limit tournament against five bots".

### 2.5 Store (`store/tables-store.ts`)

`OpenTable` gains `format: TableFormat` and, for cash, `stake: CashStakeId`,
`broughtIn: number` (first sit + top ups), `stack: number` (chips behind, synced),
`hands: number`. Tournament tables keep using `tier` / `buyIn`; give those fields
dummy values for cash (`tier: 'rookie'`, `buyIn: 0`) or make them optional — pick
optional and fix the call sites `tsc` points at.

New actions (tournament actions unchanged):

- `sitDownCash(game, stake, amount, seats)` — `1 ≤ amount ≤ wallet`, no open table;
  `wallet −= amount`; opens with `stack = broughtIn = amount`, `hands = 0`.
- `syncCashStack(stack, hands)` — writes `open.stack` / `open.hands`.
- `topUp(amount)` — `1 ≤ amount ≤ wallet`; wallet → `broughtIn` and `stack`.
- `cashOut()` — `wallet += open.stack`, `peakWallet` updated, closes the table,
  writes the record and the stats, sets `lastCashResult`.
- `refill` unchanged.

```ts
interface CashSessionRecord { id: string; game: TableGameName; stake: CashStakeId; broughtIn: number; cashedOut: number; hands: number; endedAt: string }
interface CashGameStats { sessions: number; hands: number; net: number; bestSession: number | null; worstSession: number | null }
cashStats: Record<TableGameName, CashGameStats>
cashHistory: CashSessionRecord[]      // newest first, 40 kept
lastCashResult: CashSessionRecord | null
dismissCashResult: () => void
```

`persist` merge: fill `cashStats` / `cashHistory` / `lastCashResult` for old saves,
and give an old `open` without `format` the value `'tournament'`.

Lobby mount (today it forfeits a seated table and refunds an unseated one): an
open **cash** table is **cashed out**, whether seated or not.

### 2.6 Runner (`components/tables/use-table-runner.ts`)

Keep one runner; add an optional `cash` option:

```ts
cash?: {
  ops: CashTableOps<S>
  stake: CashStake
  humanStack: number                 // what the human sits down with
  onHumanStack: (stack: number, hands: number) => void
}
```

- **Opening.** Create with `def.createCash`, then `ops.sit` the human at seat 0
  (`newcomer: false`) and each starting bot (`newcomer: false`) with its `sitStack`.
- **Bots become state** (`useState<(Bot | null)[]>`), since seats change; create a
  `BotMind` for each new seat (`createMind`) and load its opponent memory the same
  way. Memory key: `${memoryKey}:${format}:${profile.id}`.
- **Churn step.** When `ops.betweenHands(state)`, before `advance`: run 1.4 with the
  table RNG (stand, sit with `newcomer: true`, top up), log arrivals / departures,
  then `advance`.
- **Human stack sync.** After every state change, when `ops.stackBehind(state, 0)` or
  `ops.handsPlayed(state)` changed, call `onHumanStack`.
- **Leave.** `leave()`: Hold'em / Liar's Dice: if `ops.inPlay`, apply
  `ops.leaveAction`; then `ops.stand` and resolve with the stack. Blackjack: set
  `leaving`, answer every remaining human decision with stand, and stand up at settle.
- **Top up.** `topUp(amount)` → `ops.addChips` when `ops.betweenHands`.
- **Bust.** When the human's stack is 0 between hands, expose `broke: true`; the
  runner doesn't advance past the human's empty-stack seat (it is skipped by the
  engines anyway) — the table keeps playing among bots until the human tops up or leaves.
- Cash returns no `place` / `standings` / `watching`.

### 2.7 Pages and UI

**Hub `app/tables/page.tsx`:** two lines explaining Tournaments and Cash tables; the
figure strip shows wallet, tournament net and cash net.

**Lobby `app/tables/lobby/page.tsx`:** a category radiogroup at the top, same style
as the stakes radiogroup: **Tournaments · Cash tables** (remember it in
localStorage, key `floored-tables-format`, wrapped in try/catch like the tier).

- Tournaments: unchanged.
- Cash tables: stakes radiogroup Low / Mid / High (each card shows the three games'
  limits in one line, e.g. "5/10 · ante 50 · bets 10–500"); the three game tiles
  with `catalog.cash` labels; **Sit down** opens a dialog (`components/ui/dialog`)
  "Bring chips to the table": amount field with stepper, pills **¼ · ½ · All** of
  the wallet (the dock pill style), preset to All, the stake's limits line, and
  **Sit down** (disabled only when the amount is 0 or above the wallet).
- Banner for `lastCashResult`: "Left the Hold'em table `+460` after 37 hands" (felt)
  or "`−300`" (loss), with **dismiss**.

**Table page `app/tables/[game]/page.tsx`:** same route. A cash `open` renders the
game's table with `format="cash"`; a seated cash table on a revisit is cashed out
and you go back to the lobby. No "Play again" for cash.

**Table components:** keep one component per game, branched on `table.format`.

- `TableShell` gets `format`. Cash: status bar "`Stake label` · `limits`", corner
  button **Leave table** (confirm texts in 1.2 when in play), no result overlay. On
  leaving, a short session panel ("Brought 1,000 · leaving with 1,460 · +460 in 37
  hands", `signed` / `toneOf`), then the lobby.
- Session strip (status bar right side on wide screens, under the board's badge band
  on phones): brought in · stack · net, `num`, net in felt / loss.
- Dock between hands: **Top up** (`GAME_DOCK_SECONDARY_BTN`) opening the same dialog.
  At stack 0 the dock shows **Top up** (primary) and **Leave table**.
- Seats (`components/tables/seat.tsx`): an `empty` state — dashed outline, "Empty",
  no stack; arrival `g-pop`, departure `g-clear` (both in the motion kit with
  reduced-motion rules).
- Hold'em: fixed blinds in place of the level clock.
- Blackjack: no standings strip or "hand n of 12"; bet controls use the stake's
  limits (High: max = your stack).
- Liar's Dice: pot and game number on the felt; at game end the pot slides to the
  winner (felt glow), returned excess slides back, then the next ante.

**Account page `app/account/page.tsx`:** the Tables records add "Cash net" and
"Cash sessions".

### 2.8 Bots (`lib/bots/`)

- **Hold'em:** short-stack push / fold is a tournament tool. In cash
  (`view.format === 'cash'`) switch to push / fold only under 10 big blinds
  effective. Everything else unchanged.
- **Blackjack:** in cash, play basic strategy only (no standings-driven deviations)
  and size bets per style, clamped to the stake: rock / nit the minimum; regular
  2–4% of stack; maniac / trickster 5–10%, ×1.5 after a win; station a flat 3%.
  Round to the table's minimum unit.
- **Liar's Dice:** unchanged inside a game.

### 2.9 Tutorials (`lib/tables/tutorials.ts`)

Add `TABLES_CASH_STEPS`: "Sit down with any amount from your wallet", "Play as long
as you like", "Top up between hands", "Leave any time: your stack goes back to the
wallet", "Out of chips ends your session". Add `cash.notes` per game with the
limits and the 1.3 rule (Hold'em: newcomers post a big blind; Liar's Dice: ante
per game, short antes get excess back; Blackjack: house edge ~1%). The rules page
`app/how-to-play/tables/[game]/page.tsx` shows Tournament and Cash table sections.

### 2.10 Checks

- `pnpm check:tables` adds, per engine: chip conservation across sit / stand / top
  up / churn (Hold'em and Liar's Dice: stacks + pot = total brought in; Blackjack:
  stacks + house net = total brought in), empty seats never act, a newcomer posts
  one big blind, `settleLiarsPot` cases (one short stack, two short stacks, winner
  short), a stack of 0 never antes or bets, a blackjack bet below the minimum only
  as the whole stack, leaving mid-hand folds / gives up dice correctly.
- `pnpm sim:bots [game] [tables] --cash [--stake low|mid|high]`: bot-only sessions
  of 300 hands (Liar's Dice: 40 games) with churn; print win rate by skill
  (Hold'em big blinds per 100 hands, Liar's Dice antes per game, Blackjack house
  edge ≈ 1%), illegal actions (must be 0), churn counts; and the tournament output
  on seed 1 unchanged.
- Browser: each cash table at 1440×900, 1280×720, 390×844, 150% zoom and Motion =
  reduced; leave in play; reload mid-hand (stack correct in the lobby); top up;
  play to 0.
- `npx tsc --noEmit`, `pnpm lint` (known errors in `CLAUDE.md`).

---

## 3. Phases (one commit each)

| Phase | What | Done when |
|---|---|---|
| 1 | Design and owner answers | **Done** (this file) |
| 2 | **Partial:** types, empty seats, cash configs/ops, `games/liars-dice/cash.ts`, `settleLiarsPot` and cash defs are in place. | Cash checks and regression comparison still needed. |
| 3 | Not started: bot churn and `sim:bots --cash`. | Zero illegal actions; section 4 filled in. |
| 4 | **Partial:** stakes, catalog and persisted wallet/session store are implemented. | Cash tutorials and old-save validation still needed. |
| 5 | **Partial:** lobby category/dialog, shell, and initial runners for all three boards are implemented. | Churn, top-up/leave behavior, session UI and browser checks remain. |
| 6 | Not started. | Docs match the code. |

Update this file's status line and section 4 as phases land.

---

## 4. Results (fill in during Phase 3)

| Game | Stake | Rookie | Regular | Shark | Notes |
|---|---|---|---|---|---|
| Hold'em (bb/100) | | | | | |
| Liar's Dice (antes/game) | | | | | |
| Blackjack (house edge) | | | | | |

---

## 5. Owner decisions (2026-10-30)

1. **Names:** "Cash tables" for the new category, "Tournaments" for today's.
2. **Bankroll:** unlimited — sit down with any amount, no maximum; play until you
   leave or reach 0. Top up by any amount.
3. **Table limits:** as in 1.1 (×10 per level).
4. **Wallet:** one Tables wallet for both categories.
5. **Hold'em newcomers:** post a big blind and play at once.
6. **Liar's Dice:** 5 dice each, as in tournaments.
7. **Rejoin:** leaving ends the session.
8. **Bot bankrolls:** unlimited.
9. **Tournament buy-ins:** 100 / 1,000 / 10,000 (done on this branch).
