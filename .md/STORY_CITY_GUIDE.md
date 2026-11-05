# Story mode: setting up a city

How Dustwater (the only playable city so far) is built, so the other six cities follow the same shape.
Read [STORY_MODE_HANDOFF.md](STORY_MODE_HANDOFF.md) first (rules, the save, things to know) and the
city list in [STORY_MODE_PLAN.md](STORY_MODE_PLAN.md) section 3. Money is always in multiples of the
city's minimum bet `m` (`lib/story/economy.ts`); never write a dollar figure into content.

**Premise** (for tone and consistency): six months ago your grandfather owned the Gilded Floor
(forty tables, a brass bar, Jo dealing the late shift). Vale, head of the Syndicate, won the deed in
one hand; half the circuit's houses pay Vale rent. He left you his car, his debts and a three-word
note: get it back. Vale plays only champions: six towns, a house champion in each. Beat all six
and Vale owes you a seat at the Summit; win there and the Gilded Floor is yours again. Tone: warm
noir, likeable people, dry humour, short lines.

## 0. The template: every city works like Dustwater (owner decision 2026-11-05)

Cities 2-6 copy Dustwater's shape exactly. Only the things in the "changes" table differ; the rules,
the numbers in `m` and the screens stay the same. The Summit (city 7, the final) is the one exception
and gets its own design later.

**The shape of a city**

| Part | Dustwater | Every city |
|---|---|---|
| Locals | Marta, Pike, Cutter Hale | **3 locals**: 2 job givers with a minigame each, and 1 **boss** (the local without a minigame) |
| Travelling | Jo (right of the car, Chip Count) | Jo, the same in every town: third job giver, Chip Count, the tips |
| Sleep | the car (free, 5 bets) and Room 5 at the Starlite (3m in Dustwater, 4m after; 10 bets; standing 2) | **2 places**: the car (cheap: free) and a room (expensive) with the same costs, bets and standing (`SLEEP_COST_M`, `SLEEP_BETS`, `SLEEP_REP`) |
| Floors | the dive, the main floor, the high-roller room | **3 floors**: the dive (standing 0, bets up to 20m), the main floor (standing 1, up to 100m), the high-roller room (standing 3, no limit) (`VENUE_REP`, `VENUE_MAX_M`) |
| Games | 8 house games, 4 per floor a night | 8 house games in `cities.ts`, each floor draws 4 a night (`GAMES_PER_ROOM`, random per story) |
| Practice table | Liar's Dice in the high-roller room | the **boss's own bot game** as a practice tournament in the **high-roller room**, buy-in `PRACTICE_BUYIN_M` (10m), takes the night (section 6) |
| Boss | Cutter Hale, Liar's Dice, back room | a boss `Bot` at the city's bot game; buy-in `BOSS_BUYIN_M` (100m), purse `BOSS_PURSE_M` (300m), rematch after `BOSS_REMATCH_NIGHTS` (2) |
| Services | Marta's diner, Pike's loans, Jo's tips | the **same three services**: one local `sells: 'meal'` (a plate, 2m, +2 bets, once a night), one local `lends: true` (20m at 1.5x, +0.25x per extra loan here, half of each win's profit, -1 standing), Jo's tips (two lines on tonight's games) |
| Jobs | 3 written table + 3 minigame jobs per giver, then generated | the same rules (section 4); every table job names **this city's games** |

**What changes from city to city** (and where it is set)

