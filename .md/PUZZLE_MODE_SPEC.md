# Puzzles — Design Spec

> Third game mode for Floored, alongside Freeplay and Survival. Read this before
> implementing anything — it captures the full design as worked out, not just
> the data shapes.

---

## 1. Overview

**Puzzles** is a skill-focused mode built around fixed, shareable scenarios rather
than open-ended survival. Every player facing the same challenge sees the same
seed — same games, same RNG outcomes, same modifiers — so the differentiator is
decision quality, not luck relative to the house.

The Puzzles tab has two sub-modes:

- **Daily** — auto-generated from the date, no setup required, refreshes every day.
- **Create Challenge** — fully manual: pick your own games and objective, share
  with friends or publish publicly.

Both sub-modes share the same underlying data model, store shape, and UI
(tab-based game switching, shared bankroll). The only real branch is *who
generates the challenge* (server/seed vs. player) and *whether it's discoverable*
(daily is always public by nature; custom challenges choose).

---

## 2. Objectives

Puzzle challenges come in one of two objective types. Both use a shared bankroll
across whichever games the player enters — but they score and end differently.

### Bankroll Attack ("Highscore")
- Standard params: **start bankroll 1,000**, **bet cap 5**.
- Goal: maximize ending bankroll within the bet cap.
- Score = final bankroll (scenarios can modify this — see §4).
- Run ends when the bet cap is reached (or bankroll hits 0).

### Speedrun
- Standard params: **start bankroll 1,000**, **target bankroll 3,000**.
- Goal: reach the target in as few bets as possible.
- Score = bets used to reach target (lower is better). Did-not-finish is scored
  separately / excluded from the "completed" leaderboard.
- Run ends when the target is reached, or the player chooses to stop.

Both objectives pull from the same 5-game pool per challenge and use the same
free game-switching UI (like tabs) — no engine changes needed to support either.

---

## 3. Game selection

- 5 games are chosen per challenge from the pool of all 18, **excluding pure-luck
  games with no player decisions** (Slots, Wheel).
- Daily: picked deterministically from the date-seed.
- Create Challenge: picked manually by the creator.
- Player can freely switch between the 5 games mid-run (tab-like), **unless** a
  structural scenario overrides this (see Relay / Locked Door below).

---

## 4. Scenarios

Scenarios are seed-generated modifiers layered on top of a challenge. They're
what make each day's puzzle distinct rather than "Survival but smaller." Each
scenario belongs to a **lever** — a category of thing it modifies — and at most
one scenario can be active per lever in a single challenge (so opposing effects,
e.g. raising and lowering the same value, can never both roll). Multiple
*different* levers can be active simultaneously (stacking is allowed).

Scenarios are objective-specific: Bankroll Attack and Speedrun each have their
own scenario pool, because the two objectives care about different things (a
fixed bet cap vs. a bankroll race).

### 4.1 Bankroll Attack scenario pool

