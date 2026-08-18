# Floored — Game Balance Audit

Source: codebase only (`lib/survival/`, `games/`, `store/`, etc.). Generated from repository state.

---

## 1. RUN OVERVIEW

### Structure
| Parameter | Value | Source |
|-----------|-------|--------|
| Standard run length | **10 floors** (`MAX_FLOORS`) | `lib/survival/balance.ts` |
| Games offered per floor (lobby) | **6** (`GAMES_PER_FLOOR` in `lib/survival/floor-generator.ts`) |
| Bets per floor (hard cap) | **10** (`FLOOR_BET_LIMIT`) | `lib/survival/balance.ts` |
| Games player may play per floor | Any of the **6 lobby games**, until **10 total bets** are placed across all games (no per-game bet cap in code) | `store/survival-store.ts` `recordResult` / `recordResultPayout` |
| Full game pool size | **18** games (`SURVIVAL_GAME_POOL`) | `lib/survival/balance.ts` |

### Win condition (successful run)
- Reach **floor 10**, meet quota on that floor, then choose **Claim Victory** in `FloorCompleteModal` → `endRun({ victory: true })`.
- Victory awards floor sparks (see §2) and stores `lastRun` with `victory: true`, `floorsReached: 10`.

### Fail conditions
| Reason | ID | Trigger |
|--------|-----|---------|
| **Quota miss** | `quota` | After the **10th bet** on a floor, if `bankroll < quotaTarget` → `runDefeated: true`, `defeatReason: 'quota'`. |
| **Bust** | `bust` | After any resolve, if `bankroll < floorMinBet` → `queueDefeat('bust')` (pending until confirmed). **Not** bankroll === 0. |
| **Abandon** | — | `abandonRun()` resets run (not a `defeatReason`). |

**No “Last Resort” or other grace mechanic** exists in code.

### Starting state (new run)
| Resource | Value |
|----------|-------|
| Bankroll | **1,000** (`STARTING_BANKROLL`) |
| Sparks | **15** (`STARTING_SPARKS`) |
| Reroll tickets | **3** (`STARTING_REROLL_TICKETS`) in inventory as `reroll_floor_game` |
| Floor | 1 |
| Floor min bet | **20** (`FLOOR_MIN_BETS[1]` in `utils/math.ts`) |
| Purchased upgrades | `[]` (unless `GRANT_ALL_UPGRADES = true`, dev-only) |
| Run dice config | New `generateRunDiceConfig()` per run |
| `modifiers` | `[]` (persisted but **never populated**) |
| `slotsUsed` | `0` (**legacy field**; not incremented by current bet logic) |

Sparks **reset to 15** on every new run and on abandon; they are **run-scoped**, not permanent meta-currency.

### Timers
| Scope | Status |
|-------|--------|
| Per floor timer | **Removed** — `hooks/use-floor-timer.ts`: “Timer-based floor limit removed. Floor now ends after FLOOR_BET_LIMIT bets.” |
| Per game timer | **None** in survival logic |

### Endless mode
- **Exists**: After clearing floor 10 (quota met, bet limit reached or early finish flow), player may **Continue — Endless Mode** → `continueToEndless()` sets `endlessMode: true`.
- **Differences vs standard**:
  - UI shows floor as `∞` instead of `/ 10`.
  - `generateFloor` for `floor > MAX_FLOORS`: **random** 6 games via `fisherYates` + seed `${runSeed}:endless:${floor}` (not the precomputed 10-floor schedule).
  - Quota and min bet **keep scaling** (`calcQuotaTarget`, `getFloorMinBet` endless formula).
  - `advanceFloor` allowed when `endlessMode` even past floor 10.
  - Victory claim only on floor 10 when **not** already in endless mode.

### Difficulty (run-wide)
| Difficulty | Quota mult | Shop price mult | UI |
|------------|------------|-----------------|-----|
| `normal` | 1.0× | 1.0× | Enabled |
| `hard` | 1.5× | 1.5× | **Disabled** (`disabled: true` in `difficulty-dialog.tsx`) |
| `nightmare` | 2.5× | 2.0× | **Disabled** |

### Early floor completion
- If `bankroll >= quotaTarget` before 10 bets: navbar dev/control can call `finishQuotaEarly()` → `floorCompleteReason: 'early'`; player may advance or keep betting until 10 bets.

---

## 2. SPARK ECONOMY

### What are Sparks?
Run-scoped currency used to **buy shop upgrades** and **Lobby Reroll Tickets**. Shown as ✦ in UI.

### Starting spark count
**15** at run start (`STARTING_SPARKS`).

### Spark cap
**None** in code (`spendSparks` floors at 0; no maximum).

### Spark gains (every source)

| Source | Formula / amount | When credited |
|--------|------------------|---------------|
| **Floor completion base** | `max(8, floor((8 + floor × 2) × sparkFloorMult(floor)))` where `sparkFloorMult(f) = 1 + (f - 1) × 0.2` | On `advanceFloor`, `continueToEndless`, or `endRun` victory (same `calcFloorSparksEarned` call) |
| **Over-quota bonus** | `+min(5, floor((bankroll - quotaTarget) / 500))` if `bankroll >= quotaTarget` at floor end | Same |
| **Mission completion** | Per mission `rewardSparks` (see §6) | Added in same floor transition sum: `missions.filter(completed).reduce(rewardSparks)` |

**Example floor sparks (at exact quota, normal, no missions):**

