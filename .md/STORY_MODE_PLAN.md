# Story mode ("The Circuit"): design report

Status: **proposal, waiting for owner answers (section 12). Nothing is built.**
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
2. **The house still wins over many bets.** Every game, alone or combined with any
   story skill, keeps its return below 100% (with a few small, deliberate exceptions).
   Otherwise one game becomes a money printer and the whole economy breaks. A script
   checks this (section 10).
3. **Choices drive the story; luck drives the money.** Endings and character outcomes
   depend on what you choose, never on whether you busted. A bad run of luck costs
   money and nights, not the story you want.
4. **Time only moves when you play.** The game counts in-game **nights**. Nothing depends
   on the real clock (unless the owner prefers that for minigames, see Q1).
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
                 ├─► Mentor: learn / level a skill
                 ├─► Shop: one-night items (active items)
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
  characters, one mentor, one boss and its own minigame set.

### Bosses

You pay a **buy-in (100× the city min bet)** to enter. Two kinds:

- **Challenge boss:** a seeded, Daily-style challenge with a fixed number of bets on the
  city's games. The rival's score is shown up front and you have to beat it. Tuned to about
  a 45–60% win rate for normal play.
- **Table boss:** a Tables tournament with the boss seated at it. You win by finishing
  above the boss. (Hold'em is six-seat, so the boss doesn't have to be heads-up.) Boss
  bots are named characters with their own bot profiles.

A win pays a **purse of 2× the buy-in**, plays the post-boss scene and unlocks travel. A
loss costs the buy-in, plays a story reaction and sends the rival **away for 2 nights**
before a rematch. You can always travel **back** to earlier cities (the minigames there
pay that city's rates, so going back is no farm).

---

## 4. Characters, portraits and choices

- **Cast:** about 30–36 characters. Each city has 2–3 locals: a minigame giver, a mentor
  and a boss. They're joined by recurring ones:
  - **Jo**, your old dealer friend and companion, who comments on what happens.
  - **Sloane**, the rival, who turns up in several cities.
  - **Vale**, who won your family's club in one hand.
  - **The Notary**, the lender (section 6).
- **Portraits:** each character has 3 expressions (neutral, pleased, angry), shown in a
  dialogue box with the line, the speaker and choices. **Where the art comes from is
  an open question (Q2).**
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

## 5. Money model (starting values, to be tuned by simulation)

All amounts are in multiples of the **city min bet (m)**, so one table covers every city.

| Source / cost | Amount | Limit | Risk |
|---|---|---|---|
| Minigames | up to **6m** per play at a perfect score (about 4m on average) | each character **once per night**, 2–3 per city | none |
| Hustles (jobs board) | 3–8m each | 2 per night | none (fixed pay; you meet a game condition) |
| Errands (story jobs) | 10–25m, one time | 3–5 per city | none |
| Venue night | 12 bets, max 20m / 100m / no max | one per night | game edge |
| Tables session | stake-based | one per night | skill + luck |
| Lodging | **−3m** per night | every night | — |
| Boss | buy-in 100m, purse 200m | rematch after 2 nights | about 50/50 |
| Travel fare | 20m of the next city | once | — |

What this gives (to be checked with the simulator, section 10):

- **Safe-only player** (minigames + hustles, never gambles): about **+9m per night net**,
  so about **11 nights** to afford the boss buy-in. Slow, but always possible.
- **Gambling player:** reaches the buy-in in about **2–6 nights** depending on luck and risk.
- **Simulator targets per city:** median 4–8 nights, safe-only ≤ 14 nights, broke-to-playable
  (20m) ≤ 3 nights. At roughly 10–15 real minutes per night, that comes to about
  **1 hour per city and 10–14 hours for the circuit**.

### Why the minigame limit is "per night"
Nights cost lodging, and a night of venue play costs real money to the house edge. So the
minigames can't be repeated without the rest of the game moving forward. Because a night
can always be skipped by resting, a broke player is never stuck. Their limit is the real
time they spend on minigames, which is slower than gambling. If the owner wants a
real-clock limit too, see Q1.

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
| Read the Tell | gambling (free) | poker mentor | call or fold against a bot's shown tells |
| Count the Shoe | gambling (free) | blackjack mentor | keep the running count and call it |
| Odds Sense | gambling (free) | bookie | pick the better of two bets, with a streak multiplier |
| Free Roll | luck (free) | host | one free spin per night, minimum 1m, never a loss |

There are 12 minigames, each used in 2–4 cities with a new character and difficulty.
Phone-sized play is a requirement from day one.

---

## 8. Skills and items (and the trap to avoid)

- **Skills** are learned from city mentors for money. At each mentor you **choose 1 of 2**
  (a choice with a lasting effect), and a later mentor can level it. They reuse the
  Survival perks that already work inside the games (Hole Card Reader, Mine Sweeper, Crash
  Cushion and others; `hooks/use-survival-perks.ts`), with a generalised hook that reads
  the perks of whichever mode is playing.
- **Trap:** several Survival perks and every payout boost make a game **pay more than it
  takes** if they're permanent. Examples: Weighted Edge on Coin Flip (65% to win at 2×,
  about 130%), Hole Card Reader on Blackjack, and Game Boost 1.40×. That's fine in a
  10-floor run but breaks a persistent economy. So in story mode:
  - **No permanent payout boosts.** Payout boosts exist only as **one-night items**.
  - Each perk gets **story-specific level values** where needed, so that game + skill
    stays below 100% return. The return check (section 10) runs on every pair.
  - **Slots** is about 104.8% even without perks. It needs a low machine limit or a
    story-only pay table (Q3).
