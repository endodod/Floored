# Story mode — handoff

Branch: `claude/friendly-goodall-yvxakz`. Status as of 2026-11-02: **phases 1, 2, 3a, 3b and 3c are built and pushed; next is 3d (minigames)**.
2026-11-03: 3b (story game mode) and 3c (portraits, dialogue box, hub, navbar, home) built.
Hub placeholders to replace: minigame buttons and the boss "Sit down" button are disabled
"Soon" (`components/story/hub.tsx`) until 3d/3e. Hub finds the boss as the city's one
character without a minigame (no boss field on a city yet). The design is in [STORY_MODE_PLAN.md](STORY_MODE_PLAN.md) (read it first: rules,
cities, economy, owner decisions in section 12). This file says what exists, what is
next, and every decision made along the way that the plan doesn't spell out.

**2026-11-03 additions:** (1) rooms rotate games: `lib/story/rotation.ts` `gamesFor(city, night, venue, seen)`
gives each room `GAMES_PER_ROOM` (4 since 2026-11-04, was 3) games a night, seeded by city+night+room (uses the store's
global `night`, like hustles), sharing at least one game with the same room the night before; the hub's
door cards and Tonight card use it and `app/story/[game]/page.tsx` redirects to /story for a game not
in tonight's lineup. (Summit's `all-seen` list grows as games are played, so its lineup can shift
mid-night; revisit when the Summit is built.) (2) Comps by room: `COMPS_RATE` `[0.04, 0.05, 0.06]`,
`COMPS_CAP_M` `[10, 15, 20]`; the sim plays one room per player type. (3) Tutorial: scene
`dustwater-how-nights-work` (trigger `tutorial`, queued after arrival on a new story, replayable) and the
"How the nights work" card (`components/story/nights-guide.tsx`, hub menu, all numbers from the
constants). The checker verifies the numbers Jo quotes. (4) The arrival scene now tells the premise (Gilded Floor,
Vale, the six champions). Only Dustwater is playable (title screen and map say so). Guide for
building cities 2-12: [STORY_CITY_GUIDE.md](STORY_CITY_GUIDE.md).

**2026-11-03, standing (branch `story/standing`):** reputation became **standing in the town
you are in**. The save keeps `standing: { [cityId]: 0–5 }` and `rep()` reads the current town
(`store/story-store.ts`); every new town starts at 0 and going back restores what you left.
Finished errands raise it: `ERRAND_STANDING` (1) for every errand, minigame jobs included
(owner decision 2026-11-04; until then minigame errands gave none). `errandStanding` in
`lib/story/economy.ts`; an optional `rep` on the errand overrides it, and `pnpm check:story`
fails an errand that earns none. Save version 3 credits minigame errands a save already finished. A bust
costs `BUST_STANDING` (1), never below 0, and a boss win no longer gives any. `VENUE_REP` is now
`[0, 1, 3]` (dive always open, main floor standing 1, high-roller 3; it was `[0, 1, 2]` until the
2026-11-04 change below). The dive also keeps dealing any game an open
errand names (`gamesFor(..., must)`; the card says so), and the jobs book marks each errand
"+1 standing" (or "Pays only" for an errand with `rep: 0`). Save version 2 migrates a version-1 `rep` into the current town,
capped by its finished errands. The sim starts every town in the dive and moves up as
standing allows.

