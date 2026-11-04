# Story mode ("The Circuit"): design report

Status: **being built.** Every owner question is answered (section 12). Phases 1, 2 and 3a
are done; the build state and next steps are in [STORY_MODE_HANDOFF.md](STORY_MODE_HANDOFF.md). Cash tables, the one dependency, are done.
Branch: `claude/friendly-goodall-yvxakz`.

What the owner asked for: a story mode that is the heart of the site. You travel from
casino to casino with different games and rising stakes, guided by a story with
portraits and choices. Characters offer side missions as **minigames** (gambling or
not). You **can't lose** them, so they are a safe way to earn money, but they are
**limited by time** so they can't be overused. Losing must hurt without being a plain
reset and without being so harsh that nobody goes all in. Many cities, some games
repeating, and **all Tables games** (Hold'em, Liar's Dice, Blackjack Showdown) included.

The owner said fixing things afterwards is awkward. Because of that, this report sets
out the rules that keep the design consistent (section 1), puts every money number into
one model that a script can simulate before any UI exists (section 5), and plans a
vertical slice (one complete city) before the content for the other eleven (section 11).

---

## 1. Design rules (everything below follows from these)

1. **Safe money sets the floor, gambling sets the pace.** Minigames and jobs guarantee
   you can always recover and move on. Gambling is how you move on *faster*. A lucky
   player clears a city in a few nights and an unlucky one takes longer, but nobody gets
   stuck.
2. **The house still wins on any single game.** Games keep their own odds (below 100%
   return). What makes playing worth it is everything around the bets: hustles, comps
   and boss purses (section 5). Otherwise one game becomes a money printer.
3. **Choices drive the story; luck drives the money.** Endings and character outcomes
   depend on what you choose, never on whether you busted. A bad run of luck costs
   money and nights, not the story you want.
4. **Time only moves when you play.** The game counts in-game **nights**. Nothing depends
   on the real clock (the owner chose in-game nights for the minigame limit too).
5. **No dead ends.** No choice and no loss can lock you out of finishing. A content
   check enforces this.
6. **Data first.** Cities, characters, scenes, minigames and jobs are typed data files
   with stable ids. New content never breaks a save.

---

## 2. The loop

```
Map ─► City hub ─┬─► Venue night (12 bets across the venue's games, or one Tables session)
                 ├─► Characters: talk, choices, errands, minigames (limited per night)
                 ├─► Jobs board (hustles: conditions in games, fixed pay)
                 ├─► Rest (skip to the next night)
                 └─► Boss showdown (buy-in) ─► win: purse, story, next city
```

- **A night** is one visit to a venue: up to **12 bets** across its games, or **one
  Tables session** (a tournament, or a cash table until you stand up). After that the
  casino closes. You pay **lodging**, the night counter goes up by one, minigames and the
  jobs board refresh, and a new **night event** may roll.
- **Resting** also ends the night without playing (you still pay lodging, down to $0,
  never into debt). Resting is how a broke player gets back to the minigames.
- **Nights total** is shown as a stat: a light score for replays, never a fail condition.

---

## 3. Cities (12, in four acts)

The stakes rise about ×2–2.5 per city. You start with **$200** (40× the first min bet).
Each city has **2–3 venues**: a dive (always open, max bet 20× the min), the main floor
(max 100×, standing 1) and a **high-roller room** (no max, standing 3), so going all in is
always possible somewhere. **Standing** is per town: it starts at 0 in every town, is
remembered when you go back, and finished errands raise it (section 5). Standing 2, 4 and 5
raise a **night bonus** instead of opening a room: +5%, +10%, +20% of a winning night's table
winnings, paid at the end of the night.

