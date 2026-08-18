# Floored — Balance Mega Prompt

You are implementing balance changes to the Floored casino roguelike across three areas: base game EVs, upgrade mechanics, and mission pool. Read the existing source files before touching anything. Make only the changes described. Do not modify any unrelated constants, UI layout, animation code, or game logic outside what is specified.

---

# PART A — Base Game EV Changes

## A1 — Crash: replace crash point distribution formula

**File:** crash game engine (likely `games/crash/` or `lib/games/crash`).

**Find:** the line generating `crashAt` using `Math.pow(Math.random(), ...)` with a min/max range.

**Replace:**
```ts
// BEFORE
const crashAt = MIN_CRASH + (MAX_CRASH - MIN_CRASH) * Math.pow(Math.random(), 2.5);

// AFTER
const HOUSE_EDGE = 0.95;
const u = Math.random();
const crashAt = Math.min(MAX_CRASH, HOUSE_EDGE / u);
```

- Define `HOUSE_EDGE = 0.95` as a named constant near other crash constants. Not inline.
- Keep `MAX_CRASH` at its existing value.
- `MIN_CRASH` is no longer used in crash point generation. Keep the constant if referenced elsewhere (UI etc.), but remove it from this formula.
- Do not change cashout logic, growth rate, or animation.

**Why:** Old formula gave 1.22–2.75× EV depending on cashout target. New formula gives exactly 0.95× EV at all cashout targets.

**Verify:** `P(crash > 1.5)` ≈ 63% (was ~82%). `P(crash > 2.0)` ≈ 47% (was ~71%).

---

## A2 — Street Cups: increase win payout

**File:** Street Cups game engine (likely `games/street-cups/` or `lib/games/street-cups`).

**Find:** `STREET_CUPS_WIN_MULTIPLIER` or equivalent constant.

**Change:**
```ts
// BEFORE
const STREET_CUPS_WIN_MULTIPLIER = 2;

// AFTER
const STREET_CUPS_WIN_MULTIPLIER = 2.5;
```

- If the multiplier is hardcoded inline, extract to a named constant first.
- Do not touch win probability, cup count, swap count, animation, or perk logic.

**EV after:** base 0.833× (was 0.667×). With Cup Truth perk: 1.25× (was 1.00×).

---

## A3 — Keno: rework hit multiplier table

**File:** Keno game engine (likely `games/keno/` or `lib/games/keno`).

**Find:** hit multiplier array indexed by number of hits (0–5 for 5-pick mode).

**Change:**
```ts
// BEFORE
const HIT_MULTIPLIERS = [0, 0.5, 1, 3, 5, 10];

// AFTER
const HIT_MULTIPLIERS = [0, 0.5, 2, 5, 15, 100];
// [0 hits, 1 hit, 2 hits, 3 hits, 4 hits, 5 hits]
```

- Change only this array. Do not touch board size, draw size, pick logic, Number Heat perk, or UI.
- If multipliers are stored as a map or object keyed by hit count, apply the same values.

**EV after:** 0.868× (was 0.559×). EV breakdown:
| Hits | P | Mult | Contribution |
|------|---|------|-------------|
| 0 | 29.2% | 0× | 0 |
| 1 | 45.6% | 0.5× | 0.228 |
| 2 | 21.5% | 2× | 0.430 |
| 3 | 3.58% | 5× | 0.179 |
| 4 | 0.19% | 15× | 0.028 |
| 5 | 0.003% | 100× | 0.003 |
| **Total** | | | **0.868×** |

---

# PART B — Upgrade Balance Changes

## B1 — Crash Zone perk: full redesign

**File:** Crash Zone perk implementation in crash engine or perk resolution code.

**Old behavior:** showed a visual ±% band around crash point. **Remove this entirely.**

**New behavior:** early crash protection — if crash occurs below a per-level threshold and the player has not yet cashed out, the round is a push (bet refunded, no profit, no loss).

**New constant:**
```ts
const CRASH_ZONE_THRESHOLD_BY_LEVEL = [0, 1.00, 1.05, 1.10, 1.20, 1.30];
// index 0 unused; index = perk level (1–5)
```

**Resolution logic:**
```ts
if (!playerCashedOut && crashAt < CRASH_ZONE_THRESHOLD_BY_LEVEL[perkLevel]) {
  outcome = 'push'; // return bet in full, no profit
}
```

