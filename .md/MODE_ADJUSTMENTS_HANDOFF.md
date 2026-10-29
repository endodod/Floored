# Survival & Ladder adjustments — handoff

Branch: `claude/survival-ladder-adjustments` (from `main` at `fd5f83b`).
TODO items: "Survival: adjust upgrades / items to the new game designs" and
"Ladder: adjust to the new game designs".

## Why this work exists

All 18 game boards were redesigned (`.md/GAME_REDESIGN_HANDOFF.md`). That pass
was visuals-only and checked each board mostly in **Freeplay**. Survival and
Ladder reach into the games in ways Freeplay never exercises — perks, curse /
bless, opening tickets, the all-in pot, multi-bet Roulette — so each game has
to be re-checked, and fixed where needed, in those two modes. Two of them are
explicitly marked untested in the redesign handoff:

- **Roulette** now uses real table betting (chips on several spots, Undo /
  Clear). Not checked in a browser: the **Ball Tracker** perk, the
  **opening-ticket chip**, and **Ladder** (a tap puts the whole pot on one spot).
- **Case Battles**: not checked: the **reroll perk** and **Ladder**.

## Ground rules

- Read `CLAUDE.md`, `.md/ARCHITECTURE.md` and `.md/GAME_REDESIGN_HANDOFF.md`
  first.
- Fix what's broken or misleading. Don't rebalance numbers on this branch
  unless a perk has stopped making sense on the new board; if you change a
  number, update `.md/BALANCE_AUDIT.md` and say why in the commit.
- No gameplay changes in Freeplay / Daily: whatever you change must keep those
  modes behaving exactly as now.
- Every fix must keep the redesign's rules: boards fit without scrolling, all
  motion respects reduced motion.

## How to test

- Survival: Account → Dev mode (password in `app/account/page.tsx`) → turn on
  **Show all games** (every game in the lobby) and **Infinite bets**, use
  **Grant all upgrades** to own every perk, and the bankroll / sparks setters.
  Cursed / Blessed toggles check the forced-outcome paths.
- Perk levels: the perk effect often depends on level (`lib/survival/upgrade-levels.ts`);
  check L1 and L5 where the level changes what is shown.
- Ladder: start a climb and pick the game; the stake is the whole pot
  (`hooks/use-ladder-all-in.ts`, `GameDockChipRow` shows "The whole pot rides").
  A push must replay the rung; a profit must clear it.
- `scripts/design-check/play-game.cjs` and `motion-check.cjs` drive a game and
  print animations; `responsive-check.cjs` checks fit (see the redesign handoff).

## Part 1 — Survival: each game's perk on its new board

For each game: does the perk still show (`PerkHint`, or the board's own mark),
in the right place, readable, inside the board without covering the badge band
(top ~4rem), and does its effect still happen? Does the shop text still
describe what the player now sees?

| Game | Perk (`effectKey`) | What to check on the new board |
|---|---|---|
| Blackjack | Hole Card Reader (`perk_peek_dealer`) | L1 hole card visible while playing; L2 during betting (board card component `playing-card.tsx`); L3 dealer-BJ push; L4 double on any hand; L5 BJ pays 3×. Blackjack has no `useSurvivalPerks` in the component — the logic is in `hooks/use-blackjack-game.ts`. |
| HiLo | Hot Streak (`perk_hilo_range`) | Proc message and the streak pips/figure advance by 2 |
| Chicken Race | Slow Scout (`perk_chicken_scout`) | Crossed-out lane ("Out", dashed) on the new lane layout |
| Crash | Crash Cushion (`perk_crash_zone`) | Sub-3× crash settles as a partial push; result strip and chart show it as a push, not a bust |
| Mines | Mine Sweeper (`perk_mines_safe`) | Pre-revealed safe tile uses `BoardTile` (`btile-hint`) |
| Plinko | Golden Ball (`perk_plinko_golden_ball`) | Gold ball on the new pegboard, 2× payout shown |
| Over-Under | Safe Opening Roll (`perk_over_under_shield`) | First roll refunded as push |
| Fortune Wheel | Color Scout (`perk_wheel_scout`) | Crossed-out colour among the on-board picks (moved off the dock in the redesign) |
| Run Dice | Loss Shield (`perk_run_dice_insight`) | Loss roll → push, shown on the new dice / total tile |
| Chicken Road | Safe Lane (`perk_chicken_road_lane`) | Shop text says "each crossing row" — the redesign is a road of lane tiles; check the mark and reword if needed |
| Slots | First Spin Shield (`perk_slots_shield`) | First spin refund on the new cabinet |
| Roulette | Ball Tracker (`perk_roulette_tracker`) | **Untested.** Three numbers that won't hit, marked on the new mat, with chips spread across several spots; survives Undo / Clear |
| Dragon Tower | Dragon's Blind Spot (`perk_dragon_blindspot`) | Felt ring + dot on the first two floors |
| Street Cups | Cup Truth (`perk_street_cups_truth`) | Crossed-off cup on the drawn cups |
| Case Battles | Case X-Ray (`perk_case_xray`) + reroll | **Reroll untested.** Tier hint on the drawn case art; reroll lands its new reel |
| 1P Poker | Hold Harmony (`perk_poker_hold_bias`) | Proc hint on the new card row |
| Keno | Number Heat (`perk_keno_heat`) | Two hot numbers on `BoardTile` alongside pick / hit / drawn states |
| Coin Flip | Weighted Edge (`perk_coin_bias`) | Passive; nothing shown — confirm nothing stale is drawn |

Also across all games:

- **Opening ticket** (`first_bet_free`): the chip row's "Opening ticket" pill;
  Roulette uses a single Ticket chip instead — check both.
- **Game Boost / run payout boost**: the boosted payout appears in the result
  strip and history (`resolveGame`, `RAW_PAYOUT_MULT_CAP`).
- **Curse / bless**: forced outcomes still animate correctly on each new board
  (especially Roulette's multi-bet `winGame` / `loseGame`, which now choose a
  pocket by payout).
- **Survival lobby / shop**: game tiles and shop cards use the current
  `GameTile` and palette; perk descriptions in `upgrades-catalog.ts` match the
  new visuals (the "Shop text" column above).
- **Survival sidebar**: `components/survival/*` panels next to the new boards
  at the sizes in the responsive check (the sidebar shows from `lg`).

## Part 2 — Ladder on each new board

For each game in a Ladder climb:

- The bet is the whole pot and can't be changed (chip row shows the all-in
  line; no Clear).