| # | Act | City (fictional) | Feel | House games | Tables | Boss | Min bet |
|---|---|---|---|---|---|---|---|
| 1 | I Backroads | Dustwater | truck stop, back rooms | Coin Flip, Street Cups, HiLo, Run Dice, Over-Under | Liar's Dice cash | Liar's Dice table | 5 |
| 2 | I | Rattlesnake Junction | rodeo saloon | Chicken Race, Chicken Road, Wheel, Mines, Andar Bahar | Blackjack Showdown cash | Challenge | 10 |
| 3 | I | Port Lacey | boardwalk arcade | Plinko, Wheel, Slots, Keno, Crash, Case Battles | none | Challenge | 25 |
| 4 | II The Strip | Silver Mesa | classic strip | Blackjack, Roulette, 1P Poker, Dragon Tower, Deck Countdown, Mines | Blackjack Showdown tournament | Blackjack Showdown | 50 |
| 5 | II | Neon Flats | modern mega-resort | Crash, Slots, Plinko, Tower of Cards, Case Battles, Keno | Hold'em cash | Challenge | 100 |
| 6 | II | Bayou Crossing | riverboat | Blackjack, 1P Poker, Run Dice, Over-Under, Street Cups, Chicken Race | Liar's Dice tournament | Liar's Dice (rematch, harder) | 250 |
| 7 | III Abroad | Lantern Quay | harbour lights | Baccarat, Sic Bo, Dragon Tiger, Andar Bahar, Tower of Cards | Hold'em cash | Challenge | 500 |
| 8 | III | Coral Reach | island resort | Wheel, Sic Bo, Chicken Road, Coin Flip, Keno, HiLo | Liar's Dice cash | Challenge | 1,000 |
| 9 | III | Monte Lune | Riviera | Roulette, Baccarat, Blackjack, 1P Poker, Dragon Tiger | Hold'em tournament | Hold'em Sit & Go | 2,500 |
| 10 | IV The Top | Kurstadt | old spa casino | Roulette, HiLo, Deck Countdown, Dragon Tower, Mines, Baccarat | Blackjack Showdown cash | Blackjack Showdown | 5,000 |
| 11 | IV | The Aurora | ocean liner | Crash, Tower of Cards, Coin Flip, Case Battles, Sic Bo, Plinko | Hold'em cash + tournament | Hold'em vs the rival | 10,000 |
| 12 | IV | The Summit | Vale's private club | your pick of every game seen | all three | Final: three rounds vs Vale | 25,000 |

- **Every one of the 24 house games appears in at least 2 cities** (most in 3), so games
  repeat but always in a new setting with new stakes, events and characters.
- **All three Tables games appear in both formats** (cash rooms and tournaments) across
  the circuit.
- **City identity:** theme colours (the casino theme), a night-event table, 2–3
  characters, one boss and its own minigame set.

### Bosses

You pay a **buy-in (60× the city min bet)** to enter. Two kinds:

- **Challenge boss:** a seeded, Daily-style challenge with a fixed number of bets on the
  city's games. The rival's score is shown up front and you have to beat it. Tuned to about
  a 45–60% win rate for normal play.
- **Table boss:** a Tables tournament with the boss seated at it. You win by finishing
  above the boss. (Hold'em is six-seat, so the boss doesn't have to be heads-up.) Boss
  bots are named characters with their own bot profiles.