| Floor | `sparkFloorMult` | Base sparks |
|-------|------------------|-------------|
| 1 | 1.0 | 10 |
| 5 | 1.8 | 32 |
| 10 | 2.8 | 78 |

### Spark costs (shop)

**Price formula:** `calcShopPrice(baseCost, difficulty) = ceil(baseCost × DIFFICULTY_SHOP_PRICE_MULT[difficulty])`.

**Level cost formula (all leveled catalog items):** `levelCost(base, L) = round(base × (1 + (L - 1) × 0.5))`.

#### Run-wide upgrades
| Item | Family ID | Base | L1–L5 costs (normal) | Effect |
|------|-----------|------|----------------------|--------|
| Lucky Charm | `run_payout_boost` | 12 | 12, 18, 24, 30, 36 | +5%, +10%, +15%, +20%, +25% on **all** win payouts (`RUN_PAYOUT_MULT_BY_LEVEL`) |
| Opening Ticket | `first_bet_free` | 20 | 20, 30, 40, 50, 60 | First bet each floor free up to **10×, 12×, 16×, 22×, 30×** floor min bet (`OPENING_TICKET_CAP_BY_LEVEL`) |

#### Game Boost (×18 games)
| Item pattern | Family | Base | L1–L5 costs | L1–L5 payout mult |
|--------------|--------|------|-------------|-------------------|
| e.g. Card Counter (Blackjack) | `{game}_boost` | 14 | 14, 21, 28, 35, 42 | 1.05, 1.12, 1.20, 1.30, 1.40 |

Boost names per game: `GAME_BOOST_LABELS` in `lib/survival/upgrades-catalog.ts` (18 unique names).

#### Game Perks (×18 games) — base costs (L1); L2–L5 = `levelCost(base, L)`
| Game | Perk name | Base | Rarity |
|------|-----------|------|--------|
| blackjack | Hole Card Reader | 24 | epic |
| hilo | Hot Streak | 20 | rare |
| chicken-race | Slow Scout | 22 | rare |
| crash | Crash Zone | 22 | rare |
| mines | Mine Sweeper | 20 | rare |
| plinko | Golden Ball | 18 | rare |
| over-under | Safe Opening Roll | 16 | rare |
| wheel | Color Scout | 18 | rare |
| run-dice | Loss Shield | 16 | rare |
| chicken-road | Safe Lane | 20 | rare |
| slots | First Spin Shield | 18 | rare |
| roulette | Ball Tracker | 22 | epic |
| dragon-tower | Dragon’s Blind Spot | 22 | rare |
| street-cups | Cup Truth | 18 | rare |
| case-battles | Case X-Ray | 20 | rare |
| poker-1p | Hold Harmony | 20 | rare |
| keno | Number Heat | 22 | epic |
| coin-flip | Weighted Edge | 20 | rare |

#### Consumable (active shop slot)
| Item | ID | Base cost | Effect |
|------|-----|-----------|--------|
| Lobby Reroll Ticket | `reroll_floor_game` | **8** | +1 ticket; reroll lobby game / shop slot / mission (see §8) |

**Active Items panel:** `components/survival/active-items-panel.tsx` — **placeholder** (“Coming soon”, count 0).

### Rerolls (sparks vs tickets)
| Context | Spark cost? | Implemented in UI? |
|---------|-------------|-------------------|
| Full shop reroll | `calcShopRerollCost(n) = ceil((5 + 4n) × diff shop mult)` | **`rerollShop` in store only — no UI button** |
| Reroll all missions | `calcMissionRerollCost(n) = ceil((4 + 3n) × diff shop mult)` | **Store only — no UI** |
| Reroll single mission (sparks) | Same mission formula | **Store only — no UI** |
| Lobby / shop slot / mission | **1 ticket** (no sparks) | **Yes** — lobby ↻, shop ↻, mission ↻ |

Shop reroll count **not capped** in code (increments `shopRerollCount` each `rerollShop` call).

### Floor-based spark gain formula
`sparkFloorMult(floor)` linear **1.0 → 2.8** from floor 1 to 10; used inside `calcFloorSparksEarned` base term.

### Flags / placeholders
- `GRANT_ALL_UPGRADES = false` with comment “Set false before release” — dev bypass.
- `balance.ts` comment “Spark reward multiplier per floor (used in Step 7)” — implemented, comment is stale step label.
- **No spark recovery** if player spends all sparks and pool is empty until next floor missions/income.

---

## 3. QUOTA / BANKROLL TARGETS

### Quota definition
**Absolute bankroll** must reach `quotaTarget` (not net profit from floor start, though UI progress bar uses net from `floorStartBankroll`).

### Formula
```
base = round(2000 × 500^((floor - 1) / 9))
quotaTarget = round(base × DIFFICULTY_QUOTA_MULT[difficulty])
```
Documented anchors: floor 1 = **$2,000**, floor 10 = **$1,000,000** (normal).

### Quota table (normal difficulty)

| Floor | Quota |
|-------|-------|
| 1 | 2,000 |
| 2 | 3,989 |
| 3 | 7,958 |
| 4 | 15,874 |
| 5 | 31,664 |
| 6 | 63,162 |
| 7 | 125,992 |
| 8 | 251,321 |
| 9 | 501,319 |
| 10 | 1,000,000 |
| 11 (endless) | 1,994,737 |
| 15 (endless) | 31,581,138 |
| 20 (endless) | 997,368,299 |

Hard (1.5×) and nightmare (2.5×) multiply these when enabled.