**Level reference:**
| Level | Threshold | P(push) | EV |
|-------|-----------|---------|-----|
| L1 | 1.00× | 5.0% | 1.00× |
| L2 | 1.05× | 9.5% | 1.05× |
| L3 | 1.10× | 13.6% | 1.09× |
| L4 | 1.20× | 20.8% | 1.16× |
| L5 | 1.30× | 26.9% | 1.22× |

**Rules:**
- Push only fires if player has NOT cashed out. Successful cashouts are unaffected.
- Push only fires if crash is BELOW threshold. At-or-above threshold with no cashout = normal loss.
- Push interacts with survival bet recording identically to other pushes in the codebase.
- Remove any existing crash-point band or preview UI from the old perk.
- Update tooltip text. Example for L5: `"Crashes below 1.30× refund your bet."`

---

## B2 — Payout multiplier stack cap

**File:** wherever game boost and run boost are combined into a final payout multiplier (likely `computePayoutMultiplier` in `lib/survival/` or the bet resolution path).

**Change:**
```ts
// BEFORE
const payoutMult = gameBoostMult * runBoostMult;

// AFTER
const RAW_PAYOUT_MULT_CAP = 1.50;
const payoutMult = Math.min(RAW_PAYOUT_MULT_CAP, gameBoostMult * runBoostMult);
```

- Define `RAW_PAYOUT_MULT_CAP = 1.50` as a named constant in `balance.ts` or alongside other balance constants.
- Applies to all games uniformly. Do not special-case any game.
- Do not change how boosts or charms are stored, purchased, or displayed.

**Impact:**
| Combo | Raw | Applied |
|-------|-----|---------|
| Boost L3 + Charm L3 | 1.38× | 1.38× (no change) |
| Boost L4 + Charm L4 | 1.56× | 1.50× (capped) |
| Boost L5 + Charm L5 | 1.75× | 1.50× (capped) |
| Boost L5 only | 1.40× | 1.40× (no change) |
| Charm L5 only | 1.25× | 1.25× (no change) |

---

## B3 — Hole Card Reader perk: add level scaling

**File:** Hole Card Reader perk in Blackjack engine or perk resolution code.

**Current behavior:** reveal dealer hole card — identical at all 5 levels. Add cumulative effects per level:

| Level | Effect (cumulative — each level includes all prior) |
|-------|------------------------------------------------------|
| L1 | Reveal dealer hole card after player's first two cards are dealt, before hit/stand (existing behavior) |
| L2 | Hole card also revealed BEFORE the player places their bet — player sees dealer hole card during betting phase |
| L3 | If dealer has blackjack, player's bet is refunded (push) instead of a loss |
| L4 | Double down allowed on any hand including 3+ cards (removes 2-card restriction) |
| L5 | Natural blackjack pays 3× instead of 2.5× |

**Implementation:**
- L2: trigger hole card reveal at start of betting phase when `perkLevel >= 2`.
- L3: after dealer resolves, if `dealerHasBlackjack && !playerHasBlackjack && perkLevel >= 3` → override to push, return bet.
- L4: where double down checks `hand.length === 2`, change to `hand.length === 2 || perkLevel >= 4`.
- L5: when `perkLevel >= 5`, use `3.0` as blackjack payout multiplier for that round instead of `BLACKJACK_PAYOUT`. Do not permanently change the constant.
- Update tooltip per level. L5 example: `"See hole card before betting. Dealer blackjack refunds bet. Double down anytime. Blackjack pays 3×."`

---

## B4 — Weighted Edge perk: nerf win bias

**File:** Coin Flip game engine or perk constants — find `COIN_BIAS_CHANCE_BY_LEVEL`.

**Change:**
```ts
// BEFORE
const COIN_BIAS_CHANCE_BY_LEVEL = [0, 0.58, 0.63, 0.67, 0.71, 0.75];

// AFTER
const COIN_BIAS_CHANCE_BY_LEVEL = [0, 0.54, 0.57, 0.60, 0.63, 0.65];
// index 0 unused; index = perk level (1–5)
```

- Change only this constant. Do not change streak multiplier (2^streak), cashout logic, or animation.
- If bias is inlined rather than a named constant, extract it first.