| What | Where | Note |
|---|---|---|
| Minimum bet `m` | `cities.ts` `minBet` | Scales everything in `m` with it: floor maxes (20m / 100m), the room price, the plate, loans, jobs, comps caps, the practice and boss buy-ins and the purse. Rises about four times a city |
| House games (8) | `cities.ts` `games` | Every house game is in exactly two cities (`check:story`). The floors draw from these; jobs and Jo's tips follow them |
| Boss game | `cities.ts` `boss` | The bot game the boss plays; the high-roller room's practice table deals the same game, so the player can learn it first |
| Boss | `content/characters.ts`, `lib/story/boss.ts` | Name, look, a `Bot` profile kept out of the Tables pool, intro/win/loss scenes |
| Two local job givers | `content/characters.ts` | Names, looks, chips, their `minigame`, which one `sells: 'meal'` and which one `lends` |
| Their minigames | `lib/story/minigames/*`, `components/story/minigames/*` | One new minigame per giver (Jo's Chip Count is shared) |
| Written jobs | `content/<city>.ts` | Three table and three minigame jobs per giver (Jo too), naming this city's games |
| The diner's dish | `cities.ts` `plate` | Text only, for variety ("Hot plate & coffee" in Dustwater); price and bets never change |
| Names on the street | `lib/story/scene-theme.ts` | Casino sign, `motelName`, `barName`, palette, building places |
| Scenes and lines | `content/<city>.ts` | Arrival, a talk scene per local, boss scenes, bust |

**What never changes per city:** standing (0-5, per town, jobs +1, loans -1) and its bonus,
comps (4% / 5% / 6% by floor), hustles (two a night, 4m), bets a night (5 after the car, 10 after
a room, +2 with a plate), job rules and pay ranges, the boss rules, travel (free once the boss is
beaten). Jo's tips need no writing: they read tonight's games from the city's list.

## 1. The city entry: `lib/story/cities.ts`

The seven entries already exist (ids are saved, never rename `id`; `name` can change). A city is
playable once it has content. Fields: `id`, `name`, `act` (1-4), `feel`, `minBet` (dollars, the unit
`m`, rising city to city), `games` (house games on its floors, or `'all-seen'` for the Summit),
`tables` (the plan's Tables rooms; not read by the story yet), `boss` (`table` with a Tables game, or
`final`), `minigameGivers` (characters with a minigame, used by the sim), `plate` (the diner's
dish, text only). Travel to the next city is free
once its boss is beaten. Order in the array is the circuit order.

**Rooms and games.** Each night every room (0 dive, 1 main floor, 2 high-roller) draws
`GAMES_PER_ROOM` (4) of `games` via `gamesFor(city, night, venue, seen, seed)` in
`lib/story/rotation.ts` (seeded by the story's `seed` + city+night+room, so every story deals its own lineups and a reload never rerolls; keeps at least one game from the room's previous
night; offers all if the city has 4 or fewer). It uses the store's global `night`. Give a city at
least 5-6 games so rotation means something. The rooms are gated by **standing in that town**
(`VENUE_REP` `[0, 1, 3]` in `lib/story/economy.ts`): the dive always, the main floor at standing 1,
the high-roller room at 3. Standing 2, 4 and 5 open nothing; they raise the **standing bonus**
(section 4). The hub lists lineups; `app/story/[game]/page.tsx` redirects games not in
tonight's lineup in the room you sat in. `check:story` tests every city's rotation and that every
house game appears in at least two cities.

**Jobs only name games dealt tonight.** Job offers draw their games from `openRoomGames()`: tonight's
lineups in every room your standing opens. A written job that names a game waits for a night that game is
dealt (the giver's next written job of that kind, or a generated one, comes first). Offers last one night
(`JOB_OFFER_NIGHTS` 1), so an offer never names a game that's gone. A job you took stays until you finish
or drop it, and its game may not be dealt every night. Rooms are never changed for a job.

## 2. Characters: `lib/story/content/characters.ts`

`{ id, name, note, city, chip, minigame? }`. `id` is stable (scenes, jobs, portraits and saves use
it). `note` is for writers, never shown. `city` is a `CityId`, or `null` for recurring characters
(Jo, Sloane, Vale). `chip` is the hex colour of the portrait's chip frame. `minigame` is a
`MinigameId` (`lib/story/types.ts`): played only as that character's minigame jobs. A city has 3 locals:
two minigame givers and a **boss** = the one local without a minigame (the hub finds the boss that
way). **Job givers** (`jobGivers` in `lib/story/jobs.ts`) are the locals with a minigame plus Jo,
who travels with you, stands right of the car (`jo` spot) and runs **Chip Count** in every town;
`TRAVELLING_GIVERS` lists Jo. Every job giver needs a minigame (`check:story` fails one without).
Give exactly one local `lends: true` (the town's lender: loans any night on the marker terms; Pike
in Dustwater) and one `sells: 'meal'` (the diner: +2 bets tonight for 2m; Marta). Name the dish in
the city's `plate`.
Jo's tips on tonight's games come for free from the city's game list (`lib/story/tips.ts`).

**Portrait look:** add the id to `PortraitLook` and `PORTRAIT_LOOKS` in `lib/story/portraits.ts`,
a face path in `FACE`, and a `CHARS` entry (skin, hair, cloth, shirt, accent, `chip`, plus
`hairBack`/`hairFront`/`extra`/`clothes` string generators; copy a similar character). Three
expressions (`neutral`, `pleased`, `angry`) come from the shared generator. Compare with
`.md/story/portrait-styles.html` (mix 1, warm noir). Check it at small size in the dialogue box.

## 3. Scenes: `lib/story/content/<city>.ts` and `index.ts`

Export `<CITY>_SCENES` and `<CITY>_JOBS`; register them in `lib/story/content/index.ts`
(`SCENES`, `WRITTEN_JOBS`). A `Scene`: `{ id, city, trigger, if?, once?, start, nodes }`. Ids are
`<city>-<name>` and **stable forever**: rename text, never ids; adding nodes is fine.

**Triggers** (`SceneTrigger`): `arrival` (first arrival in the city; queued on travel), `talk`
(`character`: the first scene whose `if` holds and not yet seen), `boss-intro`, `boss-win`,
`boss-loss`, `bust` (after a bust in this city), `dawn` (queued the morning after a night here, the
first one whose `if` holds; Dustwater has none now), `tutorial` (Dustwater's walkthrough only: queued
after arrival on a new story, replayable from the hub menu; `once: false`). `once` defaults true;
`once: false` scenes replay (boss-intro, boss-loss, bust).

**Nodes:** `line` `{ speaker, expression?, text, next }`; `choice` `{ prompt?, options[] }` with each
option `{ text, to, if?, effects? }`; `end` `{ effects? }`. Speakers: a character id, `'you'`,
`'narrator'`. After one scene ends the next queued scene plays.

**Conditions** (`if`): `{ flag }`, `{ not }`, `{ all }`, `{ any }`, `{ faction, atLeast }`,
`{ moneyAtLeast }` (in `m`). **Effects:** `{ set: flag }`, `{ clear }`, `{ faction, delta }` (factions
`syndicate`, `old-guard`, `underground`), `{ money }` (in `m`), `{ rep }`, `{ marker: true }`.
(`{ job, step: 'accept' }` exists only in the store's offer scenes; content never hands out a job,
and the checker fails one that tries.) A boss-win scene must set `<city>-cleared` (it opens the road;
the checker allows this flag everywhere).

**Checker rules** (`scripts/story/check-content.ts`, `pnpm check:story`): ids unique; every
character/job/speaker/node named exists; every node reachable and every path ends; **a choice
node keeps at least one option with no `if`**; every flag read is set somewhere; cities rise in
stakes; every house game in 2+ cities; shipped ids (`SHIPPED`) still exist; the rotation rules; the
save played through (arrival, walkthrough, a night, comps by room, bust, marker, boss, travel).
**Numbers quoted in dialogue must match the economy.** Checked today: the boss buy-in ("a hundred times
the house minimum to sit"), the lender's loan ("twenty times the minimum, repaid at one and a
half"), and Jo's walkthrough (dive/main floor limits, the room standing thresholds, the standing a job
aims and a marker costs, the standing cap, the standing bonus steps and rates, the jobs a town gives at once,
bets a night, games per room, side goals, rematch wait; the `QUOTES` list). Prefer "times the house minimum" phrasing; if you
quote a new number, add its regex to `QUOTES` or `WORDS` there.

## 4. Jobs and hustles

**Jobs** (`lib/story/jobs.ts`, owner decision 2026-11-04; one system, replacing the old errands
and spawned jobs). The rules, all in code and all tested by `check:story`:

- **Two kinds, two offers a night:** a **minigame job** and a **table job**, at two different
  random givers who hold none, while the town holds fewer than `JOB_LIMIT` (3), offered or
  taken. With one place left a coin flip picks the kind; a place freed later that night brings
  the kind still missing. The first night in every town works the same way.
- **Only talking takes a job.** The giver gets a briefcase marker and "has a job for you"; Talk
  plays any new scene of theirs first, then their pitch with "I'll do it" / "Not now". Not now,
  or never talking to them, leaves the offer waiting until the next night (`JOB_OFFER_NIGHTS` 1); then it
  leaves (it was never given, so it may come back later) and the giver is free.
- **Drop a job** you took from the person's card (`dropJob`): no pay, no standing, giver free.
- **One job per person** until it is finished: they offer nothing new before that.
- **Table jobs never repeat in a town** (`goalKey`: kind + game + numbers); **minigame jobs may
  repeat**, but never the same one twice in a row from a giver. Each giver's **written jobs of a
  kind come first**, in content order, then generated ones from
  `JOB_TEMPLATES` (seeded by the story's seed, town and night; only tonight's games in open rooms): a streak at one of the town's games (2 or 3 wins; always 2 at a low-odds game,
  `LOW_ODDS_GAMES`, whose rounds win a third of the time or less; never at Slots or Plinko, `NO_STREAK_GAMES`,
  under 20% a round),
  a big win (2x to 5x), a night up (by any amount, or 5/10/15/20 minimum bets), or a score at the
  giver's own minigame (60%, 80%, perfect). A generated table task never takes a task some giver
  in the town has written, so every written job is still there when its turn comes. Dustwater has about 20 table tasks; when a town has
  no new table task left, only minigame jobs come.
- **Pay and standing:** a table job pays 3m-5m (`TABLE_JOB_PAY_M`) and earns `JOB_STANDING` (1)
  up to `STANDING_MAX`. A minigame job is **one attempt**: at the target it pays 6m-8m
  (`MINIGAME_JOB_PAY_M`: 60% / 80% / perfect) and **no standing**; a miss pays nothing and the
  job is gone. Pressing Start uses the attempt: leaving mid-game counts as a miss. Minigames are **only played as jobs** (no practice, no other pay).
- **Jobs belong to their town**: leave and they wait there for your return.

The save keeps `jobs` (every offered and taken job, each with `status`; ids `city:night:giver:kind`), `jobsGiven` (task keys
per town) and `jobNight` (each town's last offer night and the kinds it brought). Offer scenes are built from the save
(`offer:<job id>`), never written in content and never added to `seen`.

**Written jobs** (`WrittenJob`: `id`, `city`, `giver`, `title`, `task`, `goal`, `pay`, `pitch`):
`goal` is `minigame` `{ minigame, score 0-1 }` (the giver's own minigame; checked on every play,
practice included), `streak` `{ game, wins }` (that many wins in a row, a game in the city's list), `wins`
`{ game, wins }` (that many wins at the game in one night, in any order), `night-up` (end a night
at the casino up, by `atLeast` minimum bets when given) or `big-win` `{ mult }`. `pitch` is what
the giver says when offering it, one line each. The checker verifies the giver gives jobs in that
city, the minigame is theirs, the streak or wins game is in the city, `LOW_ODDS_GAMES` and `NO_STREAK_GAMES` match the story odds, the pay is in range, no two written
jobs in a city share a task, and every town can offer at least `STANDING_MAX` different jobs.
Dustwater gives each giver three table and three minigame jobs (Marta, Pike, Jo); copy that.

Standing starts at 0 in each town and jobs are the only way up (a loan from the town's lender takes one off; going broke alone costs none). What each
step gives:

| Standing | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Gives | the dive | main floor | +5% bonus | high-roller room | +10% bonus | +20% bonus |

**The standing bonus** (`STANDING_BONUS`, `standingBonus` in `lib/story/economy.ts`): end a night
up at the tables (payouts less stakes over the night's rounds, above 0) and the house adds that share
of it at the end of the night, after comps. Standing as the night closes counts, so a job finished
that night already raises it. It shows on the night's receipt and beside the stars in the HUD. It is
the reason to keep doing jobs once every room is open. Same numbers for every city; a city changes
nothing here.

**Hustles** (`lib/story/hustles.ts`): two a night, 4m each, paid at the end of a night you played.
Drawn from a shared `POOL` by `hustlesFor(city, night, seed)` (seeded by the story's seed and `hustles:<city>:<night>`, so a reload
shows the same board). Nothing to add per city unless you want city-specific hustles; if you do, keep
them pure (`met(rounds)`) and seeded.

## 5. Minigames

One per giver, played **only as a job** (section 4): one attempt, the job's target decides the pay.
Parts: pure engine in `lib/story/minigames/<id>.ts` (seeded `rng.ts`; returns a score 0-1), board in
`components/story/minigames/<id>.tsx`, its `MinigameId` (already in the type union),
and a registration in `app/story/minigame/[id]/page.tsx` (`INFO` entry with title, rule, intro, plus
the `Board` choice at the bottom). Hub buttons come from the giver's `minigame` field. Built:
`last-orders` (Marta), `shuffle-tracker` (Pike), `chip-count` (Jo, every town). Remaining ids are listed in `MinigameId`.

## 6. The boss and the practice table

**The boss.** Profile and rules live in `lib/story/boss.ts` (Dustwater: `CUTTER_HALE` bot, `BOSS_SEATS`,
`bossOutcome(standings, over)`: you win when the rival's seat is out before yours). The page is
`app/story/boss/page.tsx`: it runs the city's Tables game (Liar's Dice) with a `TableHostContext`
host (`components/tables/table-shell.tsx` lets a non-Tables mode supply the buy-in, bots and result),
calls `enterBoss()` (buy-in `BOSS_BUYIN_M` 100m) and `bossResult(won)` (purse `BOSS_PURSE_M` 300m, sets
`<city>-cleared`, no standing; a loss, or leaving, sets a return `BOSS_REMATCH_NIGHTS` (2) nights
later with the same terms). The page is written for Liar's Dice and Cutter today: for a new city,
make it pick the city's boss game (`TABLE_REGISTRY`, as the practice page does) and boss `Bot`. Per
city: a boss `Bot` (keep it out of the general bot pool), and the `boss-intro/win/loss` scenes.

**The practice table** (built 2026-11-05; nothing to add per city). The high-roller room's sheet
offers "Sit at the table" beside "Start the night": the boss's bot game (`practiceGame()` reads
`cities.ts` `boss.game`) as a Tables tournament against regular bots, no boss seated, so the player
can learn the game before the showdown. `sitAtPractice()` needs the room open (standing 3) and no
night on, takes `PRACTICE_BUYIN_M` (10m) and starts the night in the high-roller room with no bets
(`tonight.table`). `app/story/table/page.tsx` runs it through `TABLE_REGISTRY` and the story host;
your place pays from the no-rake pool as Tables tournaments pay (`payoutsFor`; Liar's Dice and
Showdown winner takes all, Hold'em 65/35). Leaving before your place is decided, or reloading a dealt
table, is last place. `practiceResult(place, prize)` pays once (the buy-in back whole, half of any
profit to a loan); the night's receipt shows the place and the pot. A table night has no comps,
hustles or standing bonus, and finishes no night-up or win jobs.

## 7. Story game settings: `lib/story/odds.ts`

Story mode needs every bet to return under 100% (the sim fails otherwise). Games whose base numbers
are over or fair-with-rounding have a **story setting**, played only when `mode === 'story'`:
Chicken Road (`STORY_CHICKEN_ROAD_MULTS`), HiLo (`storyHiloMult`), Slots (`STORY_SLOTS_PAYS`),
Mines (`STORY_MINES_EDGE`), 1-Player Poker (`STORY_POKER_PAYS`). `STORY_TARGET_RTP` is 0.96.
**HiLo is wired; the pattern to copy:** the engine takes an optional `pricing` argument
(`games/hilo/engine.ts`: `HiLoPricing`, `storyNextMultiplier`, `guessHiLo(state, guess, pricing?)`),
the game component passes `mode === 'story' ? storyHiloMult : undefined`
(`components/games/hilo/game.tsx`), Freeplay/Daily/Ladder/Challenges pass nothing and are unchanged,
and the sim's `storyOdds` reads the same constants. Do the same for Chicken Road, Slots, Mines and
Poker before their city ships (Silver Mesa needs Mines, Slots and Poker; Bayou Crossing Chicken Road). Tooltips and rules text must show the story numbers. Never change a game's base
numbers (owner has not decided the Freeplay outliers).

## 8. The drawn city scene

`lib/story/scene-theme.ts`: add a `ScenePalette` and a `CitySceneConfig` to `SCENES`: `palette`,
`view` (shared `VIEW`: `wide` 1600x790 and `tall` 600x1060 layouts), `sign` (`text`, `dead` letter
indexes, `flicker`), `motelName`, `barName`, `pieces` (`{ id, kind, wide: ..., tall: ... }` places),
and `spots`: hotspots by id (`dive`, `main`, `high`, `rest`, `car`, `road`, `notary`, `boss`,
character ids, `jo` (Jo, right of the car), `p0`-`p3` for people without a named spot), each either `{ piece }` or `{ at: { wide,
tall } }`. `components/story/scene-art.tsx` draws the pieces (`PieceKind`); add a new kind there only
for a new building. `sceneConfigFor(id, name)` falls back to a **generic night street** with the city
name on the casino sign, so a city is playable before it has art. A `PlaceSpot` can trace a piece's own shape instead of its box (`shape`: a path in the piece's units
and its box; the car uses `CAR_OUTLINE`). Check hotspots do not overlap and
sit on the street at both layouts (screenshots below).

## 8b. Visual lessons from Dustwater (don't repeat these)

Every one of these was a fix the owner asked for on Dustwater between 2026-11-02 and 2026-11-05.
Build a new street with them from the start, and check each one in the screenshots.

**Hotspots and labels**
- **The hit area covers the whole thing you tap**, not a small box on it: Room 5's covers the whole
  motel (`building` anchor, sized to the building). A big hotspot is listed **first** in `spots` so the
  people standing on it stay clickable on top.
- **The outline follows the piece's shape** where a box would look wrong: the car traces its body
  (`PlaceSpot` `shape`, `CAR_OUTLINE` in `scene-art.tsx`). Keep the shape path in step with the drawing.
- **Anchors move with the art.** When a door moves (the casino's main doors sit `MAIN_DOOR_DX` 80
  units right of centre), its hotspot anchor in `scene-theme.ts` moves with it.
- **Plates never collide.** Name plates scale with the street (`--u`), hug the side near an edge
  (`data-edge`), and can sit inside a building's corner on the tall street (`plateInsideTall`).
  Nudge people and pieces until no plate or medallion overlaps, in **both** layouts.
- **Sheets stay inside the stage**: a card beside a hotspot is clamped to the street (`--sw`). Check
  hotspots near the left and right edges.

**The street**
- **Order along the street tells the story**: the road out stands past the boss's back room, at the
  end of the street, so the way out leads through the boss. Leave clear space between the back room
  and the road out.
- **Nothing pokes through**: sign poles stand clear of buildings (the Starlite pole), the moon sits in
  open sky clear of the HUD and the news cards (both layouts), and a street lamp next to a building is
  drawn **in front** of it so its post shows (draw order in `pieces`).
- **Ways in from the road**: a narrow path of cracked, uneven slabs to the dive's side door and a
  gold-edged red carpet to the main doors, both placed from the casino piece (`Walkways`), so they
  follow it in either layout.
- **Locked doors** use the casino lock (`Locked` in `scene-art.tsx`: velvet rope on brass posts, a
  chip padlock), never chains.
- **Motion is slow and never on a beat**: windows switch on 57-102s stepped cycles, shooting stars on
  23/37/53s cycles, signs flicker one letter. Every decorative animation carries `st-motion`, so
  reduced motion keeps the still street.
- **Small living details** are seeded and change night to night (the diesel price 3.79-4.19 from
  `night`); keep them seeded so a reload shows the same street.

**Cards, buttons and boards**
- **News slips** are even, upright casino marker cards (dark felt, gold hairline, chip stripe), one
  width, no tilt, no gold side stripe. Names show in gold, game names (house, table and minigames) in
  felt green, always by the game's real label.
- **A person's card** offers each service as a round brass button (Talk, Diner, Loan, A tip, Play,
  Drop job); each service opens a paper card in the receipt's style (the menu, the I.O.U., Jo's
  notebook page). No plain text buttons.
- **A floor's sheet** lists tonight's four games in one row before the night (620px wide on
  desktop); in the room, each game tile shows its picture **once**, in its own band above the name.
- **A story game** plays inside the story frame: the HUD carries the back link, money, bets left and
  one "Table min / max" plaque (all 40px tall); the board drops its own "← Story" button and the game
  name in its status bar; bet chips follow the floor's limits (min, a quarter, half, all of the max).
- **Minigame boards** must not flash between rounds: hide the next round at once and fade it **in**
  (a fade-out after the swap shows the next stack for a moment; Chip Count had this).
- **Story is desktop only** for now: below 640px every story page shows a desktop-only note. The
  tall street still shows on narrow desktop windows (width under about the height), so both layouts
  still need checking.

## 9. Checklist for a new city

1. Check `cities.ts` (games, tables, boss kind, `minigameGivers`) still suits the story you want.
2. Wire any story game settings the city's games need (section 7), with `pnpm sim:story`.
3. Characters (section 2): two givers and a boss, portrait looks, chip colours, who `sells: 'meal'`
   and who `lends`; name the diner's dish in `plate`.
4. Minigames for its givers (section 5), then their `MinigameId` goals in written jobs.
5. `content/<city>.ts`: arrival, a `talk` scene per local, boss intro/win/loss, bust; a few
   written jobs per giver, Jo included (section 4: pitch lines, table jobs 3m-5m, minigame jobs
   6m-8m, no repeated task). Dustwater gives each giver three of each kind, the model to follow.
   Generated jobs follow on their own. Register in `content/index.ts`. Quote numbers only as the
   checker allows.
6. Boss (section 6): the boss `Bot`, and the boss page made to run the city's boss game. The
   practice table needs nothing (it reads `boss.game`); check it opens at standing 3.
7. Scene art (section 8), built with the visual lessons (section 8b), or accept the generic street.
8. Checks: `npx tsc --noEmit`, `pnpm lint` (3 known errors: `lib/game-registry.tsx` x2,
   `lib/survival/migrate.ts`), `pnpm check:story`, `pnpm sim:story` (add `500` for a quick run).
   Run the sim after any economy or game-list change; it models the room rotation, room comps and
   per-town standing. **Check the standing path in the sim**: does the whole circuit still finish in
   100-160 nights (median, balanced and cautious; about 11-12 nights a city), with nobody stuck and no player type that can't reach the
   high-roller room before the boss? (The sim offers one job a night up to three and pays the bonus.)
9. Playwright at 1440x900 and a tall desktop window (e.g. 800x1100) for the tall street (`deviceScaleFactor` 1, `pnpm dev`): new story or set
   `floored-story` in localStorage, play arrival, talk to everyone, check the rooms lock and unlock
   as standing rises (0 / 1 / 3), check one new job offer a night (and Jo's spot), play a night in each room (set `standing` for the town), sit at the practice
   table in the high-roller room, end the night (receipt), the map, the boss. Look at the screenshots
   against section 8b.
10. When the city ships to main, add its scene/job/character ids to `SHIPPED` in
    `scripts/story/check-content.ts` (never remove ids). Update the handoff, plan section 11 and
    README.

Files you will touch: `lib/story/cities.ts` (rarely), `content/characters.ts`, `content/<city>.ts`,
`content/index.ts`, `lib/story/portraits.ts`, `lib/story/minigames/*`, `components/story/minigames/*`,
`app/story/minigame/[id]/page.tsx`, `lib/story/boss.ts`, `app/story/boss/page.tsx`,
`lib/story/odds.ts` + the game's engine/component, `lib/story/scene-theme.ts`,
`components/story/scene-art.tsx`, `scripts/story/check-content.ts`. Not per city: the practice table
(`app/story/table/page.tsx`), the services and the job rules.