### Minimum bet
**Per floor, survival only** (`getFloorMinBet`):

| Floor | Min bet |
|-------|---------|
| 1 | 20 |
| 2 | 50 |
| 3 | 100 |
| 4 | 200 |
| 5 | 500 |
| 6 | 1,000 |
| 7 | 2,000 |
| 8 | 4,000 |
| 9 | 7,000 |
| 10 | 10,000 |
| 11+ | Previous × **1.5** per floor (from 10,000 base) |

Freeplay min bet = **1** (`bet-panel.tsx`).

### Maximum bet
- **Upper bound = bankroll** (or `wagerCap` with Opening Ticket: `max(bankroll, openingTicketFreeCap)` so free first bet can use higher nominal wager).
- **No separate max-bet % of bankroll** beyond bankroll itself.

### Fail floor quota
- After bet **10**: if `bankroll < quotaTarget` → immediate run defeat (`quota`).
- **No** partial credit, extension, or Last Resort.

---

## 4. ALL GAMES — INDIVIDUAL BREAKDOWN

**Global survival bet rules:** min = `floorMinBet`, max = `bankroll` / `wagerCap`. Payout boosts stack: `computePayoutMultiplier` = product of run + game boost mults on wins. Free first bet: profit-only payout adjustment in `applyResolveModifiers`.

**Dev-only:** `cursed` / `blessed` (navbar) force win/loss paths — excluded from balance below.

---

### blackjack
- **ID:** `blackjack`
- **Rules:** Standard blackjack vs dealer; dealer hits on <17; 2-card blackjack.
- **Bet range:** `floorMinBet` – `bankroll`.
- **Wins:** Regular **2×** bet payout mult; blackjack **2.5×**; push **1×** (stake returned).
- **Loss:** **0×**; bust before dealer finishes.
- **Edge cases:** Push; simultaneous blackjack push; double down (extra bet).
- **Optimal EV:** Basic strategy ≈ **~99% RTP** (rules: 2.5× BJ, dealer stand soft 17 implied by `dealerShouldHit` <17 only).
- **Worst case:** −1× bet (or −2× if doubled).
- **Game Boost:** +5% / +12% / +20% / +30% / +40% win payout (L1–L5).
- **Game Perk — Hole Card Reader:** See dealer hole card while playing (`perk_peek_dealer`); **no proc roll** — always on if owned; **levels do not change effect** in code.
- **TODO:** None in engine.

---

### crash
- **ID:** `crash`
- **Rules:** Multiplier grows `e^(0.23 × t_seconds)`; crash point uniform-skewed in **[1.05, 30]** via `pow(random, 2.5)`.
- **Bet range:** min–max as above.
- **Wins:** `payout = round(bet × cashoutMultiplier)` if cashed before crash.
- **Loss:** No cashout before crash → **0**.
- **Edge cases:** Manual cashout timing; crash at 1.05× ~200ms.
- **Optimal EV:** **Player-dependent** (cashout strategy); uniform crash PDF on [1.05,30] is not flat — low crashes heavily weighted.
- **Worst case:** −1× bet.
- **Game Boost:** Standard game boost table.
- **Game Perk — Crash Zone:** Shows band ±**8/7/6/5/4%** of `crashAt` by level (`CRASH_ZONE_PAD_BY_LEVEL`); informational.
- **TODO:** None.

---

### plinko
- **ID:** `plinko`
- **Rules:** 12 rows, 13 slots; risk `low` / `medium` / `high`.
- **Bet range:** min–max.
- **Payouts (medium):** `[8, 5, 3, 1.5, 1, 0.8, 0.5, 0.8, 1, 1.5, 3, 5, 8]` × bet (binomial slot distribution).
- **Loss:** Payout < bet (`outcome` loss if `payout < betAmount`).
- **Edge cases:** Center **0×** on high risk; golden ball (perk) doubles payout if `multiplier > 1`.
- **Optimal EV (medium):** **~0.955×** per drop (documented in engine comments).
- **Worst case:** **0×** (high risk center) or 0.5× on medium.
- **Game Boost:** Standard.
- **Game Perk — Golden Ball:** **~30–75%** proc per bet (`perk_plinko_golden_ball`); when active, **2×** payout if slot mult > 1.
- **TODO:** None.

---

### over-under
- **ID:** `over-under`
- **Rules:** Roll **1–100**; win if `roll ≤ safeZone%` (default **40%**; UI slider **10–90**).
- **Bet range:** min–max.
- **Win mult:** `(max(1/safeRatio, 1.05) × 0.92)` e.g. 40% zone → **2.30×** (`getOverUnderPayoutMultiplier`).
- **Loss:** **0** payout.
- **Edge cases:** Perk first roll push (refund) via shield proc.
- **Optimal EV:** At 40% zone ≈ **0.4 × 2.30 = 0.92×** (by design ~92% RTP factor).
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Safe Opening Roll:** **30–75%** proc; first roll cannot lose (push/refund).
- **TODO:** None.

---

### wheel
- **ID:** `wheel`
- **Rules:** 12 slots: red **6×2×**, blue **3×3×**, green **2×4×**, gold **1×5×**; pick one color.
- **Bet range:** min–max.
- **Win:** Bet color hits → **2 / 3 / 4 / 5×** by segment.
- **Loss:** **0**.
- **Edge cases:** Color Scout crosses out one losing color before spin (preview).
- **Optimal EV (red bet):** P(win)=**50%**, payout **2×** → **1.0×** (fair for 2× segments).
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Color Scout:** Pre-spin eliminate one losing color (from `previewWheelOutcome`); not proc-gated in preview path.
- **TODO:** None.

