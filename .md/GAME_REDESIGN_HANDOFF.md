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
others. Phones, tablets, 1080p and 1440p are clean.

**Never fix this with scrolling.** No game page, arena or board may scroll
(no `overflow-auto`/`overflow-y-scroll`, no scrollable wrappers, no
"scroll to see more"). The whole board must always fit the space it is given.
Fix clipping by making the board scale instead:

- Make the board wrapper in `components/game-match-history.tsx` (the
  `overflow-hidden` div at the board) a size container
  (`container-type: size`), and size cards, wheels, grids and gaps in `cqh` /
  `cqw` / `cqmin` units with `clamp()` floors (e.g.
  `--card-h: clamp(4.5rem, 22cqh, 9rem)`), so every board shrinks with the
  space it actually has rather than with the window.
- Tighten gaps, padding and secondary labels under short heights
  (`@container (max-height: …)` or `@media (max-height: 720px)`).
- Move secondary info (pay tables, rules on the felt, history) into the
  existing history drawer or a toggle only when it truly cannot fit.

If the only fix that works would noticeably hurt the experience (cards too
small to read, a pay table or rule hidden that players need, controls moved
off the board, taps getting cramped on phones), **stop and ask the user before
implementing it**, with a screenshot of the problem and the options.

## Motion: every game gets fluent animations

Each game should feel alive and smooth to play, not just look right when
still. Every redesigned game (including the three done ones and Roulette) gets
a pass of fluent animations, and **every one of them sits under the motion
rule so it can be turned off** (Account → Settings → Motion; `<html
data-motion="reduced">`, see `components/motion-preference.tsx`).

What to animate (pick what fits the board; do not overdo it):

- **Arrival:** cards dealt in from the shoe with a slight arc and stagger,
  tiles/grids cascading in, wheel or reels settling into place.
- **Feedback on input:** chips sliding onto a bet spot, selected tiles
  pressing in, held cards lifting, the bet amount ticking.
- **The reveal:** card flips (3D `rotateY`), tile flips, dice tumble and
  land, coin flip, multiplier counting up, a short build of suspense before a
  result where the game already waits for one.
- **The outcome:** win glow/pulse on the winning cards, cells or pocket, a
  payout count-up in the outcome strip, losing items dimming instead of
  vanishing, a short shake or dull flash for a bust/mine.
- **Leaving:** cards and chips clearing off the table before the next round
  instead of disappearing.

Rules:

- Feel only. Animations must never change timing that the game logic relies
  on (settle times, `resolveGame`, payout moments) and never delay input
  longer than the current flow already does. If a nice animation would need a
  longer wait or a logic change, ask first.
- Use `transform` and `opacity` only (no layout-shifting properties), run at
  60 fps on a phone, 150–450 ms for UI feedback, longer only for reveals.
- One shared vocabulary in `app/globals.css` instead of per-game keyframes:
  shared easing/duration variables (`--ease-out`, `--ease-spring`,
  `--dur-fast`/`--dur-med`/`--dur-slow`) and reusable classes (`g-deal`,
  `g-flip`, `g-pop`, `g-win`, `g-dim`, `g-shake`, `g-count`, stagger via
  `--i`). Reuse the existing keyframes (`card-deal-in`, `card-reveal`,
  `coin-*`, `dice-*`, `slot-*`, `case-item-*`) where they already fit.
- **Every new animation class is added to the `:root[data-motion='reduced']`
  block** in `globals.css`. Decorative motion (deal arcs, cascades, pulses,
  shakes, hover lifts) is turned off; motion that *carries the result* (a
  wheel landing, a reel stopping, a card turning face up) is shortened to a
  quick fade or ≤ 400 ms move so the result still reads, as Roulette does.
  Moving-on-hover elements get `m-still`.
- Check each game twice: once with Motion = full and once with Motion =
  reduced.

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
7. Add the fluent animations (see **Motion** above) with their reduced-motion rules.
8. Check every size and both motion settings (below), then commit one game at a time.

The order for the rest is in **The plan** at the end of this file.

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

