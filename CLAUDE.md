# Floored

Browser casino simulation with play money only. 18 games across four modes: Daily, Ladder,
Survival and Freeplay. Built with Next.js 15 (App Router), TypeScript, Tailwind and Zustand.

## Docs

Read the one that matches the task before changing code:

- **On this branch:** [.md/MODE_ADJUSTMENTS_HANDOFF.md](.md/MODE_ADJUSTMENTS_HANDOFF.md) — the plan
  for re-checking Survival perks and Ladder on the redesigned boards. Start here.

- [README.md](README.md): what each mode is and how it plays; the game list.
- [.md/ARCHITECTURE.md](.md/ARCHITECTURE.md): code layout, the game/engine contract, the
  shared game UI (shell, board and dock pieces, colour rules, layout stability), survival
  internals, dev mode, and the checklist for adding a game. **Read before touching any game.**
- [.md/GAME_REDESIGN_HANDOFF.md](.md/GAME_REDESIGN_HANDOFF.md): the per-game board redesign:
  what each board looks like, the shared board pieces, the fit-without-scrolling and motion
  rules. **Read before changing a game's board.**
- [.md/BALANCE_AUDIT.md](.md/BALANCE_AUDIT.md): every survival and game number (quotas, sparks,
  shop, perks, missions, per-game EV), checked against the code.
- [.md/ACTIVE_ITEMS_SPEC.md](.md/ACTIVE_ITEMS_SPEC.md): design for survival active items.
  Not built yet; it says what scaffolding exists.
- [.md/TODO.md](.md/TODO.md): the owner's current to-do list.
- [.md/NAVBAR_HANDOFF.md](.md/NAVBAR_HANDOFF.md): the bigger-navbar change (64px on tall
  screens) and the check still to run on it.

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
- Checks: `npx tsc --noEmit` and `pnpm lint`. Lint has three existing errors, in
  `lib/game-registry.tsx` and `lib/survival/migrate.ts`.