---

### run-dice
- **ID:** `run-dice`
- **Rules:** Per-run config: **2** win sums, **3** loss sums, rest neutral; one roll (neutral auto re-roll up to **3** rolls); win pays dynamic mult.
- **Bet range:** min–max.
- **Win mult:** `max(1/winProbability, 1.05) × 0.92` from dice sum weights on 2d6 (36 outcomes).
- **Loss:** **0** (or push with Loss Shield).
- **Edge cases:** Push after 3 neutrals; run-wide `diceConfig` fixed at run start.
- **Optimal EV:** **~0.92×** per round (92% factor in formula); exact win% depends on generated sums (~**22.2%** for default 2-win / 3-loss split example).
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Loss Shield:** **30–75%** proc; loss → push (bet returned).
- **TODO:** None.

---

### mines
- **ID:** `mines`
- **Rules:** 5×5 grid; difficulties: **3 / 7 / 13 / 20** mines; reveal safe tiles or cash out.
- **Bet range:** min–max.
- **Win mult:** After each safe reveal: `mult *= 25 / (remainingSafe + 1)` (rounded 2 dp).
- **Loss:** Hit mine → **0**.
- **Edge cases:** Clear all safe → auto win; cash out anytime in progress.
- **Optimal EV:** **Player-dependent** (stop policy); first click easy survival **88%**.
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Mine Sweeper:** **30–75%** proc; reveal one safe tile at round start.
- **TODO:** None.

---

### chicken-road
- **ID:** `chicken-road`
- **Rules:** 10 steps; each step death chance and multiplier in `STEP_DATA`; cash out or advance.
- **Bet range:** min–max.
- **Step mults:** 0.9, 1.5, 2, 3, 4.5, 7, 11, 17, 25, 40; death **10%–90%** by step.
- **Loss:** Death → **0**; cash out < bet on early steps (e.g. step 1 **0.9×**).
- **Edge cases:** Safe Lane perk forces one safe crossing.
- **Optimal EV:** **Path-dependent** (cash-out step); always cash step 1 → **0.9 × 0.9 = 0.81×** before boosts.
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Safe Lane:** **30–75%** proc; `advanceChickenRoundSafe` (guaranteed step success).
- **TODO:** None.

---

### slots
- **ID:** `slots`
- **Rules:** 3 reels, weighted symbols; paytable in `PAYTABLE` / `resolveReels`.
- **Bet range:** min–max.
- **Wins:** 3× seven **50×**, diamond **25×**, bell **15×**, bar **10×**, cherry **5×**; 2 cherry/bar **0.5×**; wild substitutes.
- **Loss:** **0×** mult.
- **Edge cases:** First Spin Shield push on loss proc.
- **Optimal EV:** **~1.048×** bet (enumerated from reel weights) — **above 100% RTP** in base engine.
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — First Spin Shield:** **30–75%** proc; first spin loss → push.
- **TODO:** None.

---

### roulette
- **ID:** `roulette`
- **Rules:** European **37** pockets (0–36); outside bets and straight-up **36×**.
- **Bet range:** min–max (single target + amount in survival UI).
- **Payouts:** Red/black/odd/even/low/high/dozens per `BET_PAYOUTS`; straight **36×**.
- **Loss:** Uncovered number → **0** on that bet.
- **Edge cases:** Push when `net === 0` on multi-bet settle; 0 loses on even/odd per engine (`n > 0` for even/odd).
- **Optimal EV:** Red/black **~48.6% × 2 ≈ 97.3%** (single zero).
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Ball Tracker:** Shows **3** numbers that will not hit (epic); uses pre-rolled result in survival.
- **TODO:** None.

---

### dragon-tower
- **ID:** `dragon-tower`
- **Rules:** 5 rows × 3 tiles; 1 dragon per row; pick tile or cash out.
- **Bet range:** min–max.
- **Floor mults:** **1.40, 1.96, 2.74, 3.84, 5.38** (cash out after clearing row uses that row’s mult).
- **Loss:** Pick dragon → **0**.
- **Edge cases:** Top clear auto-win at **5.38×**; cash out requires `cashoutMultiplier > 0`.
- **Optimal EV (always pick random, cash last row):** P(top) = **(2/3)^5 ≈ 13.2%** × 5.38 ≈ **0.71×** (simplified).
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Dragon’s Blind Spot:** Safe tile marked floors **1–2** (implementation via perk hook).
- **TODO:** None.

---

### chicken-race
- **ID:** `chicken-race`
- **Rules:** Pick 1 of 4 chickens; **25%** win each; **3.60×** on win.
- **Bet range:** min–max.
- **Win:** **3.60×**; loss **0**.
- **Edge cases:** Slow Scout eliminates one non-winner pre-race.
- **Optimal EV:** **0.25 × 3.60 = 0.90×**.
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Slow Scout:** Remove one losing chicken before pick.
- **TODO:** None.

---

### street-cups
- **ID:** `street-cups`
- **Rules:** 3 cups, 12 swaps, pick cup; **2×** on win (`STREET_CUPS_WIN_MULTIPLIER`).
- **Bet range:** min–max.
- **Win:** **2×**; loss **0**.
- **Edge cases:** Cup Truth eliminates one empty cup.
- **Optimal EV:** **(1/3) × 2 = 0.667×**.
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Cup Truth:** One empty cup crossed off.
- **TODO:** None.

