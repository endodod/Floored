# Story mode — handoff

Branch: `claude/friendly-goodall-yvxakz`. Status as of 2026-11-02: **phases 1, 2, 3a, 3b and 3c are built and pushed; next is 3d (minigames)**.
2026-11-03: 3b (story game mode) and 3c (portraits, dialogue box, hub, navbar, home) built.
Hub placeholders to replace: minigame buttons and the boss "Sit down" button are disabled
"Soon" (`components/story/hub.tsx`) until 3d/3e. Hub finds the boss as the city's one
character without a minigame (no boss field on a city yet). The design is in [STORY_MODE_PLAN.md](STORY_MODE_PLAN.md) (read it first: rules,
cities, economy, owner decisions in section 12). This file says what exists, what is
next, and every decision made along the way that the plan doesn't spell out.

Checks for story work: `npx tsc --noEmit`, `pnpm lint` (3 known errors), `pnpm check:story`,
`pnpm sim:story` (slow: ~50 s for 3,000 circuits; `pnpm sim:story 500` for a quick run).

---

## 1. Owner decisions (all answered)

| Question | Answer |
|---|---|
| Minigame limit | once per character per **in-game night** (no real-clock limit) |
| Portraits | drawn in code; style **mix 1, "warm noir"**: D's round faces, big eyes and chip frame + C's single lamp, gold rim light, halftone shadow, full colour |
| Tone | warm noir: likeable characters, real stakes, dry humour |
| Story-only game settings | allowed ("story mode can configure games such as Slots") |
| Survival perks / items | left out of story for now |
| Saves | one story save, "New story" behind a confirmation |
| Harsher loss option | no |
| Boss rematches | don't get easier (same buy-in, same rival, after 2 nights) |
| The player | unnamed "you", no portrait |
| Placement | story first on the home page and first in the navbar |
| Names | draft names kept (Jo, Sloane, Vale, the Notary, twelve cities) |
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
| 2 Content model | `lib/story/types.ts`, `lib/story/dialogue.ts` (pure scene runner), `lib/story/content/` (`characters.ts`, `dustwater.ts`, `index.ts`) | Dustwater has 7 scenes (arrival, Marta, Pike, boss intro/win/loss, bust) and 4 errands. |
| 2 Save | `store/story-store.ts` (`floored-story`, version 1, synced as `story` via `lib/sync/keys.ts` + `components/account-sync.tsx`) | |
| 2 Checks | `scripts/story/check-content.ts` (`pnpm check:story`) | Content rules + the save's rules played through (scenes, minigame pay, a night with errands/hustles/comps, bust, marker, boss, travel). |
| 3a Night rules | `store/story-store.ts`, `lib/story/hustles.ts` | Venues, table limits, bets/payouts, hustles, comps, errand goals, bust → rep −1 + bust scene, marker effect, scene queue, news. |
| Engine export | `games/slots/engine.ts` exports `REEL` and `resolveReels` | no behaviour change |

### The save (`store/story-store.ts`) in short
- Money in **dollars**; rules in multiples of the city's min bet (`minBet()`).
- `tonight` = a night at a venue: `venue` 0 dive (max 20m) / 1 main floor (max 100m, rep ≥ 1)
  / 2 high-roller room (no max, rep ≥ 3); `bets` (max `NIGHT_BETS` 12), `openRound`
  (stake already taken), `rounds` (settled rounds, for hustles and errands), `startMoney`.
- Game hook contract to use: `placeBet(game, amount)` takes the stake (a second stake in
  the same open round, e.g. a double, adds to it without counting a new bet);
  `resolve(game, payout, settle)` credits payout (`settle: false` = partial, Plinko balls).
  Half of each win's **profit** repays a marker. `wagerCap()` = money capped by the venue
  (and 0 once 12 bets are used), `betsLeft()`.
- `endNight()` (after playing or resting): comps (4% of bets, cap 10m), hustles (2 a night,
  `hustlesFor(city, night)`, 4m each), night-up errands, lodging (3m) or the car (<10m),
  bust check (money < min bet → rep −1, `stats.busts`, queues the city's `bust` scene).
  Returns a `NightSummary`, also kept in `lastNight` for the hub.
- Errands: `openErrands()` (not done, and `opens` condition holds or started by a scene);
  goals `minigame` / `streak` / `night-up` / `big-win` are checked automatically and pay
  `ERRAND_PAY_M` (6m) with a `news` line.
- `playMinigame(giver, minigame, score 0–1)`: first play per giver per night pays
  `score × 3m`; minigame errands check every play (practice included).
- Scenes: `queue` (arrival on new story/travel, boss-win/loss, bust), `playQueued()`,
  `startScene(id)`, `currentStep()`, `advance()`, `pick(index)`; `sceneFor(trigger)` finds
  the first matching scene in the city (talk scenes by character).
- Boss: `enterBoss()` pays 50m and sets `bossTable { seed }`; `bossResult(won)` pays 150m +
  rep +1 + `<city>-cleared` flag, or sets `bossBackOn = night + 2`. Leaving the boss table
  must count as a loss (see 3e).
- `travelNext()` needs the city cleared and the fare (20 × next city's min bet).
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
   Rattlesnake Junction on; wire them the same way when those cities are built, with the
   numbers in `lib/story/odds.ts` (the simulator already uses them).
7. `app/story/[game]/page.tsx`: like `app/daily/[game]/page.tsx`; only the current city's
   games and only during a night (`tonight`), else redirect to `/story`. Header pills: min
   bet, table max, bets left, money.

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
  (city, night, money, owed, rep), circuit map strip (12 cities, act groups, current and
  cleared), Play a night (venue picker by rep), People (talk → `sceneFor({on:'talk'})`;
  minigame button, "paid tonight" state), Jobs (tonight's hustles + open errands), Boss
  (intro scene → `enterBoss`), Rest / End the night (night summary panel), Travel when
  cleared, the Notary when broke, `news`. Plays queued scenes on mount
  (`playQueued()`). New story behind a confirm dialog.
- Navbar (`components/navbar.tsx` `MODES`): Story first; figure "Money". Home
  (`app/page.tsx` GUIDE + `components/mode-select.tsx`): a Story section first.
- Build from the shared pieces (`components/ui/*`, `GAME_DOCK_*` buttons, tokens); phone
  first (`max-*` variants don't exist; see `.md/MOBILE_UI_HANDOFF.md`).

### 3d. Minigames (`lib/story/minigames/*.ts` pure engines + `components/story/minigames/*`, route `app/story/minigame/[id]`)
- **Last Orders** (Marta): Simon-style memory; 6 drink icons; orders grow 3→8 items over
  rounds; score = rounds cleared ÷ max (errand needs ≥ 0.8).
- **Shuffle Tracker** (Pike): 3 cups, follow the queen through N swaps, 5 rounds getting
  faster; score = right ÷ 5; with reduced motion, show swaps as slow discrete steps.
- First play each night pays (`playMinigame`); after that it's practice (no pay, but
  errands still count). Boards fit without scrolling; respect reduced motion.

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
