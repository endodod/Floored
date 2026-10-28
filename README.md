# Floored

Browser-based casino simulation — no real money. Accounts are optional (sign in to sync survival runs).

Live at [floored.paulkuehn.ch](https://floored.paulkuehn.ch)

## Daily

A new challenge every day at 00:00 UTC — the same for every player, and you get one attempt.

- One **shared bankroll** (randomly $1K–$5K) for the whole day
- **Three random games**, each with a random number of bets (1–3)
- A **min bet** per bet (1–3% of the bankroll)
- You **must place every bet** — play the games in any order and split your bankroll to finish the day with as much as possible
- If your bankroll drops below the min bet, **today's challenge is failed**
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

Survival is a roguelike run mode layered on top of the same 18 games. Each run consists of 10 floors; every floor has a bankroll quota you must reach within a 5-minute timer or the run ends.

**Difficulties**

| Difficulty | Quota multiplier | Shop price multiplier |
|---|---|---|
| Normal | ×1.0 | ×1.0 |
| Hard | ×1.5 | ×1.5 |
| Nightmare | ×2.5 | ×2.0 |

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
- **Game perks** — game-specific upgrades with tiered levels (e.g. Card Counter for Blackjack, Early Cashout for Crash)
- **Consumables** — one-time-use items (e.g. extra lobby reroll tickets)
- Shop inventory can be rerolled for an escalating sparks cost

**Missions**

Each floor has 3 randomly assigned missions (e.g. "win 3 rounds in a row", "hit a ×5 multiplier", "play Crash once"). Completing missions awards bonus sparks.

**Run end**

A run ends when your bankroll hits $0 before the quota, time runs out, or you clear all 10 floors. A run summary is shown at the end.

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
  freeplay/        # Freeplay game routes
  survival/        # Survival game routes
components/        # React components and shared UI
games/             # Pure game engines and logic (TS)
store/             # Zustand stores (daily, freeplay, survival, settings)
lib/
  daily/           # Daily challenge generation and sharing
  survival/        # Survival logic (balance, floors, missions, perks, shop)
```