---

### case-battles
- **ID:** `case-battles`
- **Rules:** Select up to **5** cases priced `minBet × [1,5,10,50,100]`; open vs bot; higher total value wins; tie → push.
- **Bet range:** Total case prices (can exceed min bet); component uses bankroll guard.
- **Win:** Payout = **userTotal** (chip value sum); cost = sum case prices — net ≈ profit if win.
- **Loss:** **0** return (lose battle).
- **Edge cases:** Tie returns bet (push); item tiers designed **~0.94×** case price EV per open (`ITEM_TIERS` comment).
- **Optimal EV:** **~0.94×** per case price spent (engine comment); battle outcome ~50% win without bias → **~0.94×** rough.
- **Worst case:** −total case cost.
- **Game Boost:** Standard.
- **Game Perk — Case X-Ray:** See one case tier before open (**30–75%** proc).
- **TODO:** None.

---

### poker-1p
- **ID:** `poker-1p`
- **Rules:** 5-card draw; hold/draw; paytable `HAND_PAYOUTS`.
- **Bet range:** min–max.
- **Payouts:** Royal **800×**, straight flush **50×**, four **25×**, full house **9×**, flush **6×**, straight **4×**, trips **3×**, two pair **2×**, jacks+ **1×**.
- **Loss:** No hand **0**.
- **Edge cases:** Hold Harmony **58%** bias to held ranks on draw (normal); blessed/cursed dev paths.
- **Optimal EV:** **Strategy-dependent**; jacks+ at **1×** is sub-bet return multiplier (profit = bet × mult).
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Hold Harmony:** **30–75%** proc; draw favors held ranks.
- **TODO:** None.

---

### hilo
- **ID:** `hilo`
- **Rules:** Guess higher/lower; streak mult `2 × 1.5^(streak−1)`; opening card never A or 2.
- **Bet range:** min–max.
- **Wins:** Cash out at current mult; wrong guess loses all.
- **Edge cases:** Tie preserves mult; go again; Hot Streak **25%** chance +1 extra streak step (`bumpStreak`).
- **Optimal EV:** **Player-dependent** (cash-out depth); fair-card guess ≈ **50%** per step before ties.
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Hot Streak:** **25%** on correct guess to `bumpStreak` (extra streak step) — **not** in proc table; always checked if perk owned.
- **TODO:** None.

---

### keno
- **ID:** `keno`
- **Rules:** Board **25**, draw **5**, pick **1–5**; hits pay `HIT_MULTIPLIERS`: 1→0.5, 2→1, 3→3, 4→5, 5→10.
- **Bet range:** min–max.
- **Loss:** 0 hits → **0** mult.
- **Edge cases:** Number Heat highlights 2 winning numbers.
- **Optimal EV (5 picks):** **~0.559×** (hypergeometric enumeration).
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Number Heat:** Shows 2 numbers that will hit.
- **TODO:** None.

---

### coin-flip
- **ID:** `coin-flip`
- **Rules:** Pick heads/tails; win → ride streak **2^streak** or cash out; wrong → lose all.
- **Bet range:** min–max.
- **Win:** Cash out at **2×, 4×, 8×, …**; single win **2×**.
- **Loss:** **0** on miss.
- **Edge cases:** Weighted Edge perk biases win chance **58–75%** by level.
- **Optimal EV (fair 50%, always cash after 1 win):** **1.0×**; streak-riding lowers EV.
- **Worst case:** −1× bet.
- **Game Boost:** Standard.
- **Game Perk — Weighted Edge:** Win chance **58/63/67/71/75%** (`COIN_BIAS_CHANCE_BY_LEVEL`).
- **TODO:** None.

---

## 5. SHOP — ALL ITEMS

**Categories used in code:** `scope: 'run' | 'game' | 'consumable'` → mapped to Overall / Game Boost / Game Perk / Consumable. **Max level:** **5** (`MAX_UPGRADE_LEVEL`). **Permanent:** All upgrades are **run-permanent** (replace lower level in family). **Consumable:** tickets stack and are consumed.

**Cost formula:** `price(L) = ceil(levelCost(base, L) × shopDifficultyMult)`.

### Overall upgrades (run scope)

#### Lucky Charm (`run_payout_boost`) — Overall Upgrade — All games
| Level | Cost (normal) | Effect | Cumulative |
|-------|---------------|--------|------------|
| L1 | 12 | +5% win payout | 1.05× |
| L2 | 18 | +10% | 1.10× |
| L3 | 24 | +15% | 1.15× |
| L4 | 30 | +20% | 1.20× |
| L5 | 36 | +25% | **1.25×** |

#### Opening Ticket (`first_bet_free`) — Overall Upgrade — All games
| Level | Cost | Effect |
|-------|------|--------|
| L1 | 20 | First bet/floor free up to **10×** min bet |
| L2 | 30 | **12×** |
| L3 | 40 | **16×** |
| L4 | 50 | **22×** |
| L5 | 60 | **30×** |

### Game Boosts (18 × 5 levels) — Game Boost — per game
Each game: base **14**, costs **14/21/28/35/42**, effects **+5% / +12% / +20% / +30% / +40%** (same as `GAME_PAYOUT_MULT_BY_LEVEL`). Names in `GAME_BOOST_LABELS` (e.g. blackjack → Card Counter, crash → Early Cashout, …).

