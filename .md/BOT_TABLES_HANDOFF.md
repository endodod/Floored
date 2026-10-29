# Bot Tables — handoff

Branch: `claude/bot-tables` (from `main` at `fd5f83b`).
TODO item: "New mode → Multiplayer casino games against bots (e.g. poker)".
Working name for the mode: **Tables** (open question 1).

## What the owner asked for

1. **Design the games first**: poker plus two more multi-player casino games,
   played against bots.
2. Then build a **fully fledged bot system**.
3. These games are their own mode. They **must not appear in Survival, Ladder
   or Daily** (nor Freeplay's lobby) for now.

Order matters: get the owner's sign-off on the designs (Phase 1) before writing
engines or bots.

## Ground rules

- Read `CLAUDE.md`, `.md/ARCHITECTURE.md` and `.md/GAME_REDESIGN_HANDOFF.md`.
  The tables use the same visual language as the redesigned boards: felt
  table, `playing-card.tsx`, casino chips, the motion kit (`g-*`), reduced
  motion, boards that fit every screen without scrolling.
- Play money only, like the rest of Floored.
- **Bots never cheat.** A bot decides from exactly what a human in its seat
  could see: its own hole cards / dice, the public board, bets and the action
  history. Engines expose a per-seat view; bots only ever receive that view.
- Engines stay pure (`games/<name>/engine.ts` pattern) and take an injected,
  seedable RNG (`utils/rng.ts`) so hands can be replayed and simulated.

## Isolation from the other modes

The table games are **not** `GameName`s. Adding them to that union would pull
them into `GAMES`, `GAME_REGISTRY`, the Freeplay lobby, `SURVIVAL_GAME_POOL`,
the daily generator and the Ladder picker. Instead:

| Piece | Where |
|---|---|
| Game ids | new `TableGameName` union (e.g. `store/types.ts` or `lib/tables/types.ts`) |
| Catalog / registry | `lib/tables/catalog.ts`, `lib/tables/registry.tsx` (own files, not `GAMES` / `GAME_REGISTRY`) |
| Engines | `games/holdem/`, `games/liars-dice/`, `games/blackjack-showdown/` |
| Bots | `lib/bots/` (core) + one policy per game |
| Routes | `app/tables/page.tsx` (hub), `app/tables/[game]/page.tsx` |
| State | `store/tables-store.ts` (wallet, stats, table in progress) |
| Feature flag | `TABLES_ENABLED` in `lib/features.ts` (off → entry points hidden, routes 404) |
| Entry points | navbar `MODES`, a `ModeRow` on the home page (`components/mode-select.tsx`) |
| Rules pages | own entries (e.g. `/how-to-play/tables/[game]` or a section on the hub) — `lib/game-tutorials.ts` is keyed by `GameName` |

`GameMode` gets a `'tables'` member only if a shared component needs it; the
table games have their own components, so prefer not to.

---

## Phase 1 — Game designs (owner sign-off first)

Three games, chosen so each tests a different skill and none duplicates a
solo game: **betting and bluffing** (Hold'em), **probability and bluffing
without cards** (Liar's Dice), **bet sizing against rivals' stacks** (Blackjack
Showdown).

Shared shape: the player sits at a table with bots, pays a **buy-in** from the
Tables wallet into a prize pool, and plays until the table is decided. Buy-in
tiers (e.g. 100 / 500 / 2,000) choose the stakes; bot difficulty can follow
the tier (Rookie → Regular → Shark) or be picked separately (open question 4).
No rake.

### 1. Texas Hold'em — Sit & Go

- **Table:** 6 seats — you + 5 bots (4-max on phones if 6 can't fit; open
  question 5).
- **Format:** Sit & Go. Everyone starts with the same tournament stack (e.g.
  1,500). Blinds rise every N hands (e.g. 10/20 → 15/30 → 25/50 …). Play until
  one player has every chip. Prize pool = 6 buy-ins, paid 65 % / 35 % to 1st /
  2nd. Busting out ends your session (watch or leave).
- **Rules:** No-limit Hold'em: blinds, two hole cards, pre-flop / flop / turn /
  river betting, showdown. Actions: fold, check, call, bet / raise (slider +
  presets: min, ½ pot, pot, all-in). Full **side-pot** handling for all-ins.
- **Engine needs:** a real 7-card evaluator with kickers and split pots
  (`games/poker-1p` only ranks a 5-card hand's category — reuse its labels, not
  its evaluator), dealer button rotation, blind schedule, side pots, per-seat
  view.
- **Board:** oval felt table, seats around the rail; each seat shows name,
  avatar, stack, last action and a turn timer ring; community cards centre;
  pot(s) as chip stacks; your cards large at the bottom. Showdown flips cards
  with the motion kit; winner's chips slide to them.

### 2. Liar's Dice

- **Table:** 4 players — you + 3 bots.
- **Format:** Buy-in to the pot; last player with dice wins it (open question:
  winner-takes-all vs 70 / 30).
- **Rules:** Each player has 5 dice under a cup. Players bid in turn on the
  total count of a face across *all* cups ("six 4s"); each bid must raise
  (more dice, or same count with a higher face). **1s are wild** for other
  faces; bidding on 1s halves the count (round up), leaving 1s doubles it plus
  one. Instead of bidding you may call **"Liar!"**: all cups lift; if the bid
  is short the bidder loses a die, otherwise the caller does. The loser of a
  round starts the next. Lose all your dice and you're out.
- **Engine needs:** bid ordering and validation incl. the wild-1 rules, reveal
  and count, die loss, turn order, per-seat view (own dice only).
- **Board:** cups around the felt (bots' cups closed with a die count),
  your dice visible in front of you, a bid ladder / picker (count × face), the
  bid history as a strip, the reveal counting matching dice with a glow.

### 3. Blackjack Showdown (tournament blackjack)

- **Table:** 4 seats — you + 3 bots — all playing against the same dealer and
  the same shoe.
- **Format:** Everyone starts with 1,000 tournament chips. **12 hands**; each
  hand everyone bets between a min and max (e.g. 10–500) and plays it out
  against the dealer. Most chips after hand 12 wins the pot. The owner approved
  winner-takes-all for the prize pool. Below the min bet → out.
- **Twist:** the **last hand bets are secret** (everyone commits face down,
  revealed together), so the leader can't simply mirror the chasers.
- **Rules:** standard Floored blackjack (3:2 blackjack, dealer hits ≤ 16, double
  on two cards, no split — matches `games/blackjack`), shared shoe, bets placed
  in seat order with everyone's bets visible except on the final hand.
- **Engine needs:** multi-seat round on a shared shoe; reuse
  `calculateHandValue` and the payout rules from `games/blackjack/engine.ts`,
  but the round logic is new (the solo engine is one seat and uses
  `Math.random`).
- **Board:** dealer at the top, four seat arcs below with each player's stack,
  bet chips and cards; a standings strip (rank, stack, hands left).

**Implementation status:** The owner approved the proposed Tables name, own
refillable wallet, Hold’em Sit & Go, buy-in difficulty tiers, forfeits on leave,
and winner-takes-all payouts for Blackjack Showdown and Liar’s Dice. Implemented
the independent Tables catalog/routes, persisted 10,000-chip wallet, all three
table engines and boards, per-seat hidden-information views, bot profiles and
policies, per-game account records, and `scripts/bots/simulate.cjs`. Buy-ins are
100 / 500 / 2,000. The simulation harness runs fixed-seed tables and checks chip
conservation, hand-rank categories, legal actions, and hidden-view boundaries.
TypeScript validation passes. The 10,000-table simulation completed with no
illegal actions and an average of 285 Hold’em actions; combined tournament wins
were 11,108 for Shark profiles and 10,359 for Rookie profiles. Responsive
browser checks remain pending. Production build is blocked in the local environment:
Next.js workspace-root discovery selects the parent user directory and build
fails on `EPERM` while resolving it.

The harness uses the repository's TypeScript compiler as a local CommonJS
loader, so it does not add `tsx` or another runtime dependency. Bots use names
and styles without chat or emotes. Hold’em currently uses six seats at all
viewport sizes; the phone fit check will determine whether to switch to four.

### Phase 1 deliverables

For each game: a short spec (rules, edge cases, numbers), a static mock of the
table in the redesign style (desktop, short laptop, phone), and the stake /
payout numbers. Put them in this file or `.md/tables/<game>.md`, then **ask
the owner to approve** before Phase 2.

---

## Phase 2 — Engines

Pure, multi-seat state machines with an injected RNG and a
`viewFor(state, seat)` that strips hidden information. Each engine exposes
`legalActions(state, seat)` and `apply(state, seat, action)`; illegal actions
throw. Turn order, timeouts (a human who stalls is auto-checked / folded) and
table end are engine concerns, not UI ones.

## Phase 3 — Bot system (`lib/bots/`)

A shared core plus one policy per game.

**Core**

- `BotProfile`: name, avatar, and style parameters — tightness, aggression,
  bluff rate, risk appetite, tilt (play worse after a big loss), plus a skill
  tier (**Rookie / Regular / Shark**) that scales how much noise is added to
  the policy's best answer.
- `BotPolicy<View, Action>`: `decide(view, mind, rng) → Action`. Gets only the
  seat's view.
- `BotMind`: per-table memory — opponent stats it has *observed* (how often
  the human plays hands, raises, bluffs, calls Liar), its own tilt state.
- Pacing: think time drawn per decision (short for easy spots, longer for big
  ones), so the table feels human; capped so play stays snappy.
- A roster of named bots with distinct styles (e.g. a rock, a maniac, a
  calling station, a solid regular) seated by tier.

**Policies**

- **Hold'em:** pre-flop hand ranges by position and profile; post-flop equity
  by Monte Carlo against the ranges it puts opponents on (move to a Web Worker
  if it blocks the UI), pot odds and stack-to-pot ratio, bet sizing families,
  board-texture-aware bluffing at the profile's rate, push / fold logic when
  short-stacked late in the Sit & Go.
- **Liar's Dice:** probability a bid is true from its own dice and the unknown
  count (binomial with wild 1s); bids that keep that probability above its
  risk threshold, bluffs at its bluff rate, calls Liar when the current bid is
  unlikely; reads the bid history (a player who keeps raising one face
  probably holds it).
- **Blackjack Showdown:** basic strategy for play; bet sizing from its
  position (leader protects, chasers swing big as hands run out), and a
  final-secret-bet strategy.

**Simulation harness**

A script (e.g. `scripts/bots/simulate`) that plays thousands of bot-only
tables per game with fixed seeds and reports: win rate by tier and style (a
Shark should beat Rookies clearly; styles should differ visibly), average
length, any illegal action, any decision made from hidden info (assert the
view). TypeScript engines need a runner — e.g. `tsx` as a dev dependency
(open question 6).

## Phase 4 — Mode shell and UI

- Hub `app/tables/page.tsx` in the Ladder / Survival / Daily pattern: intro
  (`StartPanel`, `HowItWorks`), wallet, game picker, stakes, stats rail.
- `app/tables/[game]/page.tsx` renders the table; leaving mid-table forfeits
  the buy-in (open question 7: or resume).
- Tables wallet (open question 2), stats per game (played, won, best finish,
  net), all in `store/tables-store.ts`, persisted like the other stores.
- Navbar entry + home `ModeRow`; `TABLES_ENABLED` flag.
- Rules page per game.
- Responsive and motion checks from the redesign handoff.

## Phase 5 — Balance and docs

Use the harness to tune bot tiers, blinds, hand counts and buy-ins; add a
"Tables" section to `.md/BALANCE_AUDIT.md`, the mode to `README.md` and
`.md/ARCHITECTURE.md`, and tick the TODO.

---

## Open questions for the owner

1. **Name** of the mode: "Tables", "Card Room", "Back Room", …?
2. **Wallet:** its own Tables wallet (e.g. 10K, refillable like Freeplay), or
   shared with the Freeplay balance?
3. **Hold'em format:** Sit & Go (proposed), or a cash table you can join and
   leave at any time, or both?
4. **Difficulty:** resolved to follow buy-in tiers.
5. **Phones:** 6-max Hold’em fit still needs a phone check; use 4-max if it
   cannot fit without scrolling.
6. **Tooling:** resolved without a new dependency using TypeScript's compiler.
7. **Leaving mid-table:** resolved to forfeit the buy-in; tables can be resumed
   while the player remains in the session.
8. **Bot personality:** resolved to distinct names and styles, without chat.
9. **Payout splits:** resolved to winner-takes-all for Liar's Dice and Blackjack
   Showdown; Hold’em keeps its specified 65 / 35 top-two payout.