**EV impact (1-win cashout):**
| Level | Old bias | Old EV | New bias | New EV |
|-------|----------|--------|----------|--------|
| L1 | 58% | 1.16× | 54% | 1.08× |
| L2 | 63% | 1.26× | 57% | 1.14× |
| L3 | 67% | 1.34× | 60% | 1.20× |
| L4 | 71% | 1.42× | 63% | 1.26× |
| L5 | 75% | 1.50× | 65% | 1.30× |

---

# PART C — Mission Pool Changes

## C1 — Remove big_win 30× variant

**File:** mission template pool (likely `lib/survival/missions.ts` or `mission-generator.ts`).

**Find:** the `big_win` mission template with target `30` (i.e. "win 30× min bet in one round net profit").

**Remove this entry entirely** from the mission pool array/object. Keep the `big_win` template with target `10` — only the `30×` variant is removed.

**Result:** the `big_win` mission type still exists in the pool but only with the `10×` target variant. The overall mission pool goes from 7 types to effectively the same 7 types with one fewer variant under `big_win`.

- Do not change reward values, scaling formula, or evaluator logic for `big_win`.
- Do not remove or alter any other mission types or variants.

---

## C2 — Flawless mission: gate generation by floor game composition

**Context:** The flawless mission ("no losses this floor") is nearly impossible when the floor contains high-variance games with hard 0× loss outcomes (crash, mines, chicken-road, dragon-tower, chicken-race, keno, street-cups). It should only generate on floors where enough low-variance games are available.

**File:** mission generator (wherever floor missions are generated, likely `lib/survival/mission-generator.ts` or similar).

**Define two sets:**

```ts
const HIGH_VARIANCE_GAME_IDS = [
  'crash', 'mines', 'chicken-road', 'dragon-tower',
  'chicken-race', 'keno', 'street-cups'
];

const LOW_VARIANCE_GAME_IDS = [
  'blackjack', 'roulette', 'plinko', 'over-under',
  'run-dice', 'wheel', 'slots', 'hilo', 'coin-flip',
  'poker-1p', 'case-battles'
];
```

**Gating rule:** when generating missions for a floor, count how many of the 6 offered games are in `LOW_VARIANCE_GAME_IDS`. Only allow the `flawless` mission to be generated if `lowVarianceCount >= 3`.

```ts
const lowVarianceCount = floorGames.filter(g => LOW_VARIANCE_GAME_IDS.includes(g.id)).length;
const flawlessAllowed = lowVarianceCount >= 3;
// when building the candidate mission pool for this floor:
// if (!flawlessAllowed) exclude 'flawless' from candidates
```

- If the flawless mission was already rolled and needs to be re-rolled due to this gate, treat it the same as any other excluded mission type — pick a different type from the remaining pool.
- Do not change flawless evaluation logic, reward values, or scaling formula.

**Evaluator confirmed — no change needed:** the flawless evaluator already uses `outcome === 'loss'` as the failure condition. Pushes are neutral and do not break flawless. Only apply the generation gate above — do not touch `mission-evaluator.ts`.

---

# PART D — Mission Variant Rework

## D1 — Expand minBet multiple system across all mission types

**Context:** Currently all missions use a flat `minBet` equal to the floor minimum bet (1×). Each mission variant now carries its own `minBetMult` — a multiplier on the floor min bet that the player's wager must meet or exceed for that bet to count toward the mission. This makes bet sizing a real decision and rewards risk-taking with better spark payouts.

**How `minBet` is computed at generation time:**
```ts
// When generating a mission variant, store the absolute minBet:
mission.minBet = floorMinBet * variant.minBetMult;
// The evaluator already reads mission.minBet — no evaluator changes needed.
```

**Reward formula** — replace the current base reward per type with per-variant base rewards, then apply the existing floor scaling on top:
```ts
// Existing floor scalar already handles floor-based reward growth.
// Only the base reward changes per variant (see tables below).
// Keep: reward = max(1, floor(base × (1 + (floor−1) × 0.1) × diffMult))
```

---

## D2 — Full variant table (replace existing mission template pool entirely)

**File:** mission template pool (likely `lib/survival/missions.ts` or `mission-generator.ts`).

Replace the existing variants with the following complete set. Each row is one entry in the pool.