### Game Perks (18 × 5 levels) — Game Perk — per game
Costs = `levelCost(base, L)` from §2 table. Proc perks: **~30% + 11.25%×(level−1)** capped **75%** unless noted.

| Game | Perk | Mechanical effect (all levels unless scaled) |
|------|------|---------------------------------------------|
| blackjack | Hole Card Reader | Reveal dealer hole card (no proc) |
| hilo | Hot Streak | 25% double streak bump on correct guess |
| chicken-race | Slow Scout | Eliminate one non-winner |
| crash | Crash Zone | ±% band on crash point by level |
| mines | Mine Sweeper | Reveal one safe tile at start (proc) |
| plinko | Golden Ball | 2× payout when proc + mult>1 |
| over-under | Safe Opening Roll | First roll loss → push (proc) |
| wheel | Color Scout | Cross out losing color |
| run-dice | Loss Shield | Loss → push (proc) |
| chicken-road | Safe Lane | Guaranteed safe step (proc) |
| slots | First Spin Shield | First spin loss → push (proc) |
| roulette | Ball Tracker | 3 numbers shown won’t hit |
| dragon-tower | Dragon’s Blind Spot | Safe marks rows 1–2 |
| street-cups | Cup Truth | One empty cup removed |
| case-battles | Case X-Ray | One case tier revealed (proc) |
| poker-1p | Hold Harmony | Draw bias to held ranks (proc) |
| keno | Number Heat | 2 hitting numbers highlighted |
| coin-flip | Weighted Edge | Win chance 58–75% by level |

### Consumable
| Item | Category | Cost (normal) | Effect | Max |
|------|----------|---------------|--------|-----|
| Lobby Reroll Ticket | Consumable / Active slot | 8 | +1 reroll charge | Stack |

### Placeholders / flags
- **Active Items UI:** not implemented.
- **`rerollShop` / spark mission rerolls:** backend only.
- **`GRANT_ALL_UPGRADES`:** dev flag.
- Hard/nightmare difficulties disabled in UI.

---

## 6. MISSIONS

### Implementation status
**Fully implemented:** generation, per-bet evaluation (`mission-evaluator.ts`), floor-complete flawless check, spark rewards on floor advance, ticket reroll per slot.

### Scope
**Per-run, per-floor** (reset each floor; not session/permanent meta).

### Count
**3 missions per floor** (`MISSIONS_PER_FLOOR`).

### Mission templates (pool)

| Type | Target(s) | Base reward (sparks) | Description |
|------|-----------|-------------------|-------------|
| `win_streak` | 2 / 3 / 4 / 5 | 4 / 6 / 8 / 10 | Consecutive wins; loss resets |
| `play_game` | 1 | 5 | Play assigned floor game once at min bet+ |
| `min_multiplier` | 2 / 3 | 5 / 8 | Win with ≥ target × mult |
| `games_played` | 4 / 6 | 4 / 6 | Play N rounds at min bet+ |
| `flawless` | 1 | 8 | No losses this floor (fails on any loss) |
| `win_count` | 2 / 4 | 4 / 6 | N wins (losses OK) |
| `big_win` | 10× / 30× min bet | 5 / 8 | Net profit in one round |

**Reward scaling:** `reward = max(1, floor(base × (1 + (floor−1)×0.1) × diffMult))` where diffMult: normal **1**, hard **1.2**, nightmare **1.4**.

**Example rewards (normal):** win_streak-2 → floor1 **4**, floor5 **5**, floor10 **7** sparks.

### Exclusivity
Types `win_streak`, `min_multiplier`, `games_played`, `win_count`, `big_win`: only **one variant per type** per floor.

### Interaction with shop / sparks
- Rewards add to spark total on **floor transition** (with floor base sparks).
- Missions do **not** grant shop items.
- Mission reroll via **ticket only** in UI (spark `rerollMission` exists in store, not exposed).

---

## 7. FLOOR GENERATOR & GAME SELECTION

### Selection algorithm (floors 1–10)
1. `generateRunSchedule(runSeed, SURVIVAL_GAME_POOL)` — pool size **18**, **6** games/floor → **3 floors per shuffle**.
2. Fisher–Yates shuffle with RNG `seedFromString(runSeed + ':schedule')`.
3. Take consecutive slices of 6 from each shuffle until **10** floors filled.
4. **Property (comment in code):** each game appears **3–4 times** across 10 floors; never 0, never >5.

### Endless (floor > 10)
- `fisherYates` on full pool with seed `${runSeed}:endless:${floor}`, take first **6**.

### Invested-game guarantee
**Not implemented.** No reference to owned upgrades in `floor-generator.ts`.

### `lastFloorGames`
**Not implemented** (no matches in repository).

### Priority scoring / tie-breaking
**N/A** — deterministic schedule + seeded shuffle; no priority scoring.

### Pool membership
All **18** games in `SURVIVAL_GAME_POOL` with survival routes; **no weights** in generator (uniform shuffle).

### Lobby vs generator
- `lobby.tsx`: all games `availableSurvival: true` (18 playable).
- `balance.ts` comment: lobby flags decoupled from generator (“Step 13 will flip lobby flags”).
- `AI_HANDSHAKE.md` still lists some survival as locked — **doc drift**.

### Locked / disabled
- **Hard / nightmare** difficulty disabled.
- No games disabled in generator.

---

## 8. REROLLS