A win pays a **purse of 150×** (2.5× the buy-in), plays the post-boss scene and unlocks travel. A
loss costs the buy-in, plays a story reaction and sends the rival **away for 2 nights**
before a rematch. You can always travel **back** to earlier cities (the minigames there
pay that city's rates, so going back is no farm).

---

## 4. Characters, portraits and choices

**Premise.** Six months ago your grandfather owned the Gilded Floor: forty tables, a brass bar,
Jo dealing the late shift. Vale (head of the Syndicate; half the circuit's houses pay Vale rent)
sat down and won the deed in one hand. He left you his car, his debts and a three-word note:
get it back. Vale doesn't play strangers, only champions: twelve towns, a house champion in each.
Beat all twelve and Vale owes you a seat at the Summit; win there and the Gilded Floor is yours.

- **Cast:** about 30–36 characters. Each city has 2–3 locals: a minigame giver, an errand
  giver and a boss. They're joined by recurring ones:
  - **Jo**, your old dealer friend and companion, who comments on what happens.
  - **Sloane**, the rival, who turns up in several cities.
  - **Vale**, who won your family's club in one hand.
  - **The Notary**, the lender (section 6).
- **Portraits:** each character has 3 expressions (neutral, pleased, angry), shown in a
  dialogue box with the line, the speaker and choices. **Art is drawn in code** (owner,
  2026-11-02), as layered vector portraits that must match the quality of the game boards:
  the casino theme's wood, gold and felt palette, consistent light and line weight, and
  an expression set per character. A style sheet and two finished characters come first,
  in the Phase 3 slice, for the owner's sign-off before the rest are drawn.
- **Choices:** every city has 2–4 real choices (in errands and the boss scenes). A choice
  can:
  - shift standing with **three factions**: Vale's Syndicate, the Old Guard (independent
    house owners) and the Underground (hustlers);
  - change a character's later role (an ally who stakes you, a lender with better terms,
    a rival who sabotages a boss challenge with a harder modifier);
  - open or close side errands (never main progress);
  - set flags the final chapter reads.
- **Endings:** 3 endings plus 1 secret ending, chosen by faction standing and the final
  choice, never by your money or busts.
- **Writing volume:** about 6 scenes per city, so 70–80 scenes in total. They're stored as
  typed data (lines, choices, conditions, effects) and run by a small dialogue engine.
  A content check proves that every scene is reachable, every flag it reads is set
  somewhere, and there are no dead ends.
- **Branching budget:** choices change local events and a handful of global flags, not
  whole parallel chapters. That keeps the writing finite and testable.

---

## 5. Money model (simulated, no items or perks)

All amounts are in multiples of the **city min bet (m)**, so one table covers every city.
The numbers live in `lib/story/economy.ts`; `pnpm sim:story` checks them (below).

| Source / cost | Amount | Limit | Risk |
|---|---|---|---|
| Minigames | up to **3m** per play at a perfect score (about 2m on average) | each character **once per night**, 2–3 per city | none |
| Jobs (rebuilt 2026-11-04) | table jobs 3m–5m and **+1 standing**; minigame jobs 6m–8m, one attempt, no standing | a minigame job and a table job each night (first night too), max 3 a town, taken only by talking; table jobs never repeat; written jobs first | none |
| Hustles (jobs board) | 4m each | 2 per night, only by playing | none (fixed pay; you meet a game condition) |
| **Comps** | **a share of what you wagered that night, win or lose, by room: 4% dive / 5% main floor / 6% high-roller** | **capped per night at 10m / 15m / 20m** | none |
| Venue night | 12 bets, max 20m / 100m / no max; each room deals its own 4 of the city's games each night (`lib/story/rotation.ts`), and the dive keeps any game an open errand names | one per night | game edge |
| Standing | 0 in every town, 5 at most; +1 per job, −1 per bust (never below 0); opens the main floor at 1 and the high-roller room at 3 | per town (`VENUE_REP` `[0, 1, 3]`) | — |
| **Standing bonus** | a night up at the tables earns **+5% / +10% / +20%** of the night's table winnings (payouts less stakes) at standing **2 / 4 / 5** (`STANDING_BONUS`) | every night you finish up | none |
| Tables session | stake-based | one per night | skill + luck |
| Lodging | **−3m** per night; **free below 10m** (you sleep in your car) | every night | — |
| Boss | **buy-in 50m, purse 150m** | rematch after 2 nights, same difficulty | about 50/50 |
| Travel fare | 20m of the next city | once | — |

### What the simulation showed (`pnpm sim:story`, 1,000 circuits per player type, seed 1, 2026-11-03)

