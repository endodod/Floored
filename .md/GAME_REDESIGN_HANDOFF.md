# Game redesign — handoff

Status as of 2026-10-28. The site-wide redesign is merged into `main`. This
branch (`claude/game-redesign-wip`) carries the **per-game** redesign, which is
**work in progress and not merged**. Three games are done, Roulette is written
but unverified, and fourteen games are untouched.

## The ground rule

**Visuals only.** No gameplay, outcome, payout, rule or timing changes. Every
game keeps its engine (`games/<name>/engine.ts`), its hooks and its result
flow; only what is drawn changes. If a redesign needs a logic change to work,
stop and ask.

## What is already on `main`

| Commit | What |
|---|---|
| `cbf4af2` | App shell and mode screens in the "data terminal" style (dark ground, felt-green accent, Public Sans + IBM Plex Mono for figures) |
| `49cb3fa` | Atmosphere: mode-tinted lamp background, grain, glows, entrance motion |
| `577417f` | Motion setting (Account → Settings → Motion: match system / reduced / full) |
| `6565fb9` | Merge of `main`'s tutorials, Ladder abandon, Plinko fix |
| `86aca81` | Intro screens for every mode (Ladder, Survival, Daily, Freeplay) |
| `e9945b4` | Shared game chrome: felt table, casino chips, pill buttons, outcome strip, history drawer, toast |
| `2a5b198` | Game frame fits every screen (tall monitors, phones, short viewports) |

Because of `e9945b4`, **all 18 games already** sit on the felt table with the
new chips, buttons and dock. What remains is each game's own board.

## What is on this branch

| Game | State | Notes |
|---|---|---|
| Blackjack | Done, checked at all sizes | Shared playing card, rules printed on an arc on the felt, dashed card spots, hand-total pills |
| HiLo | Done, checked | Shared cards, gold streak pips (no 🔥), lit guess arrow, Higher/Lower and Cash out/Go again pills |
| 1-Player Poker | Done, checked (phones included) | Gold printed pay table, held cards lift with a gold edge, winners glow; card size capped by screen width so five fit on a 360px phone |
| Roulette | **Written, never seen in a browser** | Real SVG European wheel (37 pockets in true order) that spins to the pre-decided result while the ball orbits and drops; printed betting table with a chip on the bet; tracker-eliminated numbers dimmed |
| 14 others | Not started | Only the shared chrome from `main` |

New shared pieces on this branch:

- `components/games/playing-card.tsx` — one card for all card games (face, back, slot). Sized by the `--card-h` CSS variable.
- `app/globals.css` — `.pcard*` classes (cards), `.felt-print` (gold text printed on the felt), roulette ball keyframes and wheel transform origin, reduced-motion rules for the wheel.

### Roulette: before you commit it

1. Play several rounds in a browser. Check that the wheel stops with the
   winning number under the gold marker, that the settled result, payout and
   history match the old version, and that the tracker perk still works in Survival.
2. Pending fix that was not applied: the ball's resting position. In
   `RouletteWheel` set the inner ball group's static `translateY(-60px)` to
   `-61px`, and in `globals.css` change the `roulette-ball-drop` keyframes'
   80% / 88% / 100% stops to `-58px` / `-64px` / `-61px`, so the ball rests in
   the pocket ring instead of on the numbers.
3. The spin logic was restructured: the old tick-based `spinningPosition`
   animation was removed and replaced by CSS rotation (`wheelRotation`,
   `ballRotation`). Result calculation, the 4600 ms settle, `resolveGame` and
   `buildPendingResult` are unchanged, but diff it against `main` carefully.

## Known open issue: boards clip on short screens

On a 1280×720 screen and at 150–200% browser zoom on a 1440×900 laptop, some
boards clip their content vertically (up to ~78px) inside the arena's
`overflow-hidden`, with no scroll. Seen on Blackjack, HiLo and Poker; probably
others. Phones, tablets, 1080p and 1440p are clean. Likely fix: let the board
scale with height (e.g. card and wheel sizes in `min(vh, vw)` terms, tighter
gaps under `@media (max-height: 720px)`), or allow the arena to scroll
vertically when its content is taller than it.

## How each game was approached

1. Read `components/games/<name>/game.tsx` and decide: is the board's design
   fine (then only apply the tokens, type and buttons) or does it need a new
   design (Roulette did)?
2. Replace stray `zinc-*`, `emerald-*`, `purple-*` etc. with the tokens:
   `ground` `surface` `raised` `line` `rule` `control` `ink` `soft` `dim`
   `felt` `loss` `gold` (and `*-tint`). Colour means something: felt = win or
   selection, loss = loss, gold = money/sparks/premium, everything else neutral.
3. Figures (money, multipliers, counts) get the `num` class (mono, tabular).
4. Buttons: `GAME_DOCK_PRIMARY_BTN` (white pill), `GAME_DOCK_SECONDARY_BTN`,
   `GAME_DOCK_LEAVE_BTN`, from `components/game-dock-parts.tsx`.
5. No emoji in the UI; use suits (`Suit` in `components/ui/terminal.tsx`) or drawn shapes.
6. Respect reduced motion: new animations need a
   `:root[data-motion='reduced']` rule in `globals.css`; elements that move on
   hover/press get the `m-still` class.
7. Check every size (below), then commit one game at a time.

Suggested order for the rest, by how much each board needs:

- Probably a new design: Fortune Wheel (pair it with the roulette wheel's SVG approach), Plinko, Slots, Crash, Case Battles, Chicken Race.
- Probably a restyle: Mines, Dragon Tower, Chicken Road, Keno, Coin Flip, Over-Under, Run Dice, Street Cups.

## Checking a game

Playwright is not a project dependency. Install it globally once
(`npm install -g playwright && npx playwright install chromium`) and run the
scripts with `NODE_PATH=$(npm root -g)` set. Start the dev server
(`pnpm dev`), then:

```bash
# static screens across phone / tablet / 720p / 1080p / 1440p / 150% / 200% zoom
node scripts/design-check/responsive-check.cjs ./out /freeplay/blackjack /freeplay/roulette

# the same, after playing into a round (steps: click:<button name>, click:css=<selector>, wait:<ms>)
node scripts/design-check/play-responsive-check.cjs ./out /freeplay/poker-1p "click:Add 100" "click:Deal" wait:900

# one size, screenshots along the way (W / H / DSF env vars set the viewport)
node scripts/design-check/play-game.cjs ./out/end.png /freeplay/roulette "click:17 red" "click:Add 100" "click:Spin" wait:1500 "shot:./out/spin.png" wait:3800
```

`BASE_URL` overrides the default `http://localhost:3000`. A line starting
`FAIL` names the view and what overflowed or was clipped; look at the
screenshot in `./out` for that view. The checks catch overflow and clipping,
not taste — always look at the screenshots too.
