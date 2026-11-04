# Story mode: setting up a city

How Dustwater (the only playable city so far) is built, so cities 2-12 follow the same shape.
Read [STORY_MODE_HANDOFF.md](STORY_MODE_HANDOFF.md) first (rules, the save, things to know) and the
city list in [STORY_MODE_PLAN.md](STORY_MODE_PLAN.md) section 3. Money is always in multiples of the
city's minimum bet `m` (`lib/story/economy.ts`); never write a dollar figure into content.

**Premise** (for tone and consistency): six months ago your grandfather owned the Gilded Floor
(forty tables, a brass bar, Jo dealing the late shift). Vale, head of the Syndicate, won the deed in
one hand; half the circuit's houses pay Vale rent. He left you his car, his debts and a three-word
note: get it back. Vale plays only champions: twelve towns, a house champion in each. Beat all twelve
and Vale owes you a seat at the Summit; win there and the Gilded Floor is yours again. Tone: warm
noir, likeable people, dry humour, short lines.

## 1. The city entry: `lib/story/cities.ts`

The twelve entries already exist (ids are saved, never rename `id`; `name` can change). A city is
playable once it has content. Fields: `id`, `name`, `act` (1-4), `feel`, `minBet` (dollars, the unit
`m`, rising city to city), `games` (house games on its floors, or `'all-seen'` for the Summit),
`tables` (Tables rooms: cash/tournament), `boss` (`challenge`, `table` with a Tables game, or
`final`), `minigameGivers` (characters with a minigame, used by the sim). Fare to the next city is
`TRAVEL_FARE_M` (20) of the NEXT city's `m`. Order in the array is the circuit order.

**Rooms and games.** Each night every room (0 dive, 1 main floor, 2 high-roller) draws
`GAMES_PER_ROOM` (4) of `games` via `gamesFor(city, night, venue, seen, must)` in
`lib/story/rotation.ts` (seeded by city+night+room; keeps at least one game from the room's previous
night; offers all if the city has 4 or fewer). It uses the store's global `night`. Give a city at
least 5-6 games so rotation means something. The rooms are gated by **standing in that town**
(`VENUE_REP` `[0, 1, 2]` in `lib/story/economy.ts`): the dive always, the main floor at standing 1,
the high-roller room at 2. The hub lists lineups; `app/story/[game]/page.tsx` redirects games not in
tonight's lineup in the room you sat in. `check:story` tests every city's rotation and that every
house game appears in at least two cities.

