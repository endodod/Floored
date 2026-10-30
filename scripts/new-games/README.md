# New-games number checks

Python 3 (standard library only) sketches that produced the figures in
`.md/NEW_GAMES_HANDOFF.md`. They are reference checks for the plan, not part of the
app. Once a game's engine exists, its TypeScript check in `scripts/check-new-games.ts`
(see the handoff, section 9) is the source of truth.

| Script | Prints |
|---|---|
| `deck_countdown.py` | Deck Countdown pay table and simulated RTP at several stopping points |
| `tower_of_cards_max.py` | Tower of Cards highest possible multiplier and the path to it (takes ~1 min) |
| `baccarat.py` | Baccarat P(Player / Banker / Tie), RTP per bet, and the Shoe Peek return |
| `sic_bo.py` | RTP of every Sic Bo spot over the 216 rolls |
| `floor_weights.py` | Survival weighted floor draw: games never offered per run, max appearances, owned vs other |

Run with `python3 -I scripts/new-games/<script>.py`.
