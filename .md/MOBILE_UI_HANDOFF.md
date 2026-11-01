# Mobile UI audit — handoff

Status as of 2026-11-01, branch `fix/mobile-layout-audit`. Started from a Pixel 9
Firefox screenshot of Freeplay Blackjack where the **Deal** button sat below the
fold. The pass covered every mode that is live in the app (Daily, Ladder, Tables,
Freeplay) and all 24 games, at phone sizes, in the betting state and after
playing into a round. No engine, payout, rule or timing change: layout only.

## What was checked

**Sizes** (all with `isMobile: true`, touch on):

| View | Why |
|---|---|
| 412×737 | Pixel 9 with Firefox/Chrome toolbars showing — the closest match to the screenshot |
| 412×915 | Pixel 9 full viewport |
| 390×700 | common Android phone with toolbars |
| 360×640 | smallest phone still in use |

**Routes and states**

- Hubs: `/`, `/freeplay`, `/daily`, `/ladder`, `/tables`, `/tables/lobby`.
- All 24 Freeplay games, betting state and in-round (`auto`: place a chip, press
  the dock's primary button), plus settled state for the fast games (Baccarat,
  Sic Bo, Dragon Tiger, Andar Bahar, Run Dice, Coin Flip, Over-Under, Wheel,
  Slots, Chicken Race, Deck Countdown, Tower of Cards).
- Daily: `/daily` → **Play daily** → today's game page.
- Ladder: `/ladder` → **Start climbing** → the rung's game page (with the
  Rung / All-in / To win / Lives strip above the card).
- Tables: `/tables/lobby` → each of Texas Hold'em, Liar's Dice and Blackjack
  Showdown, at the table once the bots have started.

**Per page** the audit flags, and every finding below came from it:

- document / `main` horizontal overflow, and elements poking past either edge;
- content cut off by a board or card (`overflow: hidden` ancestor);
- game pages that scroll, and controls below the fold (game pages must fit);
- pairs of clickable elements whose boxes overlap (absolutely positioned
  elements, e.g. Roulette chips, are excluded).

Screenshots were reviewed for every failing route, and the fixed routes were
re-read afterwards to confirm the layout still looks right rather than merely
measuring clean.

## What was edited

| File | Change | Why |
|---|---|---|
| `scripts/design-check/mobile-check.cjs` | **New.** Runs the checks above for a list of `route` or `route\|steps` specs; steps are `click:`, `click:css=`, `wait:`, `shot:` and `auto`. `W` / `H` / `DSF` set the viewport; output goes to the given folder. | There was no phone-sized audit; `responsive-check.cjs` skips the states that break (in-round, Ladder/Daily strips, Tables boards). |
| `app/globals.css` `@container board` — `.grid5-board` | Portrait padding rule was `(max-aspect-ratio: 4/5)`; now `(max-width: 640px) and (max-aspect-ratio: 1/1)`, padding `3.25rem`, tile budget `11.5rem` | Mines' difficulty pills and Keno's Quick Pick / Clear picks sat **behind** “← All games”, “How to play” and “History” on a 412×737 phone: the board is 380×417 (aspect 0.91), so the 4/5 rule never matched. |
| `app/globals.css` — `.dt-board` | Same breakpoint change, padding `3.25rem`, tile budget `8.5rem` | Dragon Tower's top floor was behind the same corner buttons. |
| `app/globals.css` — `.bac-board` | New `@container board (max-width: 560px)`: `--card-h` sized from board **width**, hands gap `0.5rem` | The Banker hand (three slots, the third turned on its side) ran past the right edge and was cut ~140px. |
| `app/globals.css` — `.rl-layout` | New `@container board (max-height: 440px)`: `margin-top: 2rem` and the payout line under the table hidden | Roulette's board ran 9px past its space at 360×640. The line repeats the payout printed on every cell (`rl-bet-payout`). |
| `app/globals.css` — `.hd-table.bj-table` (narrow) | Four-across seat row → **2 × 2** grid (`c c` / `s1 s2` / `s3 y`), smaller avatar, table print hidden | Blackjack Showdown's four seat plates overlapped each other and “You” ran off the right edge; its card row spilled out of the board. |
| `app/globals.css` — tables | New `@container board (max-width: 34rem) and (max-height: 440px)`: `padding-top: 3rem`, row gap `0.1rem` | Hold'em clipped its seats and dock by ~6px on a 640-tall screen. |
| `components/game-layout.ts` — `GAME_BOARD_ARENA` | Floor `min(360px, 52vh)` → `min(360px, 44vh)` | Plinko (a four-row dock) and the Ladder game page were pushing the primary button out of the card. The board now yields before the controls do. Above ~820px tall nothing changes (the floor is not reached). |
| `app/ladder/[game]/page.tsx` — `Figure` | Phone paddings `px-2 py-1`, label `text-[11px]`, value `text-[13px]`; label “Win more than” → **“To win”** | The four figures wrapped onto a second row on a 390px phone, which pushed the game's dock (and the `Race →` button) 40px out of the card. |
| `components/games/crash/game.tsx` | The top gridline's label sits **below** its line when it is within 8% of the top | The `3×` label was clipped by the chart's top edge. |
| `components/tables/holdem-table.tsx` | Action row: `max-sm:[&>button]:min-w-0` | Fold / Check / Raise-to wrapped to a second row under the fold on a 360px phone because of their desktop minimum widths. |
| `.md/GAME_REDESIGN_HANDOFF.md` | Added the mobile check to **Checking a game**, with the sizes and states a game must pass | Keeps the checking convention in the doc the next session reads. |

