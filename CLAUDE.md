# Floored

Browser casino simulation with play money only. 24 games across four modes: Daily, Ladder,
Survival and Freeplay. Built with Next.js 15 (App Router), TypeScript, Tailwind and Zustand.

## Docs

**Next up:** Story mode, `.md/STORY_MODE_PLAN.md`: phases 1–2 are built (economy, odds, save,
dialogue engine, checks); next is Phase 3, the playable Dustwater slice (build order in its section 11). Cash tables (`.md/TABLES_CASH_HANDOFF.md`) and the four new
house games (`.md/NEW_GAMES_HANDOFF.md`) are built.

Read the one that matches the task before changing code:

- [.md/MODE_ADJUSTMENTS_HANDOFF.md](.md/MODE_ADJUSTMENTS_HANDOFF.md): Survival perks and Ladder
  on the redesigned boards: what was checked and fixed, what is left, open questions.
- [.md/BOT_TABLES_HANDOFF.md](.md/BOT_TABLES_HANDOFF.md): the new Tables mode:
  game designs (Hold'em, Liar's Dice, Blackjack Showdown), the bot system and the phases.

- [.md/NEW_GAMES_HANDOFF.md](.md/NEW_GAMES_HANDOFF.md): four new house games to build (Sic Bo,
  Tower of Cards, Deck Countdown, Baccarat): rules, exact pay tables, boards, wiring, perks, and the new Survival floor
  selection that favours games not offered yet.
- [.md/TABLES_CASH_HANDOFF.md](.md/TABLES_CASH_HANDOFF.md): Cash tables, a second Tables category
  (sit down with any amount of your wallet, play until you leave or run out): rules, stakes,
  how it was built, simulation results, and where the build differs from the plan.

- [.md/STORY_MODE_PLAN.md](.md/STORY_MODE_PLAN.md): Story mode ("The Circuit"): the plan
  for the main mode (12 cities, characters with portraits and choices, minigames, economy,
  losing, build order). Being built; every owner question is answered.

- [.md/CHALLENGES.md](.md/CHALLENGES.md): Challenges (20 house challenges), Community challenges
  (API, tables, migration to deploy), the Daily Ladder and the 15-rung Ladder.

- [README.md](README.md): what each mode is and how it plays; the game list.
- [.md/ARCHITECTURE.md](.md/ARCHITECTURE.md): code layout, the game/engine contract, the
  shared game UI (shell, board and dock pieces, colour rules, layout stability), survival
  internals, dev mode, and the checklist for adding a game. **Read before touching any game.**
- [.md/GAME_REDESIGN_HANDOFF.md](.md/GAME_REDESIGN_HANDOFF.md): the per-game board redesign:
  what each board looks like, the shared board pieces, the fit-without-scrolling and motion
  rules. **Read before changing a game's board.**
- [.md/CASINO_THEME_HANDOFF.md](.md/CASINO_THEME_HANDOFF.md): the casino theme pass (wood, gold,
  table colours) still to apply to the remaining games, with a cheap way to work through it.
- [.md/BALANCE_AUDIT.md](.md/BALANCE_AUDIT.md): every survival and game number (quotas, sparks,
  shop, perks, missions, per-game EV), checked against the code.
- [.md/ACTIVE_ITEMS_SPEC.md](.md/ACTIVE_ITEMS_SPEC.md): design for survival active items.
  Not built yet; it says what scaffolding exists.
- [.md/TODO.md](.md/TODO.md): the owner's current to-do list.
- [.md/NAVBAR_HANDOFF.md](.md/NAVBAR_HANDOFF.md): the bigger-navbar change (64px on tall
  screens) and the check still to run on it.
- [.md/MOBILE_UI_HANDOFF.md](.md/MOBILE_UI_HANDOFF.md): the phone-sized UI audit across Daily,
  Ladder, Tables and all 24 Freeplay games: what was checked (360–412px wide, betting and
  in-round), the fixes (board badge bands, Ladder strip, Baccarat hands, Tables seat grid,
  dock floors), the new `scripts/design-check/mobile-check.cjs`, and what is left.

## Working rules

- Keep docs current. When a change makes a doc wrong (a number in the audit, a convention in
  the architecture doc, a finished TODO item), update it in the same change.
- Game numbers live in the engines (`games/*/engine.ts`) and `lib/survival/balance.ts`. Docs
  and the rules pages (`lib/game-tutorials.ts`) mirror them, so change them together.
- Build game UI from the shared pieces (`components/game-layout.ts`,
  `components/game-dock-parts.tsx`, `components/games/board-tile.tsx`,
  `components/games/playing-card.tsx`). Don't hand-roll colours or buttons in a game.
- Game changes are visuals-only unless the owner asks otherwise; never change outcomes,
  payouts or timings by accident.
- Checks: `npx tsc --noEmit` and `pnpm lint`; for story work also `pnpm check:story` and `pnpm sim:story`. Lint has three existing errors, in
  `lib/game-registry.tsx` and `lib/survival/migrate.ts`.