The simulator plays whole circuits over each city's **real game list**, with each game's
odds taken from its engine (`lib/story/odds.ts`). Since 2026-11-03 it models the room
rotation (a player only picks from their room's games that night, 3 until 2026-11-04 and 4 since, in the room they use:
cautious, balanced and high-variance play the main floor, bold the high-roller room) and the
per-room comps. Before = one comps rate (4%, cap 10m) and every game of the city available.

Since the standing change it also starts each town in the **dive** and moves a player up as
standing allows: four errands a city (`ERRANDS_PER_CITY`; three until 2026-11-04, when minigame
jobs started earning standing), +1 standing each, −1 per bust, capped at 5.

| Player type | Nights per city, before → after (median / worst 10%) | Whole circuit, before → after (median) | Busts per circuit | Back to 10m after a bust |
|---|---|---|---|---|
| Never gambles (minigames only) | 15 / 86 → 15 / 86 | ~358 → ~358 nights | 0 | — |
| Cautious (5% a bet, safest bet in the city) | 5 / 20 → 5 / 20 | ~94 → ~94 | 0 | — |
| Balanced (15% a bet, any game played its usual way) | 5 / 43 → 5 / 37 | ~169 → ~145 | 0 | 2 → 4 nights |
| High variance (15% on the riskiest bets) | 9 / 84 → 7 / 71 | ~327 → ~274 | ~24 → ~6 | 2 nights |
| Bold (all in, only what's needed) | 3 / 17 → 3 / 18 | ~75 → ~78 | ~3.6 → ~3.0 | 2 nights |

On 2026-11-04 rooms went from 3 games to 4 (`GAMES_PER_ROOM`). Re-run (3000 circuits, seed 1):
never gambles 15 / 86, ~359 nights; cautious 5 / 19, ~94; balanced 5 / 37, ~147; high variance
7 / 73, ~276, busts ~9.6 (was ~6.3 in the same run with 3 games: a fourth game more often puts
a riskier bet in its room); bold 3 / 17, ~77, busts ~2.6. Nothing else moved.
The same day every errand started earning standing (four a city, not three); re-run: balanced
5 / 38, ~153; high variance 7 / 73, ~278, busts ~9.2; the rest unchanged.

**Errands out night by night and the standing bonus, 2026-11-04** (3000 circuits, seed 1;
before = four errands a city, rooms at standing 1 / 2, no bonus; after = five errands released
2 / 1 / 1 / 1, rooms at 1 / 3, the bonus at 2 / 4 / 5): never gambles 15 / 86 → 12 / 82,
~359 → ~342 nights; cautious 5 / 19 → 5 / 18, ~94 → ~87; balanced 5 / 38 → 4 / 32,
~152 → ~130; high variance 7 / 74 → 6 / 66, ~277 → ~245, busts ~9.6 → ~8.3; bold 3 / 17 →
3 / 15, ~77 → ~68, busts ~2.6 → ~2.1. The fifth errand's pay and the bonus speed every type up a
little; balanced play now sits at the bottom of the 4–8 target. All checks pass.
With **spawned jobs** on top (one a night after the errands, one per giver, three givers; a
gambling player clears one a night, a never-gambler only minigame jobs): never gambles 10 / 81,
~334 nights; cautious 5 / 14, ~75; balanced 4 / 24, ~103; high variance 6 / 50, ~194, busts
~1.3; bold 3 / 12, ~60, busts ~0.8. Busts fall because jobs pay without risk; all checks pass.
**Jobs rebuilt** (later the same day: no errands; one offer a night up to three, from the first
night; 3m–5m each): never gambles 23 / 104, ~494 nights; cautious 5 / 15, ~81; balanced 5 / 25,
~108; high variance 6 / 51, ~202, busts ~1.4; bold 4 / 13, ~66, busts ~1.1. Slower than before
because the five 6m errands (two on night one) are gone; the never-gambler, who can only clear
minigame jobs, slows most. All checks pass; no number was retuned.

The main-floor players gain from the 5% comps; high-variance busts drop because 5% on every
bet softens the losses. No other numbers were retuned.

**Standing, same day (before → after the gating):**

| Player type | Nights per city (median / worst 10%) | Whole circuit | Busts per circuit | Back to 10m after a bust |
|---|---|---|---|---|
| Never gambles | 15 / 86 → 15 / 86 | ~358 → ~358 | 0 → 0 | — |
| Cautious (5%) | 5 / 20 → 5 / 20 | ~93 → ~97 | 0 → 0 | — |
| Balanced (15%) | 5 / 37 → 5 / 38 | ~146 → ~148 | 0 → 0 | 3 / 6 → 2 / 4 nights |
| High variance | 7 / 70 → 6 / 69 | ~260 → ~266 | 6.9 → 6.4 | 2 nights |
| Bold (all in) | 3 / 19 → 3 / 18 | ~79 → ~79 | 3.1 → 2.8 | 2 nights |

The simulator's poker odds are a Monte Carlo draw, so the medians move about ±2 nights between
runs; read the table as "unchanged", not as a two-night difference. Gating barely moves them
because the dive's 20m cap only binds a player's first night in each town, and the errands pay
6m each anyway. Nobody gets stuck, every player type reaches the high-roller room by its third
night in a town, and normal play still clears a city in about 5 nights.

- **Nobody gets stuck**, and normal play clears a city in about 5 nights.
- **Gambling pays:** cautious and bold play are 4–5× faster than never gambling; the
  minigames are the safety net.
- **A bust costs about 2 nights**, thanks to the free car below 10m (without it, climbing
  back from $0 took weeks of nights).
- **The long tails come from bosses** lost at 50/50. (Owner, 2026-11-02: rematches stay as
  hard; the tails are accepted.) Softeners considered and rejected: a cheaper rematch, or
  a weaker rival after each loss.
- **Length:** about 75–170 nights depending on how you play (cautious ~96). At 8–10 minutes
  a night that is roughly 12–25 hours.
- **Tuning made in Phase 1:** the boss buy-in went from 60m to 50m (purse stays 150m), which
  cut the cautious circuit from ~123 to ~96 nights; the free car was added.

### Story-only game settings (approved by the owner; `lib/story/odds.ts`)

The return check found five games whose base numbers don't fit a persistent economy. Story
mode plays them with its own settings; Freeplay, Daily, Ladder and Challenges are unchanged.

| Game | Base game | Story setting |
|---|---|---|
| Chicken Road | step 2 returns **135%**, step 5 **193%** (the step table outpays its danger) | each step priced to return 96% |
| HiLo | one guess on the likelier side returns **142%** (2× on a ~67% guess, ties keep the stake) | a right guess pays (0.96 − tie chance) ÷ its chance: 96% |
| Slots | **104.8%** | three cherries 4× (5), bells 12× (15), diamonds 24× (25): 96.4% |
| Mines | fair; rounding tips some stops to **100.3%** | cash-outs pay 97% of the fair price |
| 1-Player Poker | about **48%** (jacks only return the stake; the dealt hand never pays) | a richer table (jacks 2×, two pair 4×, trips 6× … royal 800×): about 96% |

Fair 100% bets (Wheel red, Coin Flip) stay as they are.

### Why the minigame limit is "per night"
Nights cost lodging, and a night of venue play costs real money to the house edge. So the
minigames can't be repeated without the rest of the game moving forward. Because a night
can always be skipped by resting, a broke player is never stuck. Their limit is the real
time they spend on minigames, which is slower than gambling. (Owner decision: in-game
nights only, no real-clock limit.)

---

## 6. Losing: what it costs

There is no reset. Losing costs these, from mild to harsh:

1. **The money itself, and the nights to rebuild it** (lodging keeps ticking).
2. **Bust** (bankroll below the dive min bet):
   - **Standing drops 1 in that town** (never below 0), which can close the high-roller
     room and the main floor until an errand earns it back. Other towns are
     untouched, and a new town always starts at 0.
   - Characters react in the story (no lasting branch).
   - **The Notary** offers a **marker** (a loan) of 20m. You repay 1.5×, and half of every
     win's profit goes to the debt until it's paid. Each bust raises the next rate. It's
     optional: you can instead rest and do minigames to rebuild with no debt.
   - An ally from an earlier choice may offer a **staking deal** (their money; they take
     half the profit for 3 nights).
3. **Losing a boss:** you lose the buy-in, and the rival is away for 2 nights.

Going all in is always survivable: the worst case is a few nights of minigames. My earlier
idea of sending you back a city on "rock bottom" is **dropped**, because guaranteed safe
income makes it unnecessary (owner, 2026-11-02: no harsher option for now).

---

## 7. Minigames

These are new code under `lib/story/minigames/` (pure engines, like the games) and
`components/story/minigames/` (boards following the fit-without-scrolling and motion
rules). **You never stake money.** Your score (0–100%) sets the pay. Each minigame has 3
difficulty tiers that rise with the act, and each character's minigame can be played
**once per night**. The first attempt that night counts (you can practise afterwards with
no pay).

| Minigame | Kind | Given by (example) | How it plays |
|---|---|---|---|
| Chip Count | skill | cashier | count chip stacks against a timer |
| Shuffle Tracker | skill | street hustler | follow one card through a shuffle |
| Last Orders | memory | bartender | repeat a growing order sequence |
| Spot the Cheat | observation | security chief | find the marked card or the switched chip |
| Payout Pro | maths | dealer school | pay roulette or blackjack bets correctly and fast |
| Rack 'Em | puzzle | chip runner | sort and stack chips by colour |
| Slot Mechanic | puzzle | technician | rotate the tiles to connect the reel circuit |
| Dice Stack | timing | dice hustler | stack dice in a cup without tipping it |
| Read the Tell | gambling (free) | poker pro | call or fold against a bot's shown tells |
| Count the Shoe | gambling (free) | blackjack pro | keep the running count and call it |
| Odds Sense | gambling (free) | bookie | pick the better of two bets, with a streak multiplier |
| Free Roll | luck (free) | host | one free spin per night, minimum 1m, never a loss |

There are 12 minigames, each used in 2–4 cities with a new character and difficulty.
Phone-sized play is a requirement from day one.

---

## 8. Skills and items: left out for now

Owner decision (2026-11-02): **no Survival perks or items in story mode for now.** The
simulation above is without them. If they're added later, keep in mind that several
Survival perks and all payout boosts make a game pay out more than it takes in when owned
permanently (Weighted Edge on Coin Flip about 130%; the dealer's hole card on Blackjack;
1.40× boosts). They would need story-only values and a return check before going in.

---

## 9. Night events (variety)

Each night may roll one event from the city's table. Some change only what's offered:
an extra hustle, a character visit, a rival sighting, a Tables tournament tonight. Others
change payouts slightly in story mode only ("Wheel pays +10% tonight", "Blackjack 3:2
naturals pay 3×"). The owner approved **story-only game settings** (2026-11-02): story
mode may configure a game (Slots' pay table, a venue's limits, a night's payout event)
without touching Freeplay, Daily, Ladder or Challenges. Events that change a game's
return stay within the section 1 rule (below 100%, or capped and one night only), and
Slots gets a story pay table below 100%.

---

## 10. Engineering plan

### Structure
| Path | Holds |
|---|---|
| `lib/story/content/` | cities, venues, characters, scenes, jobs, events: typed data with stable ids |
| `lib/story/economy.ts` | every number in section 5, as multiples of m |
| `lib/story/dialogue.ts` | the scene runner (lines, choices, conditions, effects) |
| `lib/story/minigames/` | pure minigame engines with seeded RNG |
| `store/story-store.ts` | the save: city, night, money, debt, rep, factions, flags, minigame/job availability. Zustand persist with `version` + `migrate` from day one; added to `SYNCED_STORE_KEYS` |
| `app/story/` | map, city hub, `app/story/[game]` venue game route, minigame route, Tables route |
| `components/story/` | map, dialogue box with portraits, hub panels, minigame boards |
| `scripts/` | `sim:story` and `check:story` (below) |

### Hooking into what exists
- **House games:** add `'story'` to `GameMode`. A `useStoryGameBankroll` hook passes
  `wagerCap = min(bankroll, venue max)` the way the other modes do (every game already
  takes its bankroll from the page's `wagerCap`). This needs a small "table max" label in
  the dock so the cap doesn't read as your balance. Dev curse/bless stay off in story.
- **Perks:** none in story for now (section 8), so the open perk checks in
  `.md/MODE_ADJUSTMENTS_HANDOFF.md` don't block story.
- **Tables:** Tables is kept separate from `GameName` and uses its own wallet. Story needs
  three things:
  - a wallet adapter (story money in, story money out);
  - stakes in multiples of m instead of the fixed 100 / 1k / 10k tiers;
  - named story opponents (a portrait plus a `BotProfile`).

  **Cash tables are built** (2026-11-02, `.md/TABLES_CASH_HANDOFF.md`). Story reuses
  `lib/tables/cash.ts` (seating and churn) and the runner's `cash` option, with story
  money in place of the Tables wallet.
- **Survival:** untouched (perks and items are left out).

### Checks that make later fixes rare
- **`pnpm check:story` (content):**
  - every scene is reachable, with no dead ends;
  - every flag that is read is set somewhere;
  - every referenced character, game, minigame and job exists;
  - every house game appears in ≥ 2 cities and every Tables game in both formats;
  - ids are unique and saved ids still exist.
- **`pnpm sim:story` (economy):** plays thousands of circuits with four player types
  (safe-only, cautious, balanced, all-in) using the real engines' odds. It reports nights
  per city, bust rate, boss win rate, debt peaks and time to recover. The section 5
  targets become its pass or fail.
- **Return check:** every game × night event in story stays below 100%.
- The usual `npx tsc --noEmit`, `pnpm lint` and `scripts/design-check/mobile-check.cjs`
  extended to the story screens.

---

## 11. Build order

| Phase | What | Done when |
|---|---|---|
| 0 | Owner answers (section 12). Finish Cash tables (bot churn, top-up, cash checks) | **Cash tables done 2026-11-02**; only the portrait style / tone is open |
| 1 | Economy model + `sim:story` + return check, **no UI** | **Done 2026-11-02:** `lib/story/{economy,cities,odds}.ts`, `scripts/story/sim.ts`; targets met (section 5) |
| 2 | Save format, dialogue engine, content types, `check:story` | **Done 2026-11-02:** `store/story-store.ts` (one save, version 1, synced as `story`), `lib/story/{types,dialogue}.ts`, `lib/story/content/` (the cast and Dustwater's scenes and errands), `scripts/story/check-content.ts`; checks pass |
| 3 | **Vertical slice: Dustwater complete.** Map, hub, venue nights, 2 characters with portraits, 2 minigames, jobs, comps, a Liar's Dice boss, bust and lender, one choice with a consequence | playable start to finish on desktop and phone; owner playtest |
| 4 | Tune from the playtest. Change systems now, while only one city exists | owner signs off on the slice |
| 5 | Content in batches of three cities (acts I–IV), each with its minigames and table games | checks + simulation pass per batch; browser check |
| 6 | Endings, the post-game World Tour (endless rising stakes), balance pass, docs (README, ARCHITECTURE, BALANCE_AUDIT, tutorials) | docs match the code |

Phase 3 is the important one. Every system gets tried together in one city before the
other eleven are written on top of it.

---

## 12. Questions for the owner

Answered (2026-11-02):

1. **Minigame limit:** once per character per **in-game night**, as in section 5.
2. **Portrait art:** drawn in code, at the quality of the game boards (section 4).
3. **Story-only numbers:** yes, story mode can configure games such as Slots (section 9).
4. **Survival:** perks and items are left out of story for now (section 8).
5. **Cash tables:** finished first (done).
7. **Saves:** one story save, with "New story" behind a confirmation.

8. **Harsher loss option:** no, not for now. Busting costs money, nights and reputation;
   nobody is sent back a city.
9. **Boss losses:** rematches don't get easier. Same buy-in, same rival, after the 2-night
   wait.

6. **Portrait style and tone:** a mix of C (back-room noir) and D (chip medallion): D's
   round faces and chip frame, C's single lamp, rim light and halftone shadows. The tone
   follows: warm noir, likeable characters with real stakes and dry humour. Two colour
   versions are drawn at https://claude.ai/artifact/E936D6NasWdu8dVrVryPvZ (1: full
   colour, 2: monochrome with gold and chip colour); the owner picked **mix 1**.

10. **Mix 1** (warm noir, full colour).
11. **The player** is an unnamed "you" with no portrait.
12. **Story sits first** on the home page and in the navbar.
13. **Draft names** are kept for now (they live in data files).

Answered (2026-11-03):

14. **Reputation becomes standing in the current town:** per town, 0 in every new town,
    remembered when you go back, max 5, stored as a city → standing map with `rep()` for the
    current town.
15. **Every finished errand earns it** (+1), minigame jobs included (changed 2026-11-04; at
    first only jobs won at the tables did). The rule is data: optional `rep` on an errand,
    defaulting to 1, checked by `pnpm check:story`. Version-2 saves are credited for minigame
    errands already done.
16. **Rooms:** `VENUE_REP` `[0, 1, 3]` (changed 2026-11-04, was `[0, 1, 2]`) — the dive always
    open, main floor standing 1, high-roller standing 3. Standing 2, 4 and 5 raise the **standing
    bonus** to +5%, +10%, +20% of a winning night's table winnings, so standing keeps paying once
    every room is open.
18. **Five errands a city, out night by night** (2026-11-04): two people want a word on the first
    night (one job each), then one more job each night after (`night` 0, 0, 1, 2, 3 on the
    errands). A scene that hands out a job waits for its night. Jo's jobs come in `dawn` scenes.
19. **Spawned jobs after the errands** (2026-11-04): at most one new job a night, varied
    (`lib/story/jobs.ts`); a job left undone stays; one per person at a time, so at most one
    per giver open. They earn standing back after a bust.
20. **Jobs rebuilt** (2026-11-04, replaces 18 and 19): one system. One new offer a night in a
    town at a giver holding none, while the town holds fewer than 3 (offered or taken); the
    first night in every town starts with one. Only talking to the giver takes a job ("Not
    now" leaves it waiting). One per person until finished; never the same task twice in a
    town; each giver's written jobs first. Every job pays 3m–5m and +1 standing. Jo gives jobs
    too and stands on the street in every town. Jobs wait in their town when you leave.
21. **Two job kinds** (2026-11-04, amends 20): each night a minigame job and a table job at two
    givers (a coin flip for a last place). Minigames are only played as jobs: one attempt, 6m-8m,
    no standing, may repeat (not back to back). Table jobs 3m-5m, +1 standing, never repeat. Jo
    runs Chip Count. Open: the never-gambler now gets stuck (see the handoff).
17. **A bust costs 1 standing**; a boss win no longer gives any (it pays the purse and clears
    the town). Version-1 saves migrate `rep` into the current town, capped by its finished
    errands.

Nothing is open. Build from Phase 1 (section 11).
