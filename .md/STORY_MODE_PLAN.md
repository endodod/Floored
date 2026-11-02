# Story mode ("The Circuit"): design report

Status: **planned, not built.** Owner answers so far are recorded in section 12; three
questions are still open there. Cash tables, the one dependency, are done.
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
Each city has **2–3 venues**: a dive (max bet 20× the min), the main floor (max 100×) and a
**high-roller room** (no max, opened by Reputation), so going all in is always possible
somewhere.

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

| Source / cost | Amount | Limit | Risk |
|---|---|---|---|
| Minigames | up to **3m** per play at a perfect score (about 2m on average) | each character **once per night**, 2–3 per city | none |
| Errands (story jobs) | 6m each, one time | 4 per city | none |
| Hustles (jobs board) | 4m each | 2 per night, only by playing | none (fixed pay; you meet a game condition) |
| **Comps** | **4% of what you wagered that night** | **capped at 10m per night** | none |
| Venue night | 12 bets, max 20m / 100m / no max | one per night | game edge |
| Tables session | stake-based | one per night | skill + luck |
| Lodging | **−3m** per night | every night | — |
| Boss | buy-in 60m, purse 150m | rematch after 2 nights | about 50/50 |
| Travel fare | 20m of the next city | once | — |

### What the simulation showed (3,000 circuits per player type)

The **first numbers in this plan were too generous with safe money.** Never gambling
(minigames only) was as fast as going all in, and faster than normal betting, because every
bet pays the house edge while the safe income is fixed. In a casino game that's backwards,
so the numbers above were changed: less safe money, plus **comps** and hustles that reward
playing. With them:

| Player type | Nights per city (median / worst 10%) | Whole circuit (median) | Busts per circuit | Stuck |
|---|---|---|---|---|
| Never gambles (minigames only) | 18 / 82 | ~370 nights | 0 | never |
| Cautious (5% of bankroll per bet) | 6 / 21 | ~100 | 0 | never |
| Balanced (15% per bet, max 100m) | 5 / 29 | ~120 | 0 | never |
| High variance (15% on 10× bets) | 8 / 70 | ~280 | ~31 | rare |
| Bold (all in, only what's needed) | 4 / 19 | ~85 | ~7 | never |

- **Not too hard:** no player type gets stuck, and normal play clears a city in about 5–6
  nights.
- **Gambling now pays:** bold and normal play are 3–4× faster than never gambling. The
  minigames are the safety net, not the way through.
- **The long tails come from bosses.** A city in the worst 10% takes 20–30 nights,
  almost always because of repeated 50/50 boss losses. Possible softeners (Q9): a cheaper
  rematch, or the rival getting a little weaker after each loss.
- **Length:** about 100–120 nights for normal play. At 8–10 minutes a night, that's 15–20
  hours. If that's too long, the levers are fewer cities or a bigger purse.
- The model is simple (one even-money or 10× game at about 97%, an average minigame
  score, a 50% boss). Phase 1 replaces it with `sim:story` on the real engines' odds.

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
   - **Reputation drops a tier**, which closes the high-roller room and the best
     hustles until you earn it back.
   - Characters react in the story (no lasting branch).
   - **The Notary** offers a **marker** (a loan) of 20m. You repay 1.5×, and half of every
     win's profit goes to the debt until it's paid. Each bust raises the next rate. It's
     optional: you can instead rest and do minigames to rebuild with no debt.
   - An ally from an earlier choice may offer a **staking deal** (their money; they take
     half the profit for 3 nights).
3. **Losing a boss:** you lose the buy-in, and the rival is away for 2 nights.

Going all in is always survivable: the worst case is a few nights of minigames. My earlier
idea of sending you back a city on "rock bottom" is **dropped**, because guaranteed safe
income makes it unnecessary (see Q8 if you want it back).

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
| 0 | Owner answers (section 12). Finish Cash tables (bot churn, top-up, cash checks) | **Cash tables done 2026-11-02**; questions 6, 8 and 9 still open |
| 1 | Economy model + `sim:story` + return check, **no UI** | the simulator meets the section 5 targets |
| 2 | Save format, dialogue engine, content types, `check:story` | checks pass on placeholder content |
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

Still open:

6. **Tone:** gritty noir, light and comedic, or in between?
8. **Harsher loss option:** I dropped "rock bottom sends you back a city" because minigames
   guarantee recovery. Do you want it back, or a hard mode with it?
9. **Boss losses:** should a rematch get easier (a cheaper buy-in, or a slightly weaker
   rival after each loss) to cut the long tails in section 5?
