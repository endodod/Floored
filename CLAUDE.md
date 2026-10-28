# Floored

Browser casino simulation with play money only. 18 games across four modes: Daily, Ladder,
Survival and Freeplay. Built with Next.js 15 (App Router), TypeScript, Tailwind and Zustand.

## Docs

Read the one that matches the task before changing code:

- [README.md](README.md): what each mode is and how it plays; the game list.
- [.md/ARCHITECTURE.md](.md/ARCHITECTURE.md): code layout, the game/engine contract, the
  shared game UI (shell, board and dock pieces, colour rules, layout stability), survival
  internals, dev mode, and the checklist for adding a game. **Read before touching any game.**
- [.md/BALANCE_AUDIT.md](.md/BALANCE_AUDIT.md): every survival and game number (quotas, sparks,
  shop, perks, missions, per-game EV), checked against the code.
- [.md/ACTIVE_ITEMS_SPEC.md](.md/ACTIVE_ITEMS_SPEC.md): design for survival active items.
  Not built yet; it says what scaffolding exists.
- [.md/TODO.md](.md/TODO.md): the owner's current to-do list.

## Working rules

- Keep docs current. When a change makes a doc wrong (a number in the audit, a convention in
  the architecture doc, a finished TODO item), update it in the same change.
- Game numbers live in the engines (`games/*/engine.ts`) and `lib/survival/balance.ts`. Docs
  and the rules pages (`lib/game-tutorials.ts`) mirror them, so change them together.
- Build game UI from `components/game-board-ui.ts`, `components/game-layout.ts` and
  `components/game-dock-parts.tsx`. Don't hand-roll colours or buttons in a game.
- Checks: `npx tsc --noEmit` and `pnpm lint`. Lint has three existing errors, in
  `lib/game-registry.tsx` and `lib/survival/migrate.ts`.