**Errands pin games into the dive.** While an errand that names a game is open (a `streak` goal such
as Pike's marks needing Street Cups), `openErrandGames()` feeds `must` into `gamesFor`, and the dive
always deals that game. The draw stays deterministic; the pin only replaces slots. The errand card
says so ("Street Cups is on at the dive while this job is open").

## 2. Characters: `lib/story/content/characters.ts`

`{ id, name, note, city, chip, minigame? }`. `id` is stable (scenes, errands, portraits and saves use
it). `note` is for writers, never shown. `city` is a `CityId`, or `null` for recurring characters
(Jo, Sloane, Vale, the Notary). `chip` is the hex colour of the portrait's chip frame. `minigame` is a
`MinigameId` (`lib/story/types.ts`): that character offers it once per night. A city has 2-3 locals:
minigame givers, an errand giver, and a **boss** = the one local without a minigame (the hub finds
the boss that way).

**Portrait look:** add the id to `PortraitLook` and `PORTRAIT_LOOKS` in `lib/story/portraits.ts`,
a face path in `FACE`, and a `CHARS` entry (skin, hair, cloth, shirt, accent, `chip`, plus
`hairBack`/`hairFront`/`extra`/`clothes` string generators; copy a similar character). Three
expressions (`neutral`, `pleased`, `angry`) come from the shared generator. Compare with
`.md/story/portrait-styles.html` (mix 1, warm noir). Check it at small size in the dialogue box.

## 3. Scenes: `lib/story/content/<city>.ts` and `index.ts`

Export `<CITY>_SCENES` and `<CITY>_ERRANDS`; register them in `lib/story/content/index.ts`
(`SCENES`, `ERRANDS`). A `Scene`: `{ id, city, trigger, if?, once?, start, nodes }`. Ids are
`<city>-<name>` and **stable forever**: rename text, never ids; adding nodes is fine.

**Triggers** (`SceneTrigger`): `arrival` (first arrival in the city; queued on travel), `talk`
(`character`: the first scene whose `if` holds and not yet seen), `boss-intro`, `boss-win`,
`boss-loss`, `bust` (after a bust in this city), `tutorial` (Dustwater's walkthrough only: queued
after arrival on a new story, replayable from the hub menu; `once: false`). `once` defaults true;
`once: false` scenes replay (boss-intro, boss-loss, bust).

**Nodes:** `line` `{ speaker, expression?, text, next }`; `choice` `{ prompt?, options[] }` with each
option `{ text, to, if?, effects? }`; `end` `{ effects? }`. Speakers: a character id, `'you'`,
`'narrator'`. After one scene ends the next queued scene plays.

**Conditions** (`if`): `{ flag }`, `{ not }`, `{ all }`, `{ any }`, `{ faction, atLeast }`,
`{ moneyAtLeast }` (in `m`). **Effects:** `{ set: flag }`, `{ clear }`, `{ faction, delta }` (factions
`syndicate`, `old-guard`, `underground`), `{ money }` (in `m`), `{ rep }`, `{ errand, step:
'start' | 'done' }`, `{ marker: true }`. A boss-win scene must set `<city>-cleared` (it opens the road;
the checker allows this flag everywhere).

**Checker rules** (`scripts/story/check-content.ts`, `pnpm check:story`): ids unique; every
character/errand/speaker/node named exists; every node reachable and every path ends; **a choice
node keeps at least one option with no `if`**; every flag read is set somewhere; cities rise in
stakes; every house game in 2+ cities; shipped ids (`SHIPPED`) still exist; the rotation rules; the
save played through (arrival, walkthrough, a night, comps by room, bust, marker, boss, travel).
**Numbers quoted in dialogue must match the economy.** Checked today: the boss buy-in ("fifty times
the house minimum to sit"), the Notary's marker ("twenty times the minimum, repaid at one and a
half"), and Jo's walkthrough (dive/main floor limits, the room standing thresholds, the standing a job
aims and a bust costs, the standing cap, bets a night, games per room, side goals, rematch wait;
the `QUOTES` list). Prefer "times the house minimum" phrasing; if you
quote a new number, add its regex to `QUOTES` or `WORDS` there.

## 4. Errands and hustles

**Errands** (`Errand`: `id`, `city`, `giver`, `title`, `task`, `goal`, `opens?`, `pay?`, `rep?`):
4 per city (`ERRANDS_PER_CITY`), 6m each (`ERRAND_PAY_M`), paid when done. `goal`: `minigame`
`{ minigame, score 0-1 }` (checked on every play of that giver's minigame, practice included),
`streak` `{ game, wins }` (the game must be in the city's list), `night-up` (end a night at the
casino up), `big-win` `{ mult }` (one bet returning mult x the stake or more). `opens` is a
`Condition` (usually `{ flag: 'met-<giver>' }` set by their talk scene); a scene can also start it
with `{ errand, step: 'start' }`. The checker verifies the giver exists, a minigame goal has a giver
in that city, and a streak game is in the city.

**Standing.** Every errand has an optional `rep` (0-5, `errandStanding` in `lib/story/economy.ts`).
It defaults to `ERRAND_STANDING` (1) for a goal won at the tables (`streak`, `night-up`, `big-win`)
and 0 for `minigame`: minigame jobs pay money, never standing, so the player is pushed to gamble.
Write it out (`rep: 1` / `rep: 0`) so the intent is readable. **Every city needs at least 2 early
table jobs plus a third** (3 errands that earn standing), so the high-roller room can open before
the boss; `check:story` fails a city with fewer than 3. Since standing starts at 0 in each town,
those jobs are the only way up, so make two of them easy to start (a talk scene, not a deep flag
chain).

**Hustles** (`lib/story/hustles.ts`): two a night, 4m each, paid at the end of a night you played.
Drawn from a shared `POOL` by `hustlesFor(city, night)` (seeded `hustles:<city>:<night>`, so a reload
shows the same board). Nothing to add per city unless you want city-specific hustles; if you do, keep
them pure (`met(rounds)`) and seeded.

## 5. Minigames

One per giver, once a night, pays `score x 3m` (`MINIGAME_MAX_M`) on the first play each night.
Parts: pure engine in `lib/story/minigames/<id>.ts` (seeded `rng.ts`; returns a score 0-1), board in
`components/story/minigames/<id>.tsx`, its `MinigameId` (already in the type union for all twelve),
and a registration in `app/story/minigame/[id]/page.tsx` (`INFO` entry with title, rule, intro, plus
the `Board` choice at the bottom). Hub buttons come from the giver's `minigame` field. Built:
`last-orders`, `shuffle-tracker`. Remaining ids are listed in `MinigameId`.

## 6. The boss

Profile and rules live in `lib/story/boss.ts` (Dustwater: `CUTTER_HALE` bot, `BOSS_SEATS`,
`bossOutcome(standings, over)`: you win when the rival's seat is out before yours). The page is
`app/story/boss/page.tsx`: it runs the city's Tables game (Liar's Dice) with a `TableHostContext`
host (`components/tables/table-shell.tsx` lets a non-Tables mode supply the buy-in, bots and result),
calls `enterBoss()` (buy-in `BOSS_BUYIN_M` 50m) and `bossResult(won)` (purse 150m, sets
`<city>-cleared`, no standing; a loss, or leaving, sets a return `BOSS_REMATCH_NIGHTS` (2) nights
later with the same terms). Cities whose `boss` is `challenge` need a seeded challenge page (not built). Per
city: a boss `Bot` (keep it out of the general bot pool), the boss game's table component, and the
`boss-intro/win/loss` scenes.

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
Poker before their city ships (Rattlesnake Junction needs Chicken Road and Mines; Port Lacey Slots;
Silver Mesa Poker). Tooltips and rules text must show the story numbers. Never change a game's base
numbers (owner has not decided the Freeplay outliers).

## 8. The drawn city scene

`lib/story/scene-theme.ts`: add a `ScenePalette` and a `CitySceneConfig` to `SCENES`: `palette`,
`view` (shared `VIEW`: `wide` 1600x790 and `tall` 600x1060 layouts), `sign` (`text`, `dead` letter
indexes, `flicker`), `motelName`, `barName`, `pieces` (`{ id, kind, wide: ..., tall: ... }` places),
and `spots`: hotspots by id (`dive`, `main`, `high`, `rest`, `car`, `road`, `notary`, `boss`,
character ids, `p0`-`p3` for people without a named spot), each either `{ piece }` or `{ at: { wide,
tall } }`. `components/story/scene-art.tsx` draws the pieces (`PieceKind`); add a new kind there only
for a new building. `sceneConfigFor(id, name)` falls back to a **generic night street** with the city
name on the casino sign, so a city is playable before it has art. Check hotspots do not overlap and
sit on the street at both layouts (screenshots below).

## 9. Checklist for a new city

1. Check `cities.ts` (games, tables, boss kind, `minigameGivers`) still suits the story you want.
2. Wire any story game settings the city's games need (section 7), with `pnpm sim:story`.
3. Characters (section 2), portrait looks, chip colours.
4. Minigames for its givers (section 5), then their `MinigameId` goals in errands.
5. `content/<city>.ts`: arrival, a `talk` scene per local, boss intro/win/loss, bust; 4 errands
   (3 of them table jobs worth standing, 2 of those easy to start; 1 minigame job that pays only).
   Register in `content/index.ts`. Quote numbers only as the checker allows.
6. Boss (section 6) and the boss page/table for the city.
7. Scene art (section 8) or accept the generic street.
8. Checks: `npx tsc --noEmit`, `pnpm lint` (3 known errors: `lib/game-registry.tsx` x2,
   `lib/survival/migrate.ts`), `pnpm check:story`, `pnpm sim:story` (add `500` for a quick run).
   Run the sim after any economy or game-list change; it models the room rotation, room comps and
   per-town standing. **Check the standing path in the sim**: is the city still clearable in about
   4-8 nights (median) per player type, with nobody stuck and no player type that can't reach the
   high-roller room before the boss?
9. Playwright at 390x844 and 1440x900 (`deviceScaleFactor` 1, `pnpm dev`): new story or set
   `floored-story` in localStorage, play arrival, talk to everyone, check the rooms lock and unlock
   as standing rises (0 / 1 / 2), play a night in each room (set `standing` for the town), end the
   night (receipt), the map, the boss. Look at the screenshots.
10. When the city ships to main, add its scene/errand/character ids to `SHIPPED` in
    `scripts/story/check-content.ts` (never remove ids). Update the handoff, plan section 11 and
    README.

Files you will touch: `lib/story/cities.ts` (rarely), `content/characters.ts`, `content/<city>.ts`,
`content/index.ts`, `lib/story/portraits.ts`, `lib/story/minigames/*`, `components/story/minigames/*`,
`app/story/minigame/[id]/page.tsx`, `lib/story/boss.ts`, `app/story/boss/page.tsx`,
`lib/story/odds.ts` + the game's engine/component, `lib/story/scene-theme.ts`,
`components/story/scene-art.tsx`, `scripts/story/check-content.ts`.