| Context | Currency | Cost / limit | UI |
|---------|----------|--------------|-----|
| Lobby game slot | Ticket | 1 ticket; pool = games not in `lobbyGamesOffered` | Lobby ↻ on each of 6 games |
| Shop slot (game/run/active) | Ticket | 1 ticket; cannot reroll purchased slot; pool excludes `shopOfferedIds` per kind | Shop ↻ per card |
| Single mission | Ticket | 1 ticket; **once per slot index** (`missionTicketRerolledSlots`) | Mission panel ↻ |
| All missions | Sparks | `ceil((4+3n)×diffMult)` | **Not in UI** (`rerollMissions`) |
| Single mission (sparks) | Sparks | Same | **Not in UI** (`rerollMission`) |
| Entire shop | Sparks | `ceil((5+4n)×diffMult)` | **Not in UI** (`rerollShop`) |

**Ticket grants:** start **3**, **+3** each `advanceFloor` / `continueToEndless` (`REROLL_TICKETS_PER_FLOOR`).

**Ticket purchase:** `purchaseLobbyRerollTicket` — **8** base sparks × difficulty.

**Caps:** No max on spark reroll counters; ticket count inventory-limited only.

---

## 9. BALANCE RED FLAGS

### Game EV outliers
| Issue | Detail |
|-------|--------|
| **Slots ~104.8% RTP** | Base reel weights yield >1.0× EV — strongest grind game without perks. |
| **Street cups ~66.7%** | 2× on 1/3 — weak unless missions need wins. |
| **Keno 5-pick ~56%** | Low hit rate vs mult table. |
| **Chicken race 90%** | Below fair 1.0 but above street cups. |
| **Plinko / run-dice / over-under** | Tuned ~92–96% RTP band. |
| **Skill / stop games** | Crash, mines, chicken-road, hilo, coin-flip streak — EV varies wildly with player policy. |

### Upgrade pricing
| Issue | Detail |
|-------|--------|
| **Stacked boosts** | Max game boost **1.40×** × run **1.25×** = **1.75×** win payouts — large with high-RTP slots. |
| **Epic perks same track depth** | Blackjack hole card L5 costs **72** sparks — informational edge, no level scaling. |
| **Opening Ticket** | Free first bet up to 30× min bet at L5 can be very strong on high floors. |

### Degenerate strategies
- **Slots + payout boosts + free opener** for quota rush.
- **Coin-flip Weighted Edge 75%** + streak cash-out rules.
- **Dev blessed mode** (navbar) trivializes all games — not production balance.

### Quota unreachable?
- Floor 10 quota **1,000,000** from **1,000** start with **10 bets** requires ~doubling every bet on average — **extremely tight** without high-mult games (crash, poker jackpots, streak games) and upgrades.
- Endless scaling faster than min bet (×1.5 vs exponential quota).

### One-time items
- **Lobby tickets** flexible but **not** overpowered alone; no other actives in catalog.

### Spark starvation
- Start **15**; L5 epic perk **72**; floor 1 income **~10** + missions **~4–10** each.
- **No meta persistence** — bad run = same start next run.
- Empty shop pool if all families maxed — **no spark sink recovery** until next floor offers.

### TODO / placeholders / magic numbers
| Item | Location |
|------|----------|
| `GRANT_ALL_UPGRADES` | `balance.ts` |
| `modifiers: []` never used | `survival-store.ts` |
| `slotsUsed` legacy | store / docs |
| Active Items “Coming soon” | `active-items-panel.tsx` |
| Spark reroll UI missing | `rerollShop`, `rerollMissions` |
| `lastFloorGames` / invested guarantee | **Absent** |
| Hard/nightmare disabled | `difficulty-dialog.tsx` |
| Defeat copy “hit zero” vs code `bankroll < floorMinBet` | `survival-defeat-modal.tsx` vs `use-game-bankroll.ts` |
| `AI_HANDSHAKE.md` survival locks outdated | docs |
| Step 13 lobby flag comment | `balance.ts` |

---

## 10. RAW VALUE TABLE

