# Floored

Browser-based casino simulation — no real money, no accounts required

Live at [floored.paulkuehn.ch](https://floored.paulkuehn.ch)

## Freeplay

Choose any game, start with a healthy balance, and play without pressure or minimum bets.

- Starting balance: $10,000
- No accounts or real-money transactions
- Instant sessions, local state persisted for convenience

### Games

18 games available in both Freeplay and Survival:

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
- Supabase + Prisma (optional persistence)

## Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to run locally.

## Project structure

```
app/
  freeplay/        # Freeplay game routes
  survival/        # Survival game routes
components/        # React components and shared UI
games/             # Pure game engines and logic (TS)
store/             # Zustand stores (freeplay, survival, settings)
lib/
  survival/        # Survival logic (balance, floors, missions, perks, shop)
```