### win_streak (10 variants)
| target | minBetMult | baseReward |
|--------|-----------|------------|
| 2 | 1× | 4 |
| 2 | 2× | 5 |
| 2 | 5× | 8 |
| 3 | 1× | 6 |
| 3 | 2× | 7 |
| 3 | 5× | 10 |
| 4 | 1× | 8 |
| 4 | 2× | 9 |
| 5 | 1× | 10 |
| 5 | 2× | 11 |

### play_game (15 variants)
Assigned to a specific game from the current floor's lobby. `target` = number of times that game must be played at the required bet.

| target | minBetMult | baseReward |
|--------|-----------|------------|
| 1 | 1× | 3 |
| 1 | 2× | 4 |
| 1 | 5× | 7 |
| 1 | 10× | 10 |
| 2 | 1× | 4 |
| 2 | 2× | 5 |
| 2 | 5× | 8 |
| 3 | 1× | 5 |
| 3 | 2× | 6 |
| 3 | 5× | 9 |
| 4 | 1× | 6 |
| 4 | 2× | 7 |
| 4 | 3× | 8 |
| 6 | 1× | 8 |
| 6 | 2× | 9 |

### min_multiplier (6 variants)
| target | minBetMult | baseReward |
|--------|-----------|------------|
| 2 | 1× | 5 |
| 2 | 2× | 6 |
| 2 | 5× | 9 |
| 3 | 1× | 8 |
| 3 | 2× | 9 |
| 3 | 5× | 12 |

### games_played (7 variants)
| target | minBetMult | baseReward |
|--------|-----------|------------|
| 3 | 1× | 3 |
| 3 | 2× | 4 |
| 5 | 1× | 5 |
| 5 | 2× | 6 |
| 5 | 5× | 9 |
| 8 | 1× | 7 |
| 8 | 2× | 8 |

### flawless (3 variants)
| target | minBetMult | baseReward |
|--------|-----------|------------|
| 1 | 1× | 8 |
| 1 | 2× | 9 |
| 1 | 3× | 10 |

### win_count (6 variants)
| target | minBetMult | baseReward |
|--------|-----------|------------|
| 2 | 1× | 4 |
| 2 | 2× | 5 |
| 2 | 5× | 8 |
| 4 | 1× | 6 |
| 4 | 2× | 7 |
| 4 | 5× | 10 |

### big_win (3 variants)
Target = net profit in one round must be ≥ `target × floorMinBet`.

| target | minBetMult | baseReward |
|--------|-----------|------------|
| 10 | 1× | 5 |
| 10 | 2× | 6 |
| 10 | 3× | 7 |

---

## D3 — Generation rules (unchanged except pool size)

- Still generate **3 missions per floor**.
- Still enforce **one variant per type** — no two missions of the same type on the same floor.
- Flawless generation gate from C2 still applies.
- big_win 30× variant has been removed (per C1) — only 10× variants remain.
- Ticket reroll per mission slot: unchanged.
- Floor scaling formula: unchanged — `reward = max(1, floor(base × (1 + (floor−1) × 0.1) × diffMult))`.

---

# Verification

After all changes, confirm in survival mode:

**Part A:**
1. Crash — riding to 1.5× should crash ~37% of the time. Survival to 2× should be ~47%.
2. Street Cups — winning displays 2.5× payout (not 2×).
3. Keno — 2 hits pays 2× (was 1×), 3 hits pays 5× (was 3×), 5 hits pays 100× (was 10×).

**Part B:**
4. Crash Zone L5 — approximately 27% of rounds where player does not cash out before 1.30× should return the bet as a push.
5. Stack cap — Boost L5 + Charm L5 win payout is 1.50× of raw profit, not 1.75×. Boost L5 alone is still 1.40×.
6. Hole Card Reader L3 — dealer blackjack returns bet. L5 — natural blackjack pays 3×.
7. Weighted Edge L5 — coin flip win chance is 65%, not 75%.

**Part C:**
8. big_win mission — only the 10× variant appears. 30× variant never generates.
9. Flawless mission — does not generate on floors dominated by crash/mines/chicken-road/dragon-tower.

