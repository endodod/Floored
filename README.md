# Floored

Browser-based casino simulation — no real money, no accounts required

Live at [floored.paulkuehn.ch](https://floored.paulkuehn.ch)

## Daily (main mode)

A new challenge every day at 00:00 UTC — the same for every player, and you get one attempt.

- One **shared bankroll** (randomly $1K–$5K) for the whole day
- **Six random games**, each with a random number of bets (1–5)
- Play them in any order and split your bankroll however you like — the goal is to finish the day with as much as possible
- The day ends when every bet is used, you bust, or you choose to cash out early
- Leaving a game mid-round forfeits that round's stake (the bet still counts)
- Results are shareable as a spoiler-free emoji grid; streaks and best result are kept locally

The challenge is generated deterministically from the UTC date (`lib/daily/challenge.ts`), so no server or database is needed. Progress lives in `localStorage`.

## Freeplay

Choose any game, start with a healthy balance, and play without pressure or minimum bets.

- Starting balance: $10,000
- No accounts or real-money transactions
- Instant sessions, local state persisted for convenience

### Games

18 games, available in Freeplay and drawn from for the Daily:

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

## Survival (parked)

The roguelike floor mode (floors, shop, items, missions) is still in the codebase but hidden: its routes return 404 and its entry points are not shown. Flip `SURVIVAL_ENABLED` in `lib/features.ts` to bring it back.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (client-side state)
- Radix UI (primitives)
- Framer Motion (animations)

## Development

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
  survival/        # Survival game routes (parked)
components/        # React components and shared UI
games/             # Pure game engines and logic (TS)
store/             # Zustand stores (daily, freeplay, survival, settings)
lib/
  daily/           # Daily challenge generation and sharing
  survival/        # Survival logic (balance, floors, missions, perks, shop)
```