## The plan: rework all games efficiently

The aim is to spend tokens on design decisions and checking, not on re-reading
code or redoing the same work in every game. Shared work comes first, then the
games go in batches that share a board type, so each batch reuses the pieces
the one before it built.

### Phase 0: shared foundations (one session, before any more games)

1. **Fit-to-space board.** Make the board wrapper in
   `components/game-match-history.tsx` a size container and add the
   `cq*`-based sizing variables (`--card-h`, `--tile`, `--wheel`,
   `--board-gap`) to `globals.css`. Move Blackjack, HiLo and Poker onto them.
   This fixes the clipping on short screens for every game at once, without scrolling.
2. **Motion kit.** Add the shared easing/duration variables, the `g-*`
   animation classes and their reduced-motion rules to `globals.css` (see
   **Motion**). Write it once and give it a short comment block listing each
   class, so later sessions read that block instead of the whole stylesheet.
3. **Shared board pieces**, extracted only where two or more games need them:
   - `components/games/playing-card.tsx` (exists): add deal and flip animation props.
   - A board tile for grid games (Mines, Dragon Tower, Keno, Chicken Road):
     hidden / revealed-safe / revealed-bad / selected states, flip animation, sized by `--tile`.
   - A die and a coin for Run Dice, Over-Under, Coin Flip and Street Cups, if their faces overlap.
   - An SVG wheel taken out of the Roulette wheel, so Fortune Wheel can reuse it.
   - A `CountUp` figure for multipliers and payouts.
4. **Finish Roulette** (play it, apply the ball fix, diff the spin logic) and
   give Blackjack, HiLo, Poker and Roulette their animation pass with the kit.
   They become the reference examples for the batches.

### Phase 1–5: batches (one session per batch, one commit per game)

| Batch | Games | Shared piece | Kind of work |
|---|---|---|---|
| 1. Grids | Mines, Dragon Tower, Keno, Chicken Road | board tile | Restyle + tile flips, cascade in, mine shake |
| 2. Dice & coins | Coin Flip, Over-Under, Run Dice, Street Cups | die / coin | Restyle + tumble, flip, cup shuffle |
| 3. Wheels & reels | Fortune Wheel, Slots | SVG wheel, reel strip | New design (wheel uses the Roulette approach) |
| 4. Live curves | Crash, Chicken Race, Plinko | `CountUp`, felt-print grid | New design: drawn curve/track/pegboard on the felt |
| 5. Case Battles | Case Battles | reel strip from batch 3 | New design; largest file, so it gets its own session |

Batch order goes from cheapest to most expensive. The first two batches are
restyles on top of the Phase 0 pieces, and by batch 3 the kit is proven.

### Keeping token use low without cutting quality

- **Start every session by reading only this file** and the `globals.css`
  motion-kit comment, never the whole repo. Do not re-read games already done,
  except the one reference example for the current batch.
- **Read only the render part of a game.** Find the JSX return and the
  class names with `grep` (`grep -n "className\|zinc-\|emerald-\|purple-"`),
  and leave `engine.ts` and the hooks unread. The ground rule says they don't change.
- **Make edits by hand, not by rewriting files.** Use small targeted edits
  instead of rewriting a whole `game.tsx`, so the logic stays
  untouched and the diff stays reviewable.
- **Check in a fixed, minimal way.** Run `responsive-check` and
  `play-responsive-check` once per game, read only the `FAIL` lines, and look
  at three screenshots: phone, 720p and 1440p (plus one with
  Motion = reduced). Open more only for a view that failed.
- **Stop after each batch with a commit and a handoff update.** Tick the
  game in the status table above and note any new shared piece. Then the next
  session starts from this file, not from the conversation.
- **Ask early, once per batch,** about anything that would hurt the
  experience (see the no-scroll rule) or touch logic, rather than finding out after building it.

Quality bar per game, unchanged by any of the above: tokens only (no stray
palette colours), `num` on figures, dock buttons, no emoji, fits every size
with no scroll and no clipping, fluent animations with full and reduced motion
both checked, and gameplay identical to `main`.
