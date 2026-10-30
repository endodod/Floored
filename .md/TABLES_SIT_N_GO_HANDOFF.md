# Tables: Sit n Go category — handoff

Status as of 2026-10-30: **planned, nothing built.** Branch `claude/new-games-handoff`.

## What the owner asked for

A second category inside the **Tables** mode, next to today's tables, called
**Sit n Go**: the same three games (Hold'em, Liar's Dice, Blackjack Showdown), but
players **join with chips from their own bankroll** (the Tables wallet) instead of
a fixed buy-in, and there are **no prize pools or paid places**. You sit down
with an amount you choose, play as long as you like, and leave with whatever is
in front of you.

> **A naming note for the owner (open question 1).** In poker, "Sit & Go" means a
> fixed-buy-in tournament, which is what Tables already is (the Hold'em catalog
> line even says "No-limit Sit & Go"). What is asked for here is what poker calls
> a **cash table**. This file uses **Sit n Go** for the new category, as asked,
> and calls today's category **Tournaments**. Every user-facing string is in
> `lib/tables/catalog.ts` / `lib/tables/stakes.ts` / `lib/tables/tutorials.ts`,
> so a rename later is cheap. Internally the code uses the format id `'cash'`
> (and `'tournament'` for today's tables), so the code stays right whichever
> label wins.

Read first: [BOT_TABLES_HANDOFF.md](BOT_TABLES_HANDOFF.md) (how Tables is built),
[ARCHITECTURE.md](ARCHITECTURE.md), and the **Ground rules** in the bot-tables
handoff (bots decide only from their seat's view; engines pure with an injected
RNG). Nothing here touches `GameName`, Freeplay, Survival, Ladder or Daily.

---

## 1. How Sit n Go plays (all three games)

| | Tournaments (today) | Sit n Go (new) |
|---|---|---|
| Entry | Fixed buy-in per stake (100 / 1,000 / 10,000) into a prize pool | **Any amount you like** from the wallet, no maximum (default: the whole wallet) |
| Chips at the table | Tournament chips (1,500 / 1,000 / 5 dice) | **Your real wallet chips** |
| Ends | When your place is decided | **When you leave, or when you are out of chips** (stack 0) |
| Pay | Prizes by place | **Your stack goes back to the wallet** when you leave |
| Leaving early | Forfeits the buy-in | **Allowed any time**; in a hand you fold first (see 1.2) |
| Opponents | Fixed for the table | Bots **come and go**: a busted or departing bot is replaced |
| Blinds / bets | Rise over time | **Fixed** for the stake |

### 1.1 Stakes (owner-decided: unlimited bankroll, play until out of chips)

The stake sets only the table's limits. **There is no buy-in range:** you bring
any amount from the Tables wallet (the dialog defaults to the whole wallet), as
little as one chip, and you play until you leave or have no chips left. Bots'
bankrolls are unlimited too (1.4).

Wallet stays as today: 10,000 start, refilled to 10,000 when it is below the
smallest tournament buy-in (100) and no table is open.

| Game | Stake | Table limits |
|---|---|---|
| Hold'em | Low | blinds 5 / 10 |
| Hold'em | Mid | blinds 50 / 100 |
| Hold'em | High | blinds 500 / 1,000 |
| Liar's Dice | Low | ante 50 a game |
| Liar's Dice | Mid | ante 500 |
| Liar's Dice | High | ante 5,000 |
| Blackjack | Low | bets 10 – 500 |
| Blackjack | Mid | bets 100 – 5,000 |
| Blackjack | High | bets 1,000 – no max (your stack) |

The three levels follow the tournament buy-ins (100 / 1,000 / 10,000): each step
is ×10. Blackjack's High table has no maximum bet; Low and Mid keep one so a
small table stays a small table. Nothing is disabled by the wallet: a short stack
just plays its chips all in (1.2).

### 1.2 Leaving, busting, topping up

- **Leave** (the corner "← Tables" button, renamed **Leave table** in Sit n Go):
  - Between hands / games: you leave at once with your whole stack.
  - In a Hold'em hand you are still in: confirm dialog "You fold this hand and
    leave with `stack`". Chips you already put in this hand stay in the pot.
  - In a Blackjack hand: your bet is already placed; leaving mid-hand plays the
    hand out by the timeout action (stand) and you leave when it settles.
    Simpler and fair: the dialog says "You stand and leave after this hand".
  - In a Liar's Dice game: the ante is in the pot; leaving forfeits your dice
    (you are out of that game) and you leave with the rest of your stack.
- **Closing the tab** counts as leaving at that moment, with the same rules: the
  store always holds your current chips behind (section 3), so a reload returns
  exactly that to the wallet. No way to dodge a hand by closing the tab.
- **Out of chips:** the session ends only at **stack 0**. Until then a short
  stack always plays (the all-in rules below). At 0 a panel offers **Top up**
  (from the wallet) or **Leave**.
- **Short stacks (all in for less):**
  - Hold'em: standard all in for less, side pots (the engine already does this);
    a stack smaller than the blind posts what it has.
  - Liar's Dice: a stack smaller than the ante antes all it has. It can win at most
    that much from each other player; the rest of each bigger ante goes back to its
    owner at the end of the game (a side pot, one level deep).
  - Blackjack: below the table minimum you may bet your whole stack; a double with
    too few chips doubles for what you have.
- **Top up** between hands / games: add any amount from the wallet, no maximum.
  Not allowed during a hand.

### 1.3 Per game

**Hold'em (cash).** The existing engine with fixed blinds, no levels and no
"last player wins". 6 seats (4 on phones, as today). Button moves as usual; a
seat that joins between hands waits for the big blind or posts one to come in
straight away (owner question 4; proposal: **posts a big blind** to keep it
simple). No rake.

**Liar's Dice (cash).** A session is a run of short **games**. Each game: every
seated player antes the stake into the pot, then a normal game of Liar's Dice is
played with the existing rules; the **last player with dice takes the whole
pot**. Between games players may leave, top up, and bots come and go. Dice per
player: 5 as today (owner question 5: 3 for faster games). A player short of the
ante antes all it has (1.2); a player with 0 chips sits out (the human gets the
Top up / Leave panel).

**Blackjack (cash).** The Showdown table without the tournament: every seat
plays its own hand against the house dealer from a shared shoe, every hand, for
as long as it likes. Bet between the stake's min and max each hand; 3:2
blackjack (2.5× return), double on two cards, no split, dealer hits ≤ 16 —
exactly the Showdown rules. **No 12-hand limit, no rising minimum, no secret
final bet, no standings.** The house pays wins, so this is the one Sit n Go game
with a house edge (~1%, the solo Blackjack figure in `BALANCE_AUDIT.md`). The
catalog label in this category is **Blackjack** (sub "Play the house at a shared
table"), since "Showdown" names the tournament.

### 1.4 Bots at a Sit n Go table

- Seated at start like today (`seatBots(count, rng)` from the table seed), each
  with a random skill and a stack of 40–200 big blinds (Hold'em), 5–25 antes
  (Liar's Dice) or 20–100 minimum bets (Blackjack), drawn uniformly and rounded
  to that unit. Bots' bankrolls are unlimited: these numbers only set what a bot
  brings to this seat.
- **Churn** (between hands / games only, all from the table RNG so a seed
  replays): a bot with no chips leaves; a bot up
  more than 2× its buy-in leaves with probability 0.06 a hand (0.15 a game in
  Liar's Dice); any bot leaves with probability 0.01 a hand. An empty seat is
  filled after 1–3 hands (games) by a new bot from the roster not already at the
  table, with a fresh skill and buy-in. Bots top up to their buy-in when below
  half of it, with probability 0.5.
- Never more bots than seats; the table never empties below 2 bots (if it would,
  fill a seat at once).
- Bots have unlimited bankrolls; only the human's chips are tracked.
- The seat strip shows arrivals and departures in the hand history:
  "Mara sits down with 860", "Theo leaves with 2,140".

---

## 2. Code plan

### 2.1 Types (`lib/tables/types.ts`)

```ts
export type TableFormat = 'tournament' | 'cash'

/** Cash-table operations, applied only between hands (or games). All pure. */
export interface CashTableOps<State> {
  /** Between hands / games: seats may change now. */
  betweenHands: (state: State) => boolean
  /** Put a player in an empty seat with `stack` chips. Throws if the seat is taken. */
  sit: (state: State, seat: number, stack: number) => State
  /** Empty a seat; returns the state and the chips the seat leaves with. */
  stand: (state: State, seat: number) => { state: State; stack: number }
  /** Add chips to a seated player (top up). */
  addChips: (state: State, seat: number, amount: number) => State
  /** Chips in front of a seat that are not in a pot right now (what leaving takes away). */
  stackBehind: (state: State, seat: number) => number
  /** True when the seat is in a hand / game right now (leaving needs the fold / forfeit rule). */
  inPlay: (state: State, seat: number) => boolean
  /** The fold / stand / forfeit a seat makes when it leaves in play. */
  leaveAction: (state: State, seat: number) => State
  /** Seats that are empty. Any seat with chips plays the next hand (short stacks go all in, 1.2). */
  emptySeats: (state: State) => number[]
}
```

Seats become **nullable** in cash play: an empty seat is a seat with `empty: true`
(add the field to each game's seat type; tournament tables never set it). Every
engine loop that walks seats must skip empty seats exactly as it skips `out`
seats; grep each engine for `.out` and handle `empty` next to it. `viewFor` shows
empty seats as empty.

### 2.2 Engines

Add a `format` to each config (`'tournament'` default, so today's tables are
unchanged), and the cash ops. **Today's tournament behaviour must not change:**
`pnpm check:tables` and `pnpm sim:bots` must give the same results on the same
seeds before and after.

| Engine | Cash config | Changes |
|---|---|---|
| `games/holdem` | `holdemCashConfig(seats, [sb, bb])`: `blinds: [[sb, bb]]`, `handsPerLevel: Infinity`, `startingStack: 0` (seats start empty), `format: 'cash'` | `isOver` is never true in cash. `out` (no chips) means "waiting for a top up or to leave", not "busted from the tournament"; no busts / standings in cash (`standings` returns `[]`, `placeOf` null). `startHand` skips empty seats and seats with 0 chips; a seat that joined since the last hand posts the big blind (flag `newcomer` cleared after it posts). `advance` needs ≥ 2 seats with chips; otherwise it waits (`needsAdvance` false) and the runner fills seats. `HoldemView` gets `format`. |
| `games/liars-dice` | `liarsCashConfig(seats, ante)`, `format: 'cash'` | Wrap, don't rewrite: a cash state holds `stacks`, `pot`, `ante`, `game: LiarsState | null` and a `games` counter. `advance` between games takes the antes (a short stack antes all it has; keep the excess of each bigger ante aside and return it after the game, 1.2) from every seat with chips, starts a fresh `LiarsState` for those seats (`createLiars` + the existing first roll), and when that game is over pays the pot to the winner. `toAct` / `apply` / `viewFor` delegate to the inner game, mapping seat numbers. Put it in `games/liars-dice/cash.ts`. |
| `games/blackjack-showdown` | `showdownCashConfig(seats, minBet, maxBet | null)`: `hands: Infinity`, fixed `minBet`, `format: 'cash'` | No rising min bet (`showdownMinBetForHand` returns the config min in cash), no secret final hand (`secretBets` false), never over, no standings. Shoe reshuffles at the existing cut-card rule. A seat below `minBet` may bet only its whole stack (legal bets: `[minBet, maxBet ?? stack]` or exactly `stack` when `stack < minBet`); a double with too few chips doubles for the rest of the stack. |

Each engine exports a `…CashOps: CashTableOps<State>`.

### 2.3 Table defs (`lib/tables/defs.ts`)

```ts
export interface CashTableDef<S, V, A> extends TableDef<S, V, A> {
  ops: CashTableOps<S>
  createCash: (seats: number, stake: CashStake) => S
}
export const holdemCashDef, liarsCashDef, showdownCashDef
```

### 2.4 Stakes and catalog (`lib/tables/stakes.ts`, `lib/tables/catalog.ts`)

```ts
export type CashStakeId = 'low' | 'mid' | 'high'
export interface CashStake {
  id: CashStakeId
  label: string          // 'Low stakes' …
  /** Hold'em [sb, bb]; Liar's Dice ante; Blackjack [min, max | null] bet (null = no max). */
  limits: { blinds?: [number, number]; ante?: number; bets?: [number, number | null] }
}
export const CASH_STAKES: Record<TableGameName, CashStake[]>   // the table in 1.1
export function limitsLabel(game, stake): string               // '5 / 10', 'Ante 50', 'Bets 10–500', 'Bets from 1,000'
```

Catalog: give `TableGameEntry` a `cash: { label: string; sub: string; format: string }`
block (Blackjack's cash label is "Blackjack"; Hold'em's sub "No-limit cash table,
bring your own stack"; Liar's Dice "Ante each game, last cup standing takes the pot").
Change Hold'em's tournament `sub` from "No-limit Sit & Go against five bots" to
"No-limit tournament against five bots" so the two categories don't share a name.

### 2.5 Store (`store/tables-store.ts`)

`OpenTable` gains:

```ts
format: TableFormat
/** Cash only. */
stake?: CashStakeId
/** Cash only: chips brought in total (first sit + top ups). */
broughtIn?: number
/** Cash only: chips behind right now, synced on every change (see 1.2). */
stack?: number
hands?: number
```

New actions (tournament actions unchanged):

- `sitDownCash(game, stake, amount, seats)` — takes `amount` from the wallet
  (1 ≤ amount ≤ wallet; no other limit), opens the table with
  `stack = broughtIn = amount`.
- `syncCashStack(stack, hands)` — called by the table on every state change that
  moves the human's chips behind. Writes `open.stack`.
- `topUp(amount)` — wallet → `broughtIn` and `stack`; any amount up to the wallet.
- `cashOut()` — `wallet += open.stack`, closes the table, writes a
  `CashSessionRecord` and the stats.
- `refill` unchanged (wallet below `MIN_BUY_IN`, no open table).
- On the lobby's mount (today's forfeit logic): an open **cash** table is
  **cashed out** (`cashOut()`), never forfeited.

Records and stats, separate from tournament stats so neither muddles the other:

```ts
interface CashSessionRecord { id; game; stake; broughtIn; cashedOut; hands; endedAt }
interface CashGameStats { sessions: number; hands: number; net: number; bestSession: number | null; worstSession: number | null }
cashStats: Record<TableGameName, CashGameStats>
cashHistory: CashSessionRecord[]   // newest first, 40 kept
```

`persist` merge must fill `cashStats` / `cashHistory` for existing saves, and give
an old `open` (no `format`) `format: 'tournament'`.

`lastResult` becomes a union (`{ kind: 'tournament', record } | { kind: 'cash', record }`)
or a second field `lastCashResult`; pick one and update the hub banner.

### 2.6 Runner (`components/tables/use-table-runner.ts`)

Keep one runner. Add an optional `cash?: { ops; stake; onHumanStack(stack, hands); churn }`:

- **Churn step.** When `ops.betweenHands(state)` and before `advance`, run the bot
  churn from 1.4 with the table RNG (stand / sit / top up bots), then `advance`.
  Bot list becomes state (`useState<(Bot | null)[]>`), not a memo, since seats
  change; minds are created for new seats (`createMind`) and their opponent
  memory loads the same way.
- **Human stack sync.** After every state change, if `ops.stackBehind(state, human)`
  or the hand count changed, call `onHumanStack`.
- **Leave.** `leave()`: if `ops.inPlay(state, human)`, apply `ops.leaveAction`;
  then `ops.stand` and return the stack. Blackjack: set a `leaving` flag and stand
  after the hand settles (1.2).
- **Top up.** `topUp(amount)` → `ops.addChips` between hands only.
- No `place` / `standings` / `watching` in cash.

### 2.7 Pages and UI

**Hub (`app/tables/page.tsx`).** The intro explains both categories in two
lines; the figure strip shows wallet, tournament net and Sit n Go net.

**Lobby (`app/tables/lobby/page.tsx`).** A category switch at the top, styled as
the existing stakes radiogroup: **Tournaments · Sit n Go** (remember it in
localStorage like the tier, key `floored-tables-format`). Under it:

- Tournaments: unchanged.
- Sit n Go: a stakes radiogroup Low / Mid / High (each card shows the game's
  limits once a game is focused, or "Blinds from 5 / 10" generic), the three game
  tiles (labels from `catalog.cash`), and on a tile's **Sit down**, a dialog
  (`components/ui/dialog`) "Bring chips to the table": an amount field with a
  stepper, pills **¼ · ½ · All** of the wallet (styled with the dock pill
  classes), preset to **All**, the limits line, and **Sit down**. Nothing is
  disabled: any amount from 1 to the wallet plays.
- Last-result banner for a cash session: "Left the Hold'em table up `+x`" /
  "down `−x`", with hands played.

**Table page (`app/tables/[game]/page.tsx`).** Same route. If `open.format ===
'cash'`, render the game's cash table; a revisit of a seated cash table cashes
out and returns to the lobby (never forfeit). "Play again" is not offered for
cash.

**Table components.** Keep one component per game and branch on `table.format`
(the board is the same felt; most differences are in the shell and dock):

- `TableShell` gets a `format` prop. Cash: status bar "Low stakes · 5 / 10",
  corner button **Leave table**, no result overlay; on leaving show a short
  session panel ("You brought 1,000 · leaving with 1,460 · +460 in 37 hands",
  `signed` / `toneOf`), then back to the lobby. A confirm dialog when leaving in
  play (texts in 1.2).
- A **session strip** on the felt edge or in the status bar: brought in, stack,
  net (`num`, felt / loss tone).
- Dock: between hands, a **Top up** secondary button
  (`GAME_DOCK_SECONDARY_BTN`) opening the same chips dialog (up to the wallet).
- Seats: an empty seat shows a dashed `seat` outline with "Empty"; a bot sitting
  down uses `g-pop`, leaving `g-clear` (both already in the motion kit with
  reduced-motion rules).
- Hold'em: no blind-level clock in cash; show the fixed blinds.
- Blackjack cash: hide the standings strip and the "hand n of 12"; the bet dock
  uses the stake's min / max.
- Liar's Dice cash: show the pot and the game number; after a game, the winner's
  pot slides to their seat (felt glow), then the next ante.

### 2.8 Bots (`lib/bots/`)

- **Hold'em:** today's short-stack push / fold is a tournament tool. In cash
  (`view.format === 'cash'`), push / fold only when the effective stack is under
  10 big blinds (it is a chip-EV decision, not survival). Everything else stays.
- **Blackjack:** playing decisions use basic strategy only (drop the
  standings-driven deviations); bet sizing becomes per-profile and stack-based:
  rock / nit bet the min, regular 2–4% of stack, maniac / trickster 5–10%
  with swings after wins, station flat bets. Clamp to the stake.
- **Liar's Dice:** unchanged inside a game.
- Opponent memory keys get the format: `${memoryKey}:${format}:${profile.id}`, so
  cash reads don't bleed into tournament reads.

### 2.9 Tutorials (`lib/tables/tutorials.ts`)

Add a `TABLES_CASH_STEPS` (sit down with an amount, play as long as you like,
leave any time, top up between hands, no prizes: your stack is your result) and
a `cash` note list per game (the limits and the per-game rule from 1.3). The
rules page `/how-to-play/tables/[game]` shows both formats under two headings.

### 2.10 Simulation and checks

- `pnpm check:tables`: add cash checks per engine — chip conservation across
  sit / stand / top up / churn (sum of stacks + pots = chips brought in total
  for Hold'em and Liar's Dice; Blackjack tracks house net separately), empty seats
  never act, a newcomer posts the big blind once, a short ante wins at most its own
  size from each player and the excess goes back, a stack of 0 never antes or bets,
  a blackjack bet below the minimum is allowed only as the whole stack.
- `pnpm sim:bots [game] [tables] --cash [--stake low|mid|high]`: bot-only cash
  sessions of N hands with churn on; report hands per hour equivalent, bot win
  rates by skill in big blinds per 100 hands (Hold'em), antes won per game
  (Liar's Dice), house edge (Blackjack, expect ≈ 1%), illegal actions (must be 0),
  and that tournament results on the same seeds are unchanged.
- Browser: the three cash tables at 1440×900, 1280×720, 390×844, 150% zoom,
  reduced motion; leave in play; reload mid-hand; top up; bust.

---

## 3. Phases (one commit each, owner sign-off after Phase 1)

| Phase | What | Done when |
|---|---|---|
| 1 | Owner answers the open questions; update sections 1.1–1.4 | Answers written into this file |
| 2 | Types, cash configs and ops in the three engines, cash wrapper for Liar's Dice, defs | `check:tables` cash checks pass; tournament seeds unchanged |
| 3 | Bot changes and `sim:bots --cash` | Zero illegal actions; numbers recorded in section 4 |
| 4 | Store, stakes, catalog, tutorials | `tsc` / lint clean; old saves load |
| 5 | Lobby category switch, sit-down dialog, table shell and the three cash tables | Browser checks in 2.10 pass |
| 6 | Docs: `README.md` Tables section, `ARCHITECTURE.md` Tables row, `BOT_TABLES_HANDOFF.md` status, `BALANCE_AUDIT.md` Tables section (stakes, blackjack edge), `TODO.md` | Docs match the code |

---

## 4. Results (fill in during Phase 3)

| Game | Stake | Rookie | Regular | Shark | Notes |
|---|---|---|---|---|---|
| Hold'em (bb/100) | | | | | |
| Liar's Dice (antes/game) | | | | | |
| Blackjack (house edge) | | | | | |

---

## 5. Open questions for the owner

1. **Names.** Keep "Sit n Go" for the bring-your-own-bankroll tables and call
   today's tables "Tournaments"? Or "Cash tables" for the new category and keep
   "Sit & Go" for today's? (Recommendation: **Tournaments** and **Cash tables**,
   the poker terms; the code uses `'tournament'` / `'cash'` either way.)
2. **Stakes — decided:** unlimited bankroll (bring any amount, no max), play until
   out of chips. Still to confirm: the table limits in 1.1 (×10 per level, matching
   the 100 / 1,000 / 10,000 tournament buy-ins).
3. **Separate wallets?** Proposal: one Tables wallet for both categories.
4. **Hold'em newcomers:** post a big blind to join at once (proposal), or wait
   for the big blind to reach them?
5. **Liar's Dice dice count** in cash: 5 (as today) or 3 for quicker games?
6. **Rejoin:** leaving always ends the session (proposal). A "sit back down at the
   same table" option could come later.
7. **Bot bankrolls — decided:** unlimited, so a table never runs out of opponents.
