# Floored

Browser-based casino simulation — no real money. Accounts are optional (sign in to sync survival runs).

Live at [floored.paulkuehn.ch](https://floored.paulkuehn.ch)

## Daily

A new challenge every day at 00:00 UTC — the same for every player, and you get one attempt.

The Daily page opens on an overview of today's challenge (figures, games, rules); **Play daily** starts the attempt and shows the games, with **How to play** and **Give up** above them.

- One **shared bankroll** (randomly $1K–$5K) for the whole day
- **Three random games**, each with a random number of bets (1–3)
- A **min bet** per bet (1–3% of the bankroll)
- You **must place every bet** — play the games in any order and split your bankroll to finish the day with as much as possible
- If your bankroll drops below the min bet, **today's challenge is failed**
- **Give up** ends the day early: your bankroll as it stands is the result, but the day counts as not completed (no streak, no best result)
- Leaving a game mid-round forfeits that round's stake (the bet still counts)
- Results are shareable as a spoiler-free emoji grid; streaks and best result are kept locally

The challenge is generated deterministically from the UTC date (`lib/daily/challenge.ts`). Daily progress and stats live in `localStorage`.

## Ladder

Climb 18 rungs with an all-in pot — one game per rung, and every game only once per run.

- Start with a **$100 pot**; each rung you pick a game and stake the whole pot
- **Any profit** (round multiplier above 1×) clears the rung and the pot becomes the payout —
  bigger wins grow the pot faster
- **Checkpoint every 3 rungs.** Lose a round and you fall back to it: its pot is restored and the
  games used since then are free again. A push replays the rung
- **3 lives** — cash out any time between rounds, lose the last life to bank your last checkpoint,
  or reach the top for a ×2 bonus
- The picker shows each game's max multiplier — safe games climb, high-payout games grow the pot

Rules live in `lib/ladder/rules.ts`, run state in `store/ladder-store.ts` (`localStorage`). Toggle with
`LADDER_ENABLED` in `lib/features.ts`.

## Freeplay

Choose any game, start with a healthy balance, and play without pressure or minimum bets.

- Starting balance: $10,000
- No accounts or real-money transactions
- Instant sessions, local state persisted for convenience

### How to play

Every game has a rules page at `/how-to-play/[game]` (content in `lib/game-tutorials.ts`), linked from the game list on the home page and from the **How to play** button on each game board. It ends in a **Play in Freeplay** button.

### Games

18 games, available in Freeplay, Survival and the Ladder, and drawn from for the Daily:

- Blackjack
- Case Battles
- Chicken Race
- Chicken Road
- Coin Flip
- Crash
- Dragon Tower
- HiLo
- Keno
- Mines
- Over-Under
- Plinko
- Poker (1-player)
- Roulette
- Run Dice
- Slots
- Street Cups
- Wheel

## Survival

Survival is a roguelike run mode layered on top of the same 18 games. Each run consists of 10 floors; every floor has a bankroll quota you must reach within 10 bets (`FLOOR_BET_LIMIT`) or the run ends. Clear floor 10 to win, or carry on into endless floors.

**Difficulty**

Runs start on Normal. Hard (quota and shop prices ×1.5) and Nightmare (quota ×2.5, prices ×2.0) exist in `lib/survival/balance.ts` but have no picker in the UI.

**Floor quotas (Normal)**

| Floor | Target bankroll |
|---|---|
| 1 | $2,000 |
| 5 | ~$60,000 |
| 10 | $1,000,000 |

Quota scales exponentially: `$2,000 × 500^((floor−1)/9)`.

**Sparks**

Sparks are the meta-currency earned by completing floors and missions. Spend them in the between-floor shop.

**Shop**

The shop appears between floors. It offers:
- **Run upgrades** — passive boosts that apply for the rest of the run (e.g. payout multipliers)
- **Game boosts and perks** — game-specific upgrades with five levels (e.g. Hole Card Reader for Blackjack, Crash Cushion for Crash)
- **Consumables** — the Lobby Reroll Ticket (active items are designed but not built yet)
- Each shop slot can be rerolled with a reroll ticket

**Missions**

Each floor has 3 seeded missions (e.g. "win 3 rounds in a row", "win at ×3 or more", "play Crash twice"), many requiring a multiple of the min bet. Completing missions awards bonus sparks.

**Run end**

A run ends when your bankroll drops below the floor's minimum bet, when a floor's 10 bets are used without meeting the quota, or when you clear all 10 floors. A run summary is shown at the end.

All survival numbers are listed in [.md/BALANCE_AUDIT.md](.md/BALANCE_AUDIT.md).

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (client-side state)
- Radix UI (primitives)
- Framer Motion (animations)
- Neon Postgres + Prisma, Neon Auth (optional accounts; survival runs sync to your account)

## Development

Copy `.env.example` to `.env` and fill in the Neon database and Neon Auth values, then:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to run locally.

## Project structure

```
app/
  daily/           # Daily challenge hub + game routes
  ladder/          # Ladder hub + game routes
  survival/        # Survival hub + game routes
  freeplay/        # Freeplay lobby + game routes
  how-to-play/     # Rules page per game
components/        # React components and shared UI
  games/           # One component per game
games/             # Pure game engines and logic (TS)
store/             # Zustand stores (daily, ladder, freeplay, survival, settings)
lib/
  daily/           # Daily challenge generation and sharing
  ladder/          # Ladder rules and sharing
  survival/        # Survival logic (balance, floors, missions, perks, shop)
.md/               # Project docs — start with ARCHITECTURE.md
```

See [CLAUDE.md](CLAUDE.md) for the full list of project docs.