- **Items:** the designed but unbuilt active items (`.md/ACTIVE_ITEMS_SPEC.md`: Safety Net,
  Double Up, Hot Hand and others) become venue shop items that last one night. Building
  them serves Survival too.

---

## 9. Night events (variety)

Each night may roll one event from the city's table. Some change only what's offered:
an extra hustle, a character visit, a rival sighting, a Tables tournament tonight. Others
change payouts slightly in story mode only ("Wheel pays +10% tonight", "Blackjack 3:2
naturals pay 3×"). **Payout-changing events need owner approval (Q3)**, because the house
rule is that games are visuals-only unless you ask. Events that change a game's return
stay within the section 1 rule (below 100%, or capped and one night only).

---

## 10. Engineering plan

### Structure
| Path | Holds |
|---|---|
| `lib/story/content/` | cities, venues, characters, scenes, jobs, events: typed data with stable ids |
| `lib/story/economy.ts` | every number in section 5, as multiples of m |
| `lib/story/dialogue.ts` | the scene runner (lines, choices, conditions, effects) |
| `lib/story/minigames/` | pure minigame engines with seeded RNG |
| `store/story-store.ts` | the save: city, night, money, debt, rep, factions, flags, skills, items, minigame/job availability. Zustand persist with `version` + `migrate` from day one; added to `SYNCED_STORE_KEYS` |
| `app/story/` | map, city hub, `app/story/[game]` venue game route, minigame route, Tables route |
| `components/story/` | map, dialogue box with portraits, hub panels, minigame boards |
| `scripts/` | `sim:story` and `check:story` (below) |

### Hooking into what exists
- **House games:** add `'story'` to `GameMode`. A `useStoryGameBankroll` hook passes
  `wagerCap = min(bankroll, venue max)` the way the other modes do (every game already
  takes its bankroll from the page's `wagerCap`). This needs a small "table max" label in
  the dock so the cap doesn't read as your balance. Dev curse/bless stay off in story.
- **Perks:** generalise `useSurvivalPerks(game)` into a mode-aware hook. The open checks
  in `.md/MODE_ADJUSTMENTS_HANDOFF.md` (perks on the redesigned boards) become a
  **prerequisite**, because story would inherit any perk bug.
- **Tables:** Tables is kept separate from `GameName` and uses its own wallet. Story needs
  three things:
  - a wallet adapter (story money in, story money out);
  - stakes in multiples of m instead of the fixed 100 / 1k / 10k tiers;
  - named story opponents (a portrait plus a `BotProfile`).

  **Cash tables are only partly built** (`.md/TABLES_CASH_HANDOFF.md`: bot churn, top-up/
  leave, checks and browser verification remain), so finishing them comes first (Q5).
- **Survival:** story reuses Survival's perk code and the active-items design. What
  happens to Survival itself (stay hidden, or retire) is Q4.

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
- **Return check:** every game × skill level × night event in story stays below 100%
  (with the listed exceptions).
- The usual `npx tsc --noEmit`, `pnpm lint` and `scripts/design-check/mobile-check.cjs`
  extended to the story screens.

---

## 11. Build order

| Phase | What | Done when |
|---|---|---|
| 0 | Owner answers (section 12). Finish Cash tables. Close the perk checks in the mode-adjustments handoff | answers recorded here; those handoffs done |
| 1 | Economy model + `sim:story` + return check, **no UI** | the simulator meets the section 5 targets |
| 2 | Save format, dialogue engine, content types, `check:story` | checks pass on placeholder content |
| 3 | **Vertical slice: Dustwater complete.** Map, hub, venue nights, 2 characters with portraits, 2 minigames, jobs, mentor, a Liar's Dice boss, bust and lender, one choice with a consequence | playable start to finish on desktop and phone; owner playtest |
| 4 | Tune from the playtest. Change systems now, while only one city exists | owner signs off on the slice |
| 5 | Content in batches of three cities (acts I–IV), each with its minigames and table games | checks + simulation pass per batch; browser check |
| 6 | Endings, the post-game World Tour (endless rising stakes), balance pass, docs (README, ARCHITECTURE, BALANCE_AUDIT, tutorials) | docs match the code |

Phase 3 is the important one. Every system gets tried together in one city before the
other eleven are written on top of it.

---

## 12. Questions for the owner

1. **"Limited to time" for minigames.** My recommendation is **once per character per
   in-game night**, as in section 5. The alternatives are a real-clock limit (for example
   each character once per real day) or both. Which do you want?
2. **Portrait art.** About 30–36 characters × 3 expressions. Will you supply illustrated
   art (generated or commissioned)? Or should I build a consistent **layered SVG portrait
   style** in code (cheaper, matches the site, easy to give expressions, but less
   painterly)? Placeholders can be used until the art arrives either way.
3. **Story-only numbers.** May story mode use its own payout numbers in these places?
   - (a) perk levels, so game + skill stays below 100% return;
   - (b) a Slots machine limit or story pay table;
   - (c) small one-night payout events.
   Freeplay, Daily, Ladder and Challenges would stay exactly as they are.
4. **Survival.** Does it stay hidden as it is, or retire once story mode reuses its perks
   and items?
5. **Cash tables first?** Story needs them for its venue rooms. Do I finish
   `.md/TABLES_CASH_HANDOFF.md` as Phase 0, or launch story with tournaments only and add
   cash rooms later?
6. **Tone:** gritty noir, light and comedic, or in between?
7. **Saves:** one story save (with "New story" behind a confirmation) or several slots?
8. **Harsher loss option:** I dropped "rock bottom sends you back a city" because minigames
   guarantee recovery. Do you want it back, or a hard mode with it?
