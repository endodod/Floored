# Floored

Browser-based casino simulation — no real money. Accounts are optional (sign in to keep your progress on your account: Freeplay balance, Daily challenge, Ladder, Challenges and Tables, runs in progress included).

The home page welcomes players and explains the modes in three short cards, then lists them in two groups: **Compete** (Daily challenge, Daily ladder, Challenges, Ladder, Community: the real game modes) and **Practise and play** (Freeplay, to train for each mode, and Tables, just for fun).

Live at [floored.paulkuehn.ch](https://floored.paulkuehn.ch)

## Daily challenge

A new challenge every day at 00:00 UTC — the same for every player, and you get one attempt.

The Daily challenge page (also shown at the top of the Challenges page) opens on an overview of today's challenge (figures, games, rules); **Play daily** starts the attempt and shows the games, with **How to play** and **Give up** above them.

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

Climb 15 rungs with an all-in pot — one game per rung, never the same game twice. Endless runs on
`/ladder`; the **Daily ladder** (`/daily-ladder`, shown at the top of the Ladder page) is one climb a day with
the same seeded game pickers for everyone.

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

## Challenges

Twenty themed house challenges (`/challenges`): each has 2–6 games and 1–6 bets per game, and
starts at 1,000. Place every bet and finish with as high a bankroll as you can — the Daily's rules,
but retry as often as you like. Each challenge keeps your **tries** and **best bankroll** (only
attempts with every bet placed count).

**Community** (`/community`): challenges made by players under the same rules. Anyone can play;
creating one needs an account. Your tries and best are kept the same way, and each community
challenge shows how often it was played and its top score. The profile (Account → Records) shows
both in collapsible lists. Details in `.md/CHALLENGES.md`.

## Tables

Sit down with bots at Texas Hold'em (Sit & Go, six seats, four on phones), Liar's Dice, or Blackjack Showdown.

- Own **Tables wallet** ($10,000, refillable below the smallest buy-in)
- **One lobby** at `/tables` (no intro page; How it works sits under the tables) with Tournaments and Cash tables side by side; tap a tournament table to pick its buy-in (100 / 1,000 / 10,000) in a dialog, a cash table to pick its limits and how many chips to bring. Each bot's skill is drawn at random per table
- **Tournaments:** every buy-in goes into the prize pool (no rake); Hold'em pays the top two, while Blackjack Showdown and Liar's Dice are winner-takes-all. Leaving a table before your place is decided forfeits the buy-in
- **Cash tables:** bring any amount of your wallet and play until you leave or run out. Fixed limits (low, mid, high); top up between hands; leave any time (mid-hand you fold, give up your dice, or stand and leave when the Blackjack hand settles) and your stack goes back to the wallet, also if you close the tab. At 0 chips you sit out until you top up or leave. Bots come and go between hands. Cash Blackjack is played against the house dealer
- The Tables page shows the wallet, tournament totals and cash net; Account Records show the Tables peak balance and resets (wallet refills)
- Bots decide only from what their seat can see; `pnpm sim:bots` (`--cash` for cash tables) and `pnpm check:tables` test them

Toggle with `TABLES_ENABLED` in `lib/features.ts`. Details in `.md/BOT_TABLES_HANDOFF.md` and `.md/TABLES_CASH_HANDOFF.md`.

## Story

**The Circuit**: a story mode with nights, characters and a boss per city. Only the first town, Dustwater, is playable so far.

- Each town is a drawn night street (SVG, no image files). Click the doors, the motel, the car, the road sign and the people standing around. Every hotspot has a faint gold outline that glows when you point at it, and the car's outline follows the car's shape instead of a box

- A night is one room (dive, main floor, high-roller room) and 5 or 10 bets, set by where you slept: the car (free; 5 bets) or a room (3× the minimum bet in Dustwater, then 4×; 10 bets). A new story starts with 5; each room draws its own 4 of the city's games every night and swaps a couple the next night. Every new story draws its own lineups, so no two stories play the same
- **Standing** is per town: 0 in every new town, remembered when you go back, max 5. Every finished table job is +1; borrowing from the town's lender (Pike in Dustwater, any night) is −1 (going broke alone costs nothing). The dive is always open, the main floor wants standing 1 and the high-roller room 3; standing 2, 4 and 5 add a bonus of 5%, 10% and 20% of a winning night's table winnings
- Jobs: each night two people have work going, a minigame job and a table job (the first night too). Table jobs only name games dealt tonight in a room you can enter, and an offer you don't take is gone the next night. Talk to them to take it or say not now (it waits until the next night). A taken job can be dropped from the person's card (no pay, no standing). One job per person, three at most in a town. Table jobs pay 3–5× the minimum bet and +1 standing and never repeat; minigame jobs are one attempt, pay 6–8× and give no standing. Minigames are only played as jobs; Jo runs Chip Count
- Comps give back a share of what you bet, bigger in better rooms (4% / 5% / 6%, capped); hustles, jobs and minigames pay on the side
- Marta's diner sells a plate (+2 bets tonight); Jo gives a read on tonight's games; owing 100× the minimum bet offers a fresh start
- Jo's walkthrough plays after the opening scene, and "How the nights work" is in the story menu
- Details in `.md/STORY_MODE_HANDOFF.md`; setting up a city in `.md/STORY_CITY_GUIDE.md`

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
- Neon Postgres + Prisma, Neon Auth (optional accounts; Freeplay / Daily challenge / Ladder / Challenges / Tables progress, community challenges syncs to your account)

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
  daily-ladder/    # Daily ladder hub + game routes
  challenges/      # House challenges list
  community/       # Community challenges list + create
  challenge/       # The challenge in progress + game routes
  freeplay/        # Freeplay lobby + game routes
  how-to-play/     # Rules page per game
  tables/          # Tables lobby + bot tables
  story/           # Story mode (The Circuit)
components/        # React components and shared UI
  games/           # One component per game
  story/           # The drawn street, hotspots, sheets and scenes
games/             # Pure game engines and logic (TS)
store/             # Zustand stores (daily, ladder + daily ladder, challenge, freeplay, settings)
lib/
  daily/           # Daily challenge generation and sharing
  ladder/          # Ladder rules, rung offers and sharing
  challenges/      # Challenge presets, limits and validation
  story/           # Story cities, characters, jobs and street layouts
.md/               # Project docs — start with ARCHITECTURE.md
```

See [CLAUDE.md](CLAUDE.md) for the full list of project docs.
