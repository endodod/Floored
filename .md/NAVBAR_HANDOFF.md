# Navbar + TODO handoff

Status as of 2026-10-28, branch `claude/inspiring-darwin-f2o73i` (based on `main` at `9193063`).

## Where the TODO lives

`.md/TODO.md` was only on `claude/beautiful-lamport-i66s82`. It has been copied
onto this branch as a file only. That branch's three commits (shared board
primitives / "Unify game boards", dock buttons and palette, "How to play" page
per game) are **not merged here**: merging them into `main`'s line conflicts in
~18 files (every `components/games/*/game.tsx`, `plinko-board.tsx`), because
`beautiful-lamport` (branched at `2a5b198`) and `main` (per-game redesign,
batches 1–5) restyled the same boards in parallel. **Owner decision needed:**
which board design wins per game, or whether to port only the non-conflicting
parts (`app/how-to-play/[game]/page.tsx`, `lib/game-tutorials.ts`,
`components/back-button.tsx`, the How to play button) onto `main`.

The first two TODO items are ticked because of that unmerged branch: on `main`
they are not live yet.

## Done: Bigger navbar

- `tailwind.config.ts`: new screen `tall` = `(min-height: 721px)`.
- `components/navbar.tsx`: under `tall:` the bar is 64px (was 48px), with a
  24px mark, 18px wordmark, 15px mode links, wider gaps, 40px account button,
  larger figure (balance / pot) and icons. The mobile menu sheet's header
  matches.
- Short viewports (≤720px tall: 720p, zoomed laptops) keep the 48px bar so
  the game boards there lose no height (the redesign handoff's ~195px board case).
- The layout is a flex column (`app/layout.tsx`, `h-screen`), so the board
  area shrinks by the 16px on its own; nothing else depends on the nav height.

Checked: `tsc` clean, `next lint` clean on the navbar; screenshots at 1440×900
(nav 65px incl. border), 1280×720 (49px), 390×844 phone (65px), no horizontal
scroll.

**Not done:** `scripts/design-check/responsive-check.cjs` over the games was
interrupted before it ran. Run it on a few games (tall views lost 16px of
board) before calling this finished:

    node scripts/design-check/responsive-check.cjs ./out /freeplay/blackjack /freeplay/slots /freeplay/case-battles

## Next on the TODO

"Game cards on the game page look bland" — waiting for owner feedback on the
navbar first.