**Part D:**
10. Mission variants — confirm a play_game mission can appear with target > 1 (e.g. "Play Blackjack 3 times"). Confirm a win_streak mission can appear requiring bets ≥ 5× floor min bet. Confirm reward values match the tables above before floor scaling is applied.

---

# PART E — Spark Economy Changes

## E1 — Starting sparks: 15 → 20

**File:** `lib/survival/balance.ts` (or wherever `STARTING_SPARKS` is defined).

**Change:**
```ts
// BEFORE
const STARTING_SPARKS = 15;

// AFTER
const STARTING_SPARKS = 20;
```

- Change only this constant. Do not touch starting bankroll, starting reroll tickets, or any other starting state.

---

## E2 — Over-quota spark bonus: rework formula

**File:** wherever `calcFloorSparksEarned` (or equivalent) computes the over-quota bonus — likely `lib/survival/balance.ts` or `lib/survival/spark-utils.ts`.

**Current logic:**
```ts
const overQuotaBonus = Math.min(5, Math.floor((bankroll - quotaTarget) / 500));
```

**Replace with:**
```ts
const OVER_QUOTA_SPARK_MAX = 10;
const overQuotaBonus = bankroll <= quotaTarget
  ? 0
  : Math.min(OVER_QUOTA_SPARK_MAX, Math.floor((bankroll - quotaTarget) / (quotaTarget * 0.01)));
```

- Define `OVER_QUOTA_SPARK_MAX = 10` as a named constant alongside other balance constants.
- The new formula: +1 spark per 1% of quota exceeded, capped at 10 sparks.
- Do not change base spark formula, floor multiplier, or mission reward calculation.

**Resulting scale:**
| Floor | Quota | +1 spark per | Max bonus (10sp) requires |
|-------|-------|-------------|--------------------------|
| 1 | $2,000 | $20 over | $200 over quota |
| 5 | $31,664 | $317 over | $3,170 over quota |
| 10 | $1,000,000 | $10,000 over | $100,000 over quota |

---

## E3 — Reroll tickets per floor advance: 3 → 2

**File:** `lib/survival/balance.ts` (or wherever `REROLL_TICKETS_PER_FLOOR` is defined).

**Change:**
```ts
// BEFORE
const REROLL_TICKETS_PER_FLOOR = 3;

// AFTER
const REROLL_TICKETS_PER_FLOOR = 2;
```

- Keep `STARTING_REROLL_TICKETS = 3` unchanged — players still start with 3.
- Total free tickets across a 10-floor run: 3 start + (9 advances × 2) = **21 tickets** (was 30).
- Do not change ticket purchase cost (8 sparks base) or reroll logic.

---

# Verification

After all changes, confirm in survival mode:

**Part A:**
1. Crash — riding to 1.5× should crash ~37% of the time. Survival to 2× should be ~47%.
2. Street Cups — winning displays 2.5× payout (not 2×).
3. Keno — 2 hits pays 2× (was 1×), 3 hits pays 5× (was 3×), 5 hits pays 100× (was 10×).

**Part B:**
4. Crash Zone L5 — approximately 27% of rounds where player does not cash out before 1.30× should return the bet as a push.
5. Stack cap — Boost L5 + Charm L5 win payout is 1.50× of raw profit, not 1.75×. Boost L5 alone is still 1.40×.
6. Hole Card Reader L3 — dealer blackjack returns bet. L5 — natural blackjack pays 3×.
7. Weighted Edge L5 — coin flip win chance is 65%, not 75%.

**Part C:**
8. big_win mission — only the 10× variant appears. 30× variant never generates.
9. Flawless mission — does not generate on floors dominated by crash/mines/chicken-road/dragon-tower.

**Part D:**
10. Mission variants — confirm a play_game mission can appear with target > 1 (e.g. "Play Blackjack 3 times"). Confirm a win_streak mission can appear requiring bets ≥ 5× floor min bet. Confirm reward values match the tables above before floor scaling is applied.

**Part E:**
11. Starting sparks — new run begins with 20 sparks (not 15). Confirm in run initialisation.
12. Over-quota bonus — on a floor where bankroll exceeds quota by exactly 1%, player receives +1 spark bonus. Exceeding by 10%+ gives +10 sparks (cap).
13. Reroll tickets — floor advance grants 2 tickets (not 3). Starting tickets remain 3.

Do not touch any other files.