- Profit clears the rung, a loss falls, a push replays — and the board's own
  result animation matches what the Ladder records.
- The game's maximum in `GAME_MAX_MULT` (`lib/ladder/rules.ts`, shown in the
  picker) still matches the engine.
- Known risks:
  - **Roulette** (`mode === 'ladder'` branches in `components/games/roulette/game.tsx`):
    one tap stakes the whole pot on one spot; tapping another spot should move
    it, not add a second stake; Undo / Clear hidden.
  - **Case Battles** (`ladder` = one of each case, all five open): the stake is
    the pot, not the case prices — check the cost row and the result.
  - **Plinko**: Ladder splits the whole pot across the selected balls, keeps
    each ball at or above the game's minimum bet, and distributes any remainder
    into the final ball. Verify the stepper cap, stake display, and settlement.
  - Streak games (Coin Flip, HiLo, Mines, Chicken Road, Dragon Tower, Crash):
    the cash-out multiplier is what the rung records.
- The Ladder hub (`app/ladder/page.tsx`): game tiles and payout captions after
  the redesign; nothing else is expected to change.

## Deliverables

1. A per-game checklist in this file (add a ✅ / fix note per row) as you go.
2. Fixes, one commit per game or per problem.
3. Docs kept current: `BALANCE_AUDIT.md` for any number, `ARCHITECTURE.md` for
   any convention, `TODO.md` when an item is done.
4. Open questions for the owner listed at the bottom of this file rather than
   guessed.

## Status (2026-10-29)

Checked in a browser at 1440×900 (Survival with every perk at L5, Ladder fresh climb):

- ✅ Roulette: Ball Tracker marks survive Undo; ticket chip (label now fits); Ladder tap moves the pot.
- ✅ Case Battles: reroll lands its reel (prompt fixed); Ladder prices the five cases off the pot.
- ✅ Perk pill moved to the status bar for all games (it covered the badges at lg widths).
- ✅ Fixed: Chicken Road safe lane marked; Street Cups cross on the empty cup; Run Dice / Over-Under /
  Slots shielded losses read as refunds; Crash cushion shows its real loss; Blackjack felt follows
  L4/L5; HiLo Hot Streak no longer leaks out of Survival; free bet can't profit on a loss.
- ✅ Ladder: strip restyled, hints say "whole pot", coin-flip clear/fall checked.
- Plinko Ladder now splits the whole pot across the selected balls; multi-ball settlement still needs browser verification.
- ✅ Seen working: Mines, Dragon Tower, Keno, Poker, Wheel, Chicken Race, Coin Flip, Plinko golden ball.

Still to check:

- Perk levels L1–L4 (only L5 was played), e.g. Blackjack L1 vs L2 preview.
- Curse / bless on each board (only Crash, Over-Under and Slots were run cursed).
- Survival shop cards and floor-complete panel; sidebar at 1024 / 720p / zoomed views
  (`responsive-check.cjs` was not run on this branch).
- Motion = reduced for the new Street Cups cross and the Over-Under push marker.
- Ladder push/profit on the other streak games (HiLo, Mines, Chicken Road, Dragon Tower, Crash).

## Open questions

- Case X-Ray is now a reroll (owner rework 71d3331); keep the name or rename it?
- Free-bet fix: a partial return on a free bet now nets 0 (was a profit). Confirm that's intended.