## Checks run and results

All clean at **360×640, 390×700 and 412×737** for:

- the six hubs;
- all 24 Freeplay games in the betting state;
- in-round for Mines, Keno, Dragon Tower, Baccarat, Blackjack and Crash, plus
  settled for the twelve fast games listed above;
- the Daily flow, the Ladder flow, and all three Tables (Hold'em, Liar's Dice,
  Blackjack Showdown) at 390×700 and 412×737.

`npx tsc --noEmit` reports one error, `store/settings-store.ts(48,16)` (a
`persist`/`SettingsStore` cast). It is not touched by this branch and predates
it; everything else typechecks.

## Known issues and things not done

1. **Hold'em at 360×640 still clips ~6px** at the bottom of the dock. The button
   row now fits one line; the card itself is 6px short because the seat plates
   and their status lines cannot shrink further. Options for the next session,
   cheapest first: cap `--seat-card-h` on `@container board (max-height: 400px)`,
   drop the bot status line there (`Small blind`, `Bet 20`), or take the last
   4px from `.hd-table`'s bottom padding. Verify at 360×640 and 360×700.
2. **Slots** is reported by the audit as “clipped” for the reel strips. That is a
   false positive: the strip is deliberately longer than its window. If the
   script is kept, consider skipping descendants of `.sl-strip`.
3. **Survival** is disabled (`SURVIVAL_ENABLED = false`) and was not exercised;
   its game routes share the same shell, so the fixed boards should carry over,
   but the survival-only dock pieces (opening ticket, perk hints, run-end
   actions) were not checked at phone sizes.
4. **Firefox** was not run: the audit used Chromium. The changes are layout
   primitives (container queries, flex/grid, padding), so a real Pixel 9 check
   on `floored.paulkuehn.ch` is still worth doing — that is the device the
   screenshot came from.
5. **Not covered:** dialogs and sheets (history drawer, Cash out / Give up /
   Abandon confirmations, mode tutorials, the cash-table chip input), the
   Account and how-to-play pages, signed-in state, landscape phones, and Cash
   tables (`.md/TABLES_CASH_HANDOFF.md`).
6. The overlap detector ignores `position: absolute` controls, so intentional
   overlap (Roulette's chip layer, table chip stacks) is not flagged — but
   neither would a real overlap of two absolutely positioned buttons be.

## Running the check

Playwright is not a project dependency. Install it once, start the dev server,
then:

```bash
# phones: the whole app's game pages and hubs
node scripts/design-check/mobile-check.cjs ./out /freeplay /daily /ladder /tables/lobby \
  /freeplay/blackjack /freeplay/roulette

# a game played into a round, then the settled state
node scripts/design-check/mobile-check.cjs ./out "/freeplay/baccarat|auto|wait:4000"

# Ladder / Tables need the flow that opens them
node scripts/design-check/mobile-check.cjs ./out \
  "/ladder|click:Start climbing|wait:800|click:css=[aria-labelledby=\"ladder-games\"] li button" \
  "/tables/lobby|click:css=[aria-labelledby=\"tables-games\"] li:nth-child(1) button|wait:2500"
```

`W=390 H=700` (and `DSF`) change the viewport; `BASE_URL` changes the server.
A `FAIL` line names what overflowed, was cut, sat below the fold, or overlapped.
Look at the screenshots in `./out` as well — the checks catch geometry, not
taste.

Heads-up for a bare Linux container: Chromium needs fontconfig plus the usual
`libnss3` / `libatk` / `libcairo` set, and **fonts**. If no fonts are installed
every label renders as blank space and the screenshots lie. Installing
Liberation Sans (metric-compatible with the app's Arial) plus a minimal
`FONTCONFIG_FILE` was enough here; the font files and libraries are not part of
the repo.
