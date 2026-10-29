# Casino theme pass: handoff

Give every game the same casino look that Roulette, Fortune Wheel, Slots, Over-Under and Run
Dice already have. **Theme only:** colours, frames, trim, labels. No layout rework, no new
features, and never a change to outcomes, payouts or timings (see CLAUDE.md).

## Working cheaply (low token use)

- Read only what you need: the game's `game.tsx` render block and its `.<prefix>-*` block in
  `app/globals.css`. Don't re-read the whole redesign doc; the rules below are enough.
- One game per commit. Batch edits per game (one Edit/script pass), then check.
- One screenshot per game at 1280×800 after the change. Add a phone shot (W=390 H=844)
  only when you touched sizes. Use the existing script:
  `BASE_URL=http://localhost:3123 W=1280 H=800 node scripts/design-check/play-game.cjs out.png /freeplay/<game> [steps]`
- Dev server: `npx next dev -p 3123` (the `--turbo` dev script fails to fetch Google Fonts here).
- Checks once per game: `npx tsc --noEmit`; `pnpm lint` once at the end (3 known errors).
- Skip a game in one line if it already fits the style.

## The style kit (copy these, don't invent new colours)

| Piece | Where to copy from | Values |
|---|---|---|
| Wood frame with gold trim | `.sl-cabinet`, `.ou-rail`, `.rd-layout` in `globals.css` | `linear-gradient(#5a3b22, #3a2617 45%, #22160d)`; trim `inset 0 0 0 1px rgba(217,164,65,0.55)`; drop `0 18px 36px -12px rgba(0,0,0,0.75)` |
| Table colours | `POCKET_FILL` in `roulette/game.tsx` | red `#a92b42`, black `#141318`, green `#2a7a57`, ivory text `#f4f1ea` |
| Gold rules / hairlines | Roulette table grid | `rgba(217,164,65,0.4)` gap colour, or `inset 0 0 0 1px rgba(217,164,65,0.3)` |
| Brass / gold metal | wheel hub, `.ou-lever` | `#a87a2e` → `#f2d48f` → `#d9a441` → `#8a6224` |
| Ivory (dice, balls, reels) | `.rd-die`, `.ou-ball`, `.sl-reel` | `#fbfaf6` → `#e7e4dc` → `#cfcbc1` |
| Printed labels | `.felt-print` | gold small caps; use for field labels ("Payout", "Win chance") |
| Figure panels | `.rd-plaque` | `rgba(0,0,0,0.3)` + gold hairline |
| Dark outline on fields | Run Dice map | `border-2 border-black` on every field, not only the winning ones |

Meaning still holds: felt / green = win or selected, loss / red = lost, gold = money and
special. Keep the token colours (`text-felt`, `text-loss`, `text-gold`) for figures and
outcome glows; the table colours above are for surfaces.

## Per game

Done: Roulette, Fortune Wheel, Slots, Over-Under, Run Dice, Plinko (brass pegs), Mines, Keno, Dragon Tower.

| Game | Suggested change |
|---|---|
| Blackjack | Gold-print the rules arc if it isn't already; wood-and-gold rim on the card shoe / dealer area if there is one. Cards stay as they are. |
| HiLo | Higher / Lower guess buttons on the board: table green / red fills with gold hairline; felt-print labels. |
| 1-Player Poker | Pay table already gold: put it in a wood frame (`.rd-layout` look). |
| Chicken Road | Lane tiles get the dark outline + gold hairline; curb in wood tone. |
| Coin Flip | Coin to brass/gold metal gradient if it isn't; Heads / Tails picks as table chips (green / red with gold rim). |
| Street Cups | Cups already drawn: add a wood-and-gold base strip under them (a table rail). |
| Crash | Chart panel in a wood-and-gold frame; keep the felt-print grid. |
| Chicken Race | Track in a wood-and-gold rail like `.ou-rail`; lanes divided by gold hairlines. |
| Case Battles | Case column / battle area as `.rd-plaque` panels with gold hairline; labels felt-print. |

## When you're done

- Update the game's row in `GAME_REDESIGN_HANDOFF.md` (one clause, e.g. "casino trim: …").
- Any new class goes in the game's `@container` / prefix block; new animations go in the
  `:root[data-motion='reduced']` block.
- Delete this file when every row above is done or skipped, and drop its link from CLAUDE.md.