| Lever | Buff | Extreme buff | Debuff | Extreme debuff |
|---|---|---|---|---|
| Bet cap | Extra Bet (5→6) | Marathon (5→8) | Tight Margins (5→4) | Sudden Death (5→3) |
| Bet direction | — | — | Escalation (each bet ≥ last) | De-escalation (each bet ≤ last) |
| Starting bankroll | Head Start (1,000→1,200) | Fortune (1,000→1,500) | Thin Ice (1,000→800) | Shoestring (1,000→500) |
| Insurance | Free Bet (bet #1's loss refunded) | Cushion (1 loss/run refunded 50%) | — | — |
| Mid-run injection | Windfall (after bet 3, bankroll ×1.15) | — | Toll (after bet 3, bankroll ×0.85) | — |
| Payout | Golden Ticket (1 game +20%) | — | Marked Table (1 game −20%) | — |
| Tax | — | — | House Cut (all payouts −10%) | — |
| Structural | — | — | Locked Door (1 game disabled) | Forced Order (games must be played in a fixed sequence) |

Notes:
- **Free Bet** protects strictly the literal first bet placed — not "the first
  loss whenever it occurs." If bet #1 wins, Free Bet does nothing that run.
- **Forced Order** overrides the mode's default free-switching for that
  challenge only.
- If Forced Order and Locked Door both roll, the forced sequence simply skips
  the locked game.

### 4.2 Speedrun scenario pool

| Lever | Buff | Extreme buff | Debuff | Extreme debuff |
|---|---|---|---|---|
| Target bankroll | Modest Goal (3,000→2,200) | Sprint Finish (3,000→1,800) | Stretch Goal (3,000→4,000) | Marathon (3,000→5,000) |
| Bet direction | — | — | Escalation | De-escalation |
| Starting bankroll | Head Start (1,000→1,200) | Fortune (1,000→1,500) | Thin Ice (1,000→800) | Shoestring (1,000→500) |
| Insurance | Free Bet | Cushion | — | — |
| Mid-run injection | — | — | Narrowing Path (after bet 3, lock 1 game) | Bottleneck (after bet 3, lock 2 games) |
| Payout | Golden Ticket (1 game +20%) | — | Marked Table (1 game −20%) | — |
| Tax | — | — | House Cut (all payouts −10%) | — |
| Structural | — | — | Locked Door (1 game disabled) | Relay (can't play the same game twice in a row) |

Notes:
- Mid-run injection is debuff-only for Speedrun (locking games is inherently a
  restriction — there's no clean "unlock more" buff since all 5 are already
  available from the start).
- **Relay** replaces Bankroll Attack's Forced Order — a fixed sequence would
  undercut the "race" feel (you'd just follow a script), whereas a no-repeat
  rule keeps the player deciding every bet while still constraining freedom.
- Target-bankroll scenarios reduce/increase *remaining distance*, not the raw
  number, so they interact sensibly regardless of when in the run they apply.

### 4.3 Scenario generation

```ts
const LEVERS = [
  'primaryLimit',   // bet cap (Bankroll Attack) or target bankroll (Speedrun)
  'betDirection',
  'startBankroll',
  'insurance',
  'midRunInjection',
  'payout',
  'tax',
  'structural',
] as const

function generateScenarios(seed: string, objective: 'bankroll' | 'speedrun') {
  const rng = seededRng(seed + ':scenarios')
  const activeLeverCount = weightedPick(rng, [0, 1, 2, 3, 4], [0.1, 0.3, 0.3, 0.2, 0.1])
  const chosenLevers = sampleWithoutReplacement(rng, LEVERS, activeLeverCount)
  return chosenLevers.map(lever => pickFromPool(rng, SCENARIO_POOL[objective][lever]))
}
```

- Most days: 1-2 active scenarios ("spiced but fair"). Rare days: 3-4 stacked
  (chaotic, high-variance puzzles).
- At most one scenario per lever guarantees no contradictory combination (e.g.
  never both Extra Bet and Tight Margins).
- Extreme-tier scenarios should be weighted rarer within their lever's pool to
  avoid frequent worst-case stacks (e.g. Sudden Death + Shoestring together).

### 4.4 Engine integration

Scenarios apply at the **puzzle-store / page level**, not inside individual game
engines. Since `games/<n>/engine.ts` files are pure and already take seeded
RNG + params, puzzle scenarios only ever touch things the store already owns:
bankroll, bet count, which games are selectable, and payout math applied around
the engine's result — no engine rewrites required for the numeric levers.

Structural scenarios (Locked Door, Forced Order, Relay) need light UI
enforcement (disable a tab, grey out a button) rather than engine changes.

---

## 5. Daily sub-mode

- **Two separate challenges published per day**, one per objective:
  `daily-{date}-bankroll` and `daily-{date}-speedrun`.
- Each is independently seeded from the date string and generates its own 5
  games + scenario set per §4.
- Both are leaderboarded separately.

---

## 6. Create Challenge sub-mode

- Player manually picks: 5 games (from the same non-luck pool) + objective type.
- Player can **name** the challenge.
- Visibility: **public** (listed in a browsable feed — sortable by newest /
  most played) or **private** (only reachable via share code/link).
- A share code/link is generated regardless of visibility — public challenges
  can still be shared directly; private ones are *only* reachable via the code.
- Playing any challenge (Daily or Create Challenge) never requires an account.
- **Creating** a challenge or **submitting a score to a leaderboard** requires
  signing in (Neon Auth — see `.md/AI_HANDSHAKE.md`). Creator identity and
  leaderboard attribution are the Neon Auth user id, not an anonymous
  device-level id. Display name defaults to the account's name, with an
  optional per-challenge override at creation/submission time.

---

## 7. Data model

```prisma
// Identity/accounts are owned by Neon Auth, not Prisma — its `user` table
// lives outside this schema. userId/createdById below are plain references
// to that external id, not Prisma relations.
model Challenge {
  id             String   @id @default(cuid())
  date           String?          // null for custom, "2026-08-18" for daily
  objective      String           // "bankroll" | "speedrun"
  seed           String
  games          String[]         // 5 GameNames
  scenarios      Json?            // resolved scenario set for this challenge
  startBankroll  Int
  betCap         Int?             // Bankroll Attack
  targetBankroll Int?             // Speedrun
  name           String?          // custom challenges only
  visibility     String   @default("private")  // "public" | "private"
  shareCode      String   @unique
  createdById    String?          // Neon Auth user id; null for daily (system-generated)
  playCount      Int      @default(0)
  createdAt      DateTime @default(now())
}

model LeaderboardEntry {
  id          String   @id @default(cuid())
  challengeId String
  userId      String           // Neon Auth user id — submitting a score requires signing in
  displayName String?          // per-challenge override; defaults to the account's name
  score       Int              // endBankroll (Bankroll Attack) or betsUsed (Speedrun)
  betsUsed    Int
  endBankroll Int
  completed   Boolean          // did the player reach the objective (Speedrun) / finish the cap (Bankroll Attack)
  completedAt DateTime @default(now())
}
```

---

## 8. Store shape (client)

```ts
interface PuzzleState {
  challengeId: string
  seed: string
  objective: 'bankroll' | 'speedrun'
  games: GameName[]                 // the 5 for this challenge
  activeScenarios: ScenarioDef[]     // resolved for this challenge
  bankroll: number
  betsUsed: number
  betCap?: number                   // Bankroll Attack
  targetBankroll?: number           // Speedrun
  lockedGames: GameName[]           // from structural/injection scenarios
  lastGamePlayed?: GameName         // for Relay enforcement
  gameStats: Record<GameName, { bets: number; net: number }>
  status: 'active' | 'busted' | 'ended' | 'submitted'
}
```

Playing needs no client-side identity field at all — a run only needs one once
the player submits to a leaderboard, at which point identity comes from the
signed-in Neon Auth session (prompting sign-in first if they aren't).

---

## 9. Open follow-ups (not yet decided)

- Exact weighting curve for extreme-tier scenario rarity.
- Public challenge feed sorting beyond "newest" / "most played" (e.g. trending).
- Anti-abuse for challenge creation (e.g. per-account daily cap).
- Whether "Create Challenge" challenges can include scenarios, or are
  vanilla-only for v1.
