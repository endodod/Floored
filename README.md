# Floored

Browser-based casino simulation — no real money. Accounts are optional (sign in to keep your progress on your account: Freeplay balance, Daily, Ladder and Tables, runs in progress included).

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

Climb 18 rungs with an all-in pot — one game per rung, never the same game twice.

- Start with a **$100 pot**; each rung you pick a game and stake the whole pot
- **Six games on offer each rung**, drawn at random from the games you haven't used this run;
  games you haven't been offered yet are likelier to appear
- **Any profit** (round multiplier above 1×) clears the rung and the pot becomes the payout —
  bigger wins grow the pot faster
- **Checkpoint every 3 rungs.** Lose a round and you fall back to it: its pot is restored and the
  games used since then are free again. A push replays the rung
- **3 lives, from the first checkpoint.** Lose a round before rung 3 and the run restarts from
  the ground with a fresh $100 pot (no life spent). After that, each fall costs a life — cash out
  any time between rounds, lose the last life to bank your last checkpoint, or reach the top for a
  ×2 bonus
- The picker shows each game's max multiplier — safe games climb, high-payout games grow the pot

Rules live in `lib/ladder/rules.ts`, run state in `store/ladder-store.ts` (`localStorage`). Toggle with
`LADDER_ENABLED` in `lib/features.ts`.

## Tables

Sit down with bots at Texas Hold'em (Sit & Go, six seats, four on phones), Liar's Dice, or Blackjack Showdown.

- Own **Tables wallet** ($10,000, refillable below the smallest buy-in)
- **One lobby** with Tournaments and Cash tables side by side; tap a tournament table to pick its buy-in (100 / 1,000 / 10,000) in a dialog, a cash table to pick its limits and how many chips to bring. Each bot's skill is drawn at random per table
- Every buy-in goes into the prize pool (no rake); Hold'em pays the top two, while Blackjack Showdown and Liar's Dice are winner-takes-all
- Account Records track the Tables peak wallet, refills, and each game's results
- Leaving a table before your place is decided forfeits the buy-in
- Bots decide only from what their seat can see; `pnpm sim:bots` and `pnpm check:tables` test them

Toggle with `TABLES_ENABLED` in `lib/features.ts`. Details in `.md/BOT_TABLES_HANDOFF.md`.

## Freeplay

Choose any game, start with a healthy balance, and play without pressure or minimum bets.

- Starting balance: $10,000
- No real-money transactions
- Your balance is kept between visits, and follows your account when you're signed in

### How to play

Every game has a rules page at `/how-to-play/[game]` (content in `lib/game-tutorials.ts`), linked from the game list on the home page and from the **How to play** button on each game board. It ends in a **Play in Freeplay** button.

### Games

24 games, available in Freeplay and the Ladder, and drawn from for the Daily:

- Andar Bahar
- Blackjack
- Baccarat
- Case Battles
- Chicken Race
- Chicken Road
- Coin Flip
- Crash
- Deck Countdown
- Dragon Tower
- Dragon Tiger
- HiLo
- Keno
- Mines
- Over-Under
- Plinko
- Poker (1-player)
- Roulette
- Run Dice
- Sic Bo
- Slots
- Street Cups
- Tower of Cards
- Wheel

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (client-side state)
- Radix UI (primitives)
- Framer Motion (animations)
- Neon Postgres + Prisma, Neon Auth (optional accounts; Freeplay / Daily / Ladder / Tables progress syncs to your account)

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
  freeplay/        # Freeplay lobby + game routes
  how-to-play/     # Rules page per game
components/        # React components and shared UI
  games/           # One component per game
games/             # Pure game engines and logic (TS)
store/             # Zustand stores (daily, ladder, freeplay, settings)
lib/
  daily/           # Daily challenge generation and sharing
  ladder/          # Ladder rules, rung offers and sharing
.md/               # Project docs — start with ARCHITECTURE.md
```

See [CLAUDE.md](CLAUDE.md) for the full list of project docs.