**2026-11-04, standing bonus and errands over the nights:** standing 1 and 3 open the main floor
and the high-roller room; standing 2, 4 and 5 raise the **standing bonus**: a night you finish up at
the tables adds 5%, 10% or 20% of that night's table winnings, after comps (`STANDING_BONUS`,
`standingBonus` in `lib/story/economy.ts`; `bonus` and `bonusRate` on the night summary; a row on
the receipt; "+10%" beside the HUD stars; a table in How the nights work; a line in Jo's
walkthrough). Every city now has **five errands** (`ERRANDS_PER_CITY`), and they come out over the
nights: each errand has a `night` (0 = the first night in the town) on the schedule 0, 0, 1, 2, 3
(`errandsOutBy`). `sceneFor` holds back a scene that starts an errand before its night, so a
character only shows "!" from then; `openErrands` waits too. New `dawn` trigger, queued by
`endNight`, for Jo (no street spot). Dustwater: night 0 Marta's shift and Pike's marks (his first
talk now hands it over on both paths), night 1 Jo's seed money (`dustwater-jo-seed`), night 2
Marta's trucker's bet (`dustwater-marta-trucker`), night 3 the new **Lookout rates**
(`dustwater-pike-lesson`, Pike's Shuffle Tracker at 4 of 5). Save version 4 keeps any of those jobs
a save already had open, and marks the scene that now hands it over as played.
**Spawned jobs** (same day, owner decision): once a town's errands are all out, one new job a
night (at most) turns up for a giver with nothing open; undone jobs stay; one per person, so
three at most in Dustwater. Varied templates in `lib/story/jobs.ts` (streak, big win, night up
by a margin, minigame score; titles and wording vary), 3m-5m, +1 standing up to 5, so a bust
can be worked back. Save version 5 adds `jobs`. `night-up` goals take an optional `atLeast`. How to set up a city:
[STORY_CITY_GUIDE.md](STORY_CITY_GUIDE.md) section 4.
*(The errands and spawned jobs above are replaced by the job system below.)*

**2026-11-04, jobs rebuilt (owner decision; replaces errands and spawned jobs):** one system,
`lib/story/jobs.ts` + the store. Each night in a town one new offer turns up at a random giver
holding no job, while the town holds fewer than `JOB_LIMIT` (3), offered or taken; the first
night in every town starts with one, so a story starts with exactly one offer (if a town is full
at nightfall, that night's offer comes once a job is finished). A job is only taken by talking to
its giver: Talk plays any new scene first, then an offer scene built from the save
(`offer:<job id>`: the pitch, then "I'll do it" / "Not now"). Not now leaves it waiting. One job
per person until finished; a town never gives the same task twice (`goalKey`, kept in
`jobsGiven`); each giver's written jobs come first (`WRITTEN_JOBS`, with `pitch` lines), then
generated ones. Every job pays 3m-5m (`JOB_PAY_M`) and +1 standing (`JOB_STANDING`). Jobs stay in
their town when you leave. Givers: locals with a minigame plus **Jo**, who is now on the street
in every town (right of the car; Room 5 moved up the motel wall). The scenes that only handed
out jobs (`dustwater-jo-seed`, `-marta-trucker`, `-pike-lesson`) are now those jobs' pitches; the
first-meeting scenes no longer hand out jobs. Save version 6 drops `errands` and open jobs,
counts finished written jobs as given, and drops gone scenes from `scene`/`queue`
(`migrateStorySave`, tested in `check:story`). `check:story` plays every rule through; the sim
models one offer a night up to three. Sim (3000 circuits, seed 1), nights per city median before →
after: never gambles 10 → 23, cautious 5 → 5, balanced 4 → 5, high variance 6 → 6, bold 3 → 4
(the old five errands paid 6m each, two on the first night).

**2026-11-04, two job kinds, minigames only as jobs, Jo's Chip Count (owner decisions):**
each night a town offers a **minigame job** and a **table job** at two different givers with
none (first night too), while it holds fewer than 3; with one place left a coin flip picks the
kind, and a place freed later that night brings the kind still missing (`makeOffers`,
`NIGHT_KINDS`, save `jobNight`). Minigames are **only played as jobs**: the Play button shows only
on someone whose minigame job you took; one attempt; at the target it pays 6m/7m/8m (60%/80%/
perfect, `MINIGAME_JOB_PAY_M`) and **no standing**; a miss pays nothing and the job is gone. No
practice, no nightly minigame pay (`MINIGAME_MAX_M` and `minigameNight` removed). Only **table
jobs** (3m-5m, `TABLE_JOB_PAY_M`) earn standing and never repeat in a town; minigame jobs may
repeat, never the same one twice in a row from a giver. **Jo** now runs **Chip Count**
(`lib/story/minigames/chip-count.ts`, `components/story/minigames/chip-count.tsx`: five stacks of
4-8 chips worth 1/5/25/100, 9 s down to 5 s, pick the total of four; score = stacks right ÷ 5) in
every town. Street markers: a gold **briefcase** for a job offer, "!" for new dialogue, a play
badge for a minigame job you hold. The jobs book and person card name the kind and its reward.
Save version 7 (`jobOffered` → `jobNight`, `minigameNight` dropped). **Open:** the sim's
never-gambler is now stuck (table jobs they can't do fill all three givers, and nothing else
pays), and balanced/high-variance players are slower with more busts; waiting on the owner.
**Same day, owner's answer:** offers nobody takes leave after `JOB_OFFER_NIGHTS` (2) nights (an
expired offer was never given, so it can come back); a taken job can be dropped from the
person's card (`dropJob`: no pay, no standing, giver free); and the never-gambler is no longer a
sim target (shown for reference; it still can't save the buy-in on minigame jobs alone). Sim
(3000, seed 1) nights per city median / worst 10%: cautious 7 / 19, balanced 5 / 31, high
variance 7 / 60 (busts ~5.8), bold 4 / 16 (busts ~2.9). All checks pass.

**2026-11-04, where you sleep (owner decision):** every night ends with a choice: **the car**
(free in Dustwater, 1m after; **8 bets** the next night) or **a room** (Room 5 at the Starlite: 3m
in Dustwater, 4m after; **12 bets**). The "free car below 10m" rule is gone; a room you can't pay
for can't be chosen; the car is paid down to $0. A new story starts with 8 bets (`START_BETS`).
`CAR_BETS`, `ROOM_BETS`, `SLEEP_COST_M`, `sleepCostM` in `lib/story/economy.ts`; the save's
`nextBets` and `tonight.limit` (save version 8; older saves get 12 for their next night). The
street shows both beds (Room 5 up the motel wall, the car with its cost and bets); either opens
"Where to sleep". The receipt shows the bed's cost and "Bets tomorrow". Jo's walkthrough quotes
eight / twelve and the room's 3× (checked). The story still can't be lost: broke is a bust and
the Notary's marker, and minigame jobs need no bets. Sim: see plan section 5 (the never-gambler
can finish again; high-variance busts ~1.6).

**2026-11-04, later the same day (owner decision):** the car is **free in every city** (for now),
nights are **5 bets after the car and 10 after a room** (room still 3m in Dustwater, 4m after; a
new story starts with 5), and the standing penalty moved: **going broke costs no standing;
taking a marker from the Notary costs 1** (`MARKER_STANDING`; the Notary's card, the bust scene's
Notary line, Jo's walkthrough and How the nights work say so). Room 5's label sits above the motel
roof. Save version 9 caps a save's next night at 10. Sim (3000, seed 1) nights per city median /
worst 10%: never gambles 23 / 75 (reference), cautious 7 / 20, balanced 6 / 31, high variance
7 / 50 (busts ~0), bold 3 / 14 (busts ~2.2). All checks pass.
**Start uses the one go:** pressing Start on a minigame job marks it `started` (`beginMinigame`);
leaving before the end (back button, reload, closing the page) is a miss, settled the next time
the hub or that minigame page loads (`forfeitStartedMinigames`): the job is lost, no pay.

**2026-11-04, what each person offers (owner decisions):** the **Notary is gone**; each town has
one **lender** (`lends: true`; Pike in Dustwater) who lends on the same marker terms (20m, repaid
at 1.5× plus 0.25× per earlier loan in the town, half of every win's profit, −1 standing) **any
night**, not only when broke. Owing `DEBT_WARN_M` (100m) or more shows a popup that offers a
fresh start ("Keep playing" / "Start over"); it comes back only after the debt drops under the
line and climbs again (`debtWarned`). The story still can't be lost. **Marta's diner**
(`sells: 'meal'`): a hot plate for `MEAL_M` (2m) adds `MEAL_BETS` (2) bets tonight, once a night
(`buyMeal`, `mealNight`). **Jo's read on tonight** (`lib/story/tips.ts`): on Jo's card, one game
that treats you fair (with a hint at how to play it) and one the house built for itself, from
the room you're in tonight (the dive's lineup before you sit), no numbers, wording seeded by
night. The person card's Talk button is filled whenever there is something to say, and the
"only played as a job" note is gone. `check:story` requires exactly one lender per town with
people and tests loans any time, the warning, the meal and its bets.
On a person's card, Talk (a speech bubble, with a dot when they have something to say), Play (a minigame job you hold) and Drop job are brass buttons too, and these are round brass **service buttons** (`components/story/service-card.tsx`:
`ServiceButton`, `ServicePopup`, `PaperRow`): Diner (a fork and knife; a dot while you haven't eaten
tonight), Loan (a hand with coins) and A tip (a light bulb). Each opens a paper card over the
street in the receipt's style: a diner menu (`menu`), an I.O.U. slip with a red header (`iou`) or
a page of Jo's notebook (`note`); opening one closes the person's card.

**2026-11-04, seven cities (owner decision):** the five challenge-boss cities are cut; the circuit
is Dustwater ($5, Liar's Dice), Silver Mesa ($20, Blackjack Showdown), Bayou Crossing ($75,
Hold'em), Monte Lune ($250, Liar's Dice), Kurstadt ($1,000, Blackjack Showdown), The Aurora
($5,000, Hold'em), The Summit ($25,000, the final). Each city deals 8 house games and every game
is in exactly two cities. Boss buy-in `BOSS_BUYIN_M` 100m, win `BOSS_PURSE_M` 300m; Jo and Cutter
say "a hundred times the house minimum" (checked). Save version 10 moves a save in a cut city to
the next city left (`REMOVED_CITIES` in `lib/story/cities.ts`). The **travel fare is gone**
(beating the boss is the ticket out). `pnpm sim:story`'s target is now the **circuit length**
(owner decision): balanced and cautious play finish the whole circuit in 100-160 nights (median;
now ~123 and ~112). Nights a city: balanced 12 / 47, cautious 11 / 37. The map spreads the stops over the whole width and its act bands
tile edge to edge.

**2026-11-05, Dustwater's written jobs filled out (owner request):** Marta, Pike and Jo each
have **three written table jobs and three written minigame jobs** (18 in `DUSTWATER_JOBS`; the
five older ones keep their ids and stay first). Table: Marta trucker's bet (3x), jukebox wheel
(Fortune Wheel 2 in a row), rent week (night up 5m); Pike marks (Street Cups 3 in a row), read the deck
(HiLo 3), the long con (5x); Jo seed money (night up), grandfather's coin (Coin Flip 3), a real
bankroll (night up 15m). Minigame: each giver at 60%, 80% and perfect (6m/7m/8m). A generated
table task now skips any task written for the town (`nextFor` in `lib/story/jobs.ts`), so a
generated job can't use up another giver's written one. The news slips are now even, upright
casino marker cards (`.st-news`) with people's names in gold and game names in felt green
(`NewsText` in `components/story/notebook.tsx`). The street's gas station, truck and Road Out
sign moved from the left edge to the far right, past Cutter's back room (the road out is through
the boss), in both layouts; the back room moved left beside the casino and the rest of the wide
street shifted 290 units left to make room (`DUSTWATER_SCENE` in `lib/story/scene-theme.ts`).

**2026-11-05, street life (owner request):** shooting stars now and then (`ShootingStars`, three
streaks on 23s/37s/53s cycles), motel and casino windows that switch on and off (`Blink`, an
opposite-state overlay on a 57-102s stepped cycle, `WINDOW_PACE` 3, `.st-window`), and the diesel board shows a new
price each night (3.79-4.19, seeded by `night` on `SceneArtState`; 3.99 on the title screen). All
of it is `st-motion`, so reduced motion keeps the still street. Doors and sleep spots also carry a
faint gold outline at rest (`.st-hit`); the Room 5 hit area is the whole motel (`building` anchor; listed first so people on it stay on top; on the phone its plate sits inside the top-right corner, `plateInsideTall`); the casino's main doors sit 80 units right of centre
(`MAIN_DOOR_DX`); the motel-side lamp is drawn in front of the motel.

Checks for story work: `npx tsc --noEmit`, `pnpm lint` (3 known errors), `pnpm check:story`,
`pnpm sim:story` (slow: ~50 s for 3,000 circuits; `pnpm sim:story 500` for a quick run).

---

## 1. Owner decisions (all answered)

| Question | Answer |
|---|---|
| Minigame limit | only as a job, one attempt per job (since 2026-11-04; was once per character per night) |
| Portraits | drawn in code; style **mix 1, "warm noir"**: D's round faces, big eyes and chip frame + C's single lamp, gold rim light, halftone shadow, full colour |
| Tone | warm noir: likeable characters, real stakes, dry humour |
| Story-only game settings | allowed ("story mode can configure games such as Slots") |
| Survival perks / items | left out of story for now |
| Saves | one story save, "New story" behind a confirmation |
| Harsher loss option | no |
| Boss rematches | don't get easier (same buy-in, same rival, after 2 nights) |
| Standing (2026-11-03) | per town, 0 in every new town, remembered when you go back, max 5. +1 for every finished job (minigame jobs too, since 2026-11-04). A bust −1 (never below 0); a boss win gives none. `VENUE_REP` `[0, 1, 3]`: dive / main floor / high-roller |
| Standing bonus (2026-11-04) | standing 2 / 4 / 5: +5% / +10% / +20% of a winning night's table winnings, paid at the end of the night |
| Jobs (2026-11-04, rebuilt) | a minigame job and a table job each night at two givers with none (first night too; a coin flip for a last place); taken only by talking ("Not now" keeps it waiting); 1 per person; max 3 per town; written jobs first; table jobs 3m-5m, +1 standing, never repeat; minigame jobs one attempt, 6m-8m, no standing, may repeat (not back to back); kept in their town |
| Minigames (2026-11-04) | only played as jobs (no practice, no nightly pay); Jo runs Chip Count in every town |
| Rotation pin (2026-11-03) | while a taken job naming a game is open, the dive always deals that game (deterministic draw kept) |
| The player | unnamed "you", no portrait |
| Placement | story first on the home page and first in the navbar |
| Names | draft names kept (Jo, Sloane, Vale; seven cities since 2026-11-04) |
| Other modes' outlier payouts | **not decided**: Chicken Road (up to ~193%), HiLo (~142%), Slots (104.8%) are over 100% in Freeplay/Daily/Ladder/Challenges; owner was asked, no answer yet. Don't change them without a yes. |

Portrait reference: [.md/story/portrait-styles.html](story/portrait-styles.html) (also
published at https://claude.ai/artifact/E936D6NasWdu8dVrVryPvZ). Mix 1 is the `MIXES[0]`
treatment in its script (`Ds.treat` + `noirLight(1)` + `Cs.treat.rim`, frame `noirChip`).
Port that generator to TypeScript; don't redraw from scratch.

---

## 2. What is built

| Phase | Files | Notes |
|---|---|---|
| 1 Economy | `lib/story/economy.ts`, `lib/story/cities.ts`, `lib/story/odds.ts`, `scripts/story/sim.ts` (`pnpm sim:story`) | Results in plan section 5. Tuning done: boss buy-in 50m (was 60), purse 150m, free lodging below 10m ("the car"). |
| 1 Story game settings | `lib/story/odds.ts` (`STORY_SETTINGS`, `STORY_CHICKEN_ROAD_MULTS`, `storyHiloMult`, `STORY_SLOTS_PAYS`, `STORY_MINES_EDGE`, `STORY_POKER_PAYS`) | **Defined and simulated only; no engine reads them yet.** See 3b. |
| 2 Content model | `lib/story/types.ts`, `lib/story/dialogue.ts` (pure scene runner), `lib/story/content/` (`characters.ts`, `dustwater.ts`, `index.ts`) | Dustwater has 11 scenes (arrival, walkthrough, Marta ×2, Pike ×2, Jo at dawn, boss intro/win/loss, bust) and 5 errands. |
| 2 Save | `store/story-store.ts` (`floored-story`, version 5, synced as `story` via `lib/sync/keys.ts` + `components/account-sync.tsx`; v1 → v2 moves `rep` into `standing`) | |
| 2 Checks | `scripts/story/check-content.ts` (`pnpm check:story`) | Content rules + the save's rules played through (scenes, minigame pay, a night with errands/hustles/comps, bust, marker, boss, travel). |
| 3a Night rules | `store/story-store.ts`, `lib/story/hustles.ts` | Venues, table limits, bets/payouts, hustles, comps, errand goals, bust → standing −1 + bust scene, marker effect, scene queue, news. |
| Engine export | `games/slots/engine.ts` exports `REEL` and `resolveReels` | no behaviour change |

### The save (`store/story-store.ts`) in short
- Money in **dollars**; rules in multiples of the city's min bet (`minBet()`).
- `tonight` = a night at a venue: `venue` 0 dive (max 20m, always open) / 1 main floor
  (max 100m, standing ≥ 1) / 2 high-roller room (no max, standing ≥ 2); `bets` (max
  `NIGHT_BETS` 12), `openRound`
  (stake already taken), `rounds` (settled rounds, for hustles and errands), `startMoney`.
- Game hook contract to use: `placeBet(game, amount)` takes the stake (a second stake in
  the same open round, e.g. a double, adds to it without counting a new bet);
  `resolve(game, payout, settle)` credits payout (`settle: false` = partial, Plinko balls).
  Half of each win's **profit** repays a marker. `wagerCap()` = money capped by the venue
  (and 0 once the night's bets are used: `tonight.limit`, 5 or 10), `betsLeft()`.
- `endNight()` (after playing or resting): comps (by room: 4% / 5% / 6% of bets, cap 10m / 15m / 20m), hustles (2 a night,
  `hustlesFor(city, night)`, 4m each), night-up jobs, where you sleep (`endNight(place)`: the car or a room, `sleepCost`),
  bust check (money < min bet → `stats.busts`; no standing lost, a marker costs 1,
  queues the city's `bust` scene).
  Returns a `NightSummary`, also kept in `lastNight` for the hub.
- Jobs: `jobs` (offered and taken, every town), `openJobs()` (taken, this town), `jobAt`,
  `canTalk`, `talkTo`, `minigameJobAt`, `offerTonight()` (idempotent; called on a new story,
  each night, travel, a finished or lost job and the hub's mount). Goals `streak` / `night-up` /
  `big-win` are checked automatically; a finished table job pays `pay × m` and +1 standing.
- `playMinigame(giver, minigame, score)`: the one attempt at a taken minigame job: at the
  target it pays the job (no standing), short of it the job is lost; without a job it does nothing.
- Scenes: `queue` (arrival on new story/travel, boss-win/loss, bust), `playQueued()`,
  `startScene(id)`, `currentStep()`, `advance()`, `pick(index)`; `sceneFor(trigger)` finds
  the first matching scene in the city (talk scenes by character).
- Boss: `enterBoss()` pays 50m and sets `bossTable { seed }`; `bossResult(won)` pays 150m +
  the `<city>-cleared` flag (no standing), or sets `bossBackOn = night + 2`. Leaving the
  boss table must count as a loss (see 3e).
- `travelNext()` needs the city cleared (and no night on); the road is free since 2026-11-04.
- Known gap: `stats.busts` only counts busts found at `endNight()`; a bust mid-night is
  caught when the night ends.

---

## 3. What is next: Phase 3, the Dustwater slice

Order planned (tasks 3b–3f). Dustwater: min bet $5, games Coin Flip, Street Cups, HiLo,
Run Dice, Over-Under; minigame givers Marta (Last Orders) and Pike (Shuffle Tracker);
boss Cutter Hale at Liar's Dice; a Liar's Dice cash room is listed for the city but is
**out of the slice** (needs the Tables wallet adapter; do it with a later city).

### 3b. Story as a game mode (DONE 2026-11-03)
1. `lib/features.ts`: add `STORY_ENABLED = true` (lets the owner hide it before merging to
   main, since only Dustwater will exist). Gate routes/nav/home on it.
2. `store/types.ts`: add `'story'` to `GameMode`; fix whatever `tsc` flags. Game
   components check `mode === 'survival'` / `'ladder'` etc., so story behaves like
   freeplay inside a game (no perks, no curse/bless) — verify `hooks/use-curse.ts` /
   `use-bless.ts` don't apply in story.
3. `hooks/use-game-min-bet.ts`: `story` → `useStoryStore.minBet()`.
4. `hooks/use-game-bankroll.ts`: `useStoryGameBankroll(game)` like
   `useDailyGameBankroll` (same partial-payout handling with a ref), calling
   `placeBet` / `resolve`, returning `wagerCap()` and `betsLeft()`.
5. `hooks/use-run-end.ts`: add `'story'` to `MODES` (route mode); statuses: night over
   (12 bets used, no open round) → "Night over" + action "Back to Dustwater"; no night
   started → same action; money below the min bet → "Out of chips" + action back.
   `handleGameOver` → `router.push('/story')`.
6. **HiLo story pricing** (Dustwater needs it): `guessHiLo(state, guess, pricing?)` in
   `games/hilo/engine.ts`; story pricing: a right guess multiplies the current multiplier
   (start 1) by `storyHiloMult(pWin)` where pWin = cards strictly higher/lower over 13
   values; ties keep the multiplier. `components/games/hilo/game.tsx` passes it when
   `mode === 'story'` and shows the next multiplier per direction (line ~231 uses
   `streakMultiplier`). Other modes unchanged.
   The other story settings (Chicken Road, Slots, Mines, Poker) are needed only from
   Silver Mesa on; wire them the same way when those cities are built, with the
   numbers in `lib/story/odds.ts` (the simulator already uses them).
7. `app/story/[game]/page.tsx`: like `app/daily/[game]/page.tsx`; only the current city's
   games and only during a night (`tonight`), else redirect to `/story`. The story HUD
   (`table` prop) puts the back link at the left, standing at the far right, and the game,
   money, bets left and one "Table min / max" plaque centred between them (all 40px tall; on
   phones the limits and bets left sit in a row under the HUD). The board's status bar drops
   the game name and centres the message, the board has no "← Story" button (the HUD's back
   link leaves), and story games show no History corner for now (`GameFieldWithHistory`).
   A room's sheet before the night is 620px wide on desktop with tonight's four games in one
   row. Bets: `useStoryTableChips` in `game-dock-parts.tsx` gives
   four chips at the table min, ¼, ½ and all of the table max, then a "Max" pill; a room
   with no max spreads them as if the max were 100 min bets and the pill is "All in". No
   ¼ / ½ wallet-share pills in story. Every game with the shared chip row or chip picker
   gets this.

### 3c. Screens (DONE 2026-11-03; files: `lib/story/portraits.ts`, `components/story/{portrait,dialogue-box,hub}.tsx`, `app/story/page.tsx`, `app/story/layout.tsx`; expressions neutral/pleased/angry)
- `lib/story/portraits.ts` (port of the mix-1 generator: SVG string per character look and
  expression; static code-generated markup) + `components/story/portrait.tsx`. Looks needed:
  jo, sloane, vale (in the reference), notary (bald, round glasses, dark suit, purple chip
  `#6b5a8a`), marta (older, grey-streaked bun, apron, gold chip), pike (beanie, stubble,
  jacket, blue chip), cutter (hat brim, moustache, leather vest, brown chip). Chip colours
  are in `lib/story/content/characters.ts`.
- `components/story/dialogue-box.tsx`: portrait + speaker (gold mono caps) + line + choices,
  as in the reference page; narrator lines without portrait; "you" lines right-aligned, no
  portrait. Plays `currentStep()`; click/Enter advances.
- `app/story/page.tsx` (hub): no story → intro + "Start the story"; else: header strip
  (city, night, money, owed, rep), circuit map strip (7 cities, act groups, current and
  cleared), Play a night (venue picker by rep), People (talk → `sceneFor({on:'talk'})`;
  minigame button, "paid tonight" state), Jobs (tonight's hustles + taken jobs + who has an offer), Boss
  (intro scene → `enterBoss`), Rest / End the night (night summary panel), Travel when
  cleared, the Notary when broke, `news`. Plays queued scenes on mount
  (`playQueued()`). New story behind a confirm dialog.
- Navbar (`components/navbar.tsx` `MODES`): Story first; figure "Money". Home
  (`app/page.tsx` GUIDE + `components/mode-select.tsx`): a Story section first.
- Build from the shared pieces (`components/ui/*`, `GAME_DOCK_*` buttons, tokens); phone
  first (`max-*` variants don't exist; see `.md/MOBILE_UI_HANDOFF.md`).

### 3c+. Hub as a game screen (2026-11-03; visuals only, same store calls)
The hub is one screen that fits the viewport (no page scroll at 360×740, 390×844, 1440×900):
- `components/story/hud.tsx` `StoryHud`: wood title plate (city, night, rep stars on phones),
  chip-stack money, marker owed in red when > 0, rep stars, bets left during a night; `back`
  links to `/story`. Also used by the minigame and boss pages (boss: no back link, the
  table's own corner button forfeits with a confirm).
- `components/story/city-scene.tsx` + `scene-art.tsx`: the drawn street (SVG in code) with
  hotspots (`PersonSpot`, `PlaceSpot`). Two layouts by the stage's shape: `wide` (1600×790
  view) and `tall` (600×1060, phones). The art runs past the view box so other aspect ratios
  see more street. **A city's scene is config** in `lib/story/scene-theme.ts`
  (palette, pieces with a place per layout, hotspot spots by piece anchor or fixed point);
  cities without one use `genericScene` (blocks + casino with the city's name). People
  without a named spot use `p0`–`p3`; a boss without one uses `boss`.
- Hotspots open `action-sheet.tsx` (bottom sheet below `lg`, a card beside the hotspot
  from `lg`): venue doors (start the night / tonight's game tiles / chained with the rep
  needed), people (Talk, Play/Practice, their job), the boss (Talk, Sit down, buy-in and
  purse), the Notary (only when broke), Rest/End night at the motel room or the car (under
  where you slept last night), the road sign (Travel, lit once cleared). The bottom bar repeats the main
  action (Tables / End the night / The Notary / Hit the road / Rest).
- HUD buttons: Jobs (`notebook.tsx`, a matchbook with hustles and jobs, and last night's
  tab), Map (`circuit-map.tsx`, road atlas overlay), Menu (New story, behind the confirm).
  News are paper slips (`NewsSlips`). End of night shows `night-card.tsx` (a receipt);
  **queued scenes (bust) now play after "Next night"** instead of straight after ending.
- `dialogue-box.tsx`: speech bubbles with a tail at the speaker's medallion (up to two
  characters on stage, the other dims), a felt "you" bubble on the right, narrator caption
  cards; lines type out (36 letters/s; a tap first finishes the line), gold ▼ when done;
  choices are option cards (1–9 pick, arrows move). Reduced motion: whole lines, no motion.
- Title screen (`title-screen.tsx`): the Dustwater scene behind "The Circuit".
- Styles: the `st-*` block at the end of `app/globals.css`; every animation has `.st-motion`
  (or is listed) under `data-motion='reduced'` and `prefers-reduced-motion`.

### 3d. Minigames (`lib/story/minigames/*.ts` pure engines + `components/story/minigames/*`, route `app/story/minigame/[id]`)
- **Last Orders** (Marta): Simon-style memory; 6 drink icons; orders grow 3→8 items over
  rounds; score = rounds cleared ÷ max (the written jobs need 0.6, 0.8 and 1).
- **Shuffle Tracker** (Pike): 3 cups, follow the queen through N swaps, 5 rounds getting
  faster; score = right ÷ 5; with reduced motion, show swaps as slow discrete steps.
- First play each night pays (`playMinigame`); after that it's practice (no pay, but
  jobs still count). Boards fit without scrolling; respect reduced motion.

### 3e. Boss: Liar's Dice against Cutter
- Reuse the Tables runner and `components/tables/liars-dice-table.tsx` (tournament format,
  4 seats, 5 dice). Needed:
  - an optional `bots` override prop on the table component (seat 1 = Cutter:
    `BotProfile` id `cutter`, name "Cutter Hale", style rock-ish, skill `shark`);
  - a way for `components/tables/table-shell.tsx` to run without the Tables store: a
    context or props giving finish/forfeit/leave/back link and a custom result panel (it
    calls `useTablesStore` finish/forfeit/cashOut/wallet today).
- Win rule: **beat Cutter** — win if Cutter's place is decided before yours (Liar's Dice
  knocks out one seat at a time), loss if yours is decided first. Call `bossResult` once.
- Page `app/story/boss/page.tsx`: needs `bossTable`; a revisit or leaving = loss (like the
  Tables forfeit on revisit).

### 3f. Finish
- Browser playthrough of Dustwater start to finish at 1440×900 and 390×844 (Playwright is
  installed; see `scripts/design-check/*.cjs` for patterns), reduced motion.
- Grow `SHIPPED` in `scripts/story/check-content.ts` with every id once it ships to main.
- Docs: plan section 11 (Phase 3 row), README (a Story section), ARCHITECTURE, TODO.
- Owner playtest; Phase 4 tuning before writing cities 2–12 (Phase 5, three at a time).

---

## 4. Things to know

- **Numbers quoted in dialogue** must match the economy; `check:story` checks the boss
  buy-in ("fifty times the house minimum") and the Notary's marker line. If you change
  `BOSS_BUYIN_M` or the marker, change the text.
- **Content ids are stable** (saves refer to them). Rename text, never ids.
- **A choice node must keep one unconditioned option** (checker enforces it).
- `zustand persist` warns about missing storage when `check:story` runs in Node; harmless.
- `pnpm sim:story` measures 1-Player Poker by Monte Carlo through the engine (uses
  `Math.random`), so its poker line varies by ±0.5% between runs.
- Cash tables (`lib/tables/cash.ts`, the runner's `cash` option) are ready for story cash
  rooms later; they need story money in place of the Tables wallet.