| Entity | Type | Value | Unit | Notes |
|--------|------|-------|------|-------|
| STARTING_BANKROLL | Constant | 1000 | chips | Run start |
| STARTING_SPARKS | Constant | 15 | sparks | Run start; resets each run |
| STARTING_REROLL_TICKETS | Constant | 3 | tickets | Inventory |
| REROLL_TICKETS_PER_FLOOR | Constant | 3 | tickets | On floor advance |
| MAX_FLOORS | Constant | 10 | floors | Standard run |
| FLOOR_BET_LIMIT | Constant | 10 | bets/floor | Floor ends here |
| GAMES_PER_FLOOR | Constant | 6 | games | Lobby offerings |
| SURVIVAL_GAME_POOL | Constant | 18 | games | Generator pool |
| GRANT_ALL_UPGRADES | Constant | false | flag | Dev only |
| Quota formula | Formula | 2000×500^((f−1)/9) | chips | × difficulty quota mult |
| Quota floor 1 normal | Quota | 2000 | chips | |
| Quota floor 10 normal | Quota | 1000000 | chips | |
| DIFFICULTY_QUOTA_MULT normal | Constant | 1.0 | × | |
| DIFFICULTY_QUOTA_MULT hard | Constant | 1.5 | × | UI disabled |
| DIFFICULTY_QUOTA_MULT nightmare | Constant | 2.5 | × | UI disabled |
| DIFFICULTY_SHOP_PRICE_MULT normal | Constant | 1.0 | × | |
| DIFFICULTY_SHOP_PRICE_MULT hard | Constant | 1.5 | × | |
| DIFFICULTY_SHOP_PRICE_MULT nightmare | Constant | 2.0 | × | |
| Floor min bet 1 | Constant | 20 | chips | |
| Floor min bet 10 | Constant | 10000 | chips | |
| Endless min bet scaling | Formula | ×1.5/floor | chips | From floor 11 |
| sparkFloorMult | Formula | 1+(f−1)×0.2 | × | Floor 1→10: 1.0→2.8 |
| Floor sparks base floor 1 | Reward | 10 | sparks | At quota |
| Floor sparks base floor 10 | Reward | 78 | sparks | At quota |
| Over-quota spark bonus | Formula | min(5,⌊(bank−quota)/500⌋) | sparks | |
| SHOP_REROLL_BASE | Constant | 5 | sparks | Full shop reroll |
| SHOP_REROLL_STEP | Constant | 4 | sparks | Per prior reroll |
| MISSION_REROLL_BASE | Constant | 4 | sparks | |
| MISSION_REROLL_STEP | Constant | 3 | sparks | |
| Lobby Reroll Ticket | Item | 8 | sparks | Base price |
| MAX_UPGRADE_LEVEL | Constant | 5 | levels | |
| levelCost formula | Formula | base×(1+0.5×(L−1)) | sparks | Rounded |
| GAME_PAYOUT_MULT L1–L5 | Upgrade | 1.05/1.12/1.20/1.30/1.40 | × win | All game boosts |
| RUN_PAYOUT_MULT L1–L5 | Upgrade | 1.05/1.10/1.15/1.20/1.25 | × win | Lucky Charm |
| OPENING_TICKET_CAP L1–L5 | Upgrade | 10/12/16/22/30 | × min bet | Free first bet cap |
| Game boost base cost | Upgrade | 14 | sparks | Per game |
| Lucky Charm base | Upgrade | 12 | sparks | |
| Opening Ticket base | Upgrade | 20 | sparks | |
| PROC_PERK_BASE | Constant | 0.30 | chance | Most proc perks |
| PROC_LEVEL_BONUS | Constant | 0.1125 | chance/level | |
| PROC_MAX_CHANCE | Constant | 0.75 | chance | Cap |
| COIN_BIAS L1–L5 | Perk | 58/63/67/71/75 | % win | |
| CRASH_ZONE_PAD L1–L5 | Perk | 8/7/6/5/4 | % band | |
| MISSIONS_PER_FLOOR | Constant | 3 | missions | |
| Mission win_streak 2 base | Mission | 4 | sparks | Scales with floor |
| Mission flawless base | Mission | 8 | sparks | |
| Blackjack win | Game | 2 | × payout | |
| Blackjack natural | Game | 2.5 | × payout | |
| Blackjack push | Game | 1 | × payout | |
| Crash GROWTH_RATE | Game | 0.23 | /sec | |
| Crash MIN_CRASH | Game | 1.05 | × | |
| Crash MAX_CRASH | Game | 30 | × | |
| Plinko ROWS | Game | 12 | rows | |
| Plinko medium slot mults | Game | 8,5,3,1.5,1,0.8,0.5,0.8,1,1.5,3,5,8 | × | |
| Plinko medium RTP | Game | ~0.955 | × EV | Engine comment |
| Over-under RTP factor | Game | 0.92 | × | In mult formula |
| Over-under safe default | Game | 40 | % | Slider 10–90 |
| Wheel red slots | Game | 6/12 | count | 50% win |
| Wheel mults | Game | 2/3/4/5 | × | red/blue/green/gold |
| Run dice RTP factor | Game | 0.92 | × | |
| Run dice neutral max rolls | Game | 3 | rolls | |
| Mines grid | Game | 25 | tiles | |
| Mines easy/medium/hard/insane | Game | 3/7/13/20 | mines | |
| Chicken road steps | Game | 10 | steps | |
| Chicken road max mult | Game | 40 | × | |
| Slots 3×seven | Game | 50 | × | |
| Slots base RTP | Game | ~1.048 | × EV | Enumerated |
| Roulette straight | Game | 36 | × | |
| Roulette red/black | Game | 2 | × | |
| Dragon tower rows | Game | 5 | rows | |
| Dragon tower mults | Game | 1.40,1.96,2.74,3.84,5.38 | × | |
| Chicken race win chance | Game | 25 | % | |
| Chicken race payout | Game | 3.60 | × | |
| Street cups win | Game | 2 | × | |
| Case tier EV | Game | ~0.94 | × | Per case open |
| Case price mults | Game | 1,5,10,50,100 | × min bet | |
| Poker royal flush | Game | 800 | × | |
| Poker jacks+ | Game | 1 | × | |
| HiLo streak mult | Game | 2×1.5^(s−1) | × | |
| HiLo Hot Streak proc | Perk | 25 | % | Extra bump |
| Keno board/draw | Game | 25/5 | numbers | |
| Keno hit mult 5 | Game | 10 | × | |
| Coin flip streak | Game | 2^streak | × | |
| Shop slots | Constant | 4 | slots | 2 game, 1 run, 1 active |
| Shop game offers | Constant | 2 | slots | |
| Freeplay bankroll | Constant | 10000 | chips | |
| Freeplay bust threshold | Constant | ≤10 | chips | markBust |
| Bust survival trigger | Rule | bankroll < floorMinBet | chips | After resolve |
| Cursed/blessed | Dev | navbar | flag | Not production |
