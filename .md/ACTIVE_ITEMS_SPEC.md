# Active Items — Design Spec

> Survival mode consumable system. Fully designed, not yet implemented in the
> repo. This version supersedes the original design — Time Freeze, Last Resort,
> Adrenaline, and Dead Man's Hand have been reworked since the survival floor
> system moved from a timer to a fixed bet count (`FLOOR_BET_LIMIT`).

---

## 1. Overview

Active items are a third shop item category, alongside **upgrades** (passive,
permanent) and **perks** (passive, proc-based). Active items are purchased from
the shop like upgrades, but sit in inventory as consumables the player manually
triggers during a floor, then are used up.

**Cost formula (all items, all levels):**
```
round(baseCost × (1 + (level − 1) × 0.5))
```

**Shop structure:** 2 game-specific slots + 1 run-wide slot + 1 active item slot
per shop refresh (`SHOP_GAME_OFFER_COUNT = 2`, `SHOP_RUN_OFFER_COUNT = 1`,
`SHOP_ACTIVE_OFFER_COUNT = 1` in `lib/survival/shop-offers.ts`), each
independently rerollable for sparks. Originally designed with 2 active slots;
the repo's current shop-offers scaffolding only reserves 1 active slot, so this
spec follows that.

---

## 2. The 9 items

| Item | Effect per level (L1→L5) | Notes |
|---|---|---|
| **Safety Net** | Refund 80% / 85% / 90% / 95% / 100% of next lost bet | Consumed on loss |
| **Double Up** | Next win profit boosted +50% / +75% / +100% / +125% / +150% | L3 literally doubles profit |
| **Hot Hand** | 3 rounds+10% / 3+15% / 4+20% / 5+25% / 6+30% payout boost | Both round count and % scale |
| **Extra Innings** *(reworked from Time Freeze)* | +1 / +2 / +3 / +4 / +5 bonus bets this floor | Linear scaling. Replaces timer-pause since floors are now bet-limited, not time-limited |
| **Spark Cache** | Earn 14 / 22 / 32 / 44 / 58 sparks at floor end | ROI 175%→242%, best bought early |
| **Last Resort** | On bust: revive at quota/5 → quota/3 bankroll + 1→5 bonus bets (linear) | One use per **run**, not per floor |
| **Floor Boost** | All payouts +8% / +12% / +16% / +20% / +25% for entire floor | Stacks multiplicatively with Lucky Charm |
| **Adrenaline** *(reworked)* | Live payout multiplier growing as bets remaining in the floor shrink, maxing 30%→100% near the last bet | Was time-driven, now bet-count-driven |
| **Dead Man's Hand** *(reworked)* | Live loss-refund growing as bets remaining shrink, maxing 20%→70% near the last bet | Was time-driven, now bet-count-driven |

### Last Resort — full level table

| Level | Revive bankroll | Bonus bets |
|---|---|---|
| L1 | quota/5 | +1 |
| L2 | quota/4.5 | +2 |
| L3 | quota/4 | +3 |
| L4 | quota/3.5 | +4 |
| L5 | quota/3 | +5 |

### Design history
Streak Charge (next 20 bets +8%→+25% payout) was originally proposed as a 9th
item, then dropped for being redundant with Floor Boost and Hot Hand. Adrenaline
and Dead Man's Hand were introduced as its replacements — live-computed,
pressure-building effects tied to floor progress rather than a flat multi-bet
window.

---

## 3. Architecture

### Item category
Add `'active'` as a category type in `store/types.ts`, alongside existing
`'upgrade'` and `'perk'` categories.

### Inventory
Each purchased active item creates an instance:
```ts
type ActiveItemInstance = {
  id: ActiveItemId
  level: number       // 1–5
  consumed: boolean   // true after activation
}
```
The `inventory` field already exists on the survival store.

### Activation
`activateItem(itemId)` in `survival-store.ts`:
- Checks the item exists in inventory and is not consumed.
- Applies its effect via a distinct handler per item.
- Marks it `consumed: true`. Consumed items stay visible (greyed out) until the
  floor ends, then are cleared from inventory.

### UI
Each unconsumed active item needs a visible activation button/trigger during
gameplay (survival mode only — active items don't exist in freeplay or puzzle
modes at this time).

---

## 4. Resolution order

**Win:**
1. `finalPayout = basePayout`
2. `× luckyCharmMult`
3. `× gameBoostMult`
4. `× floorBoostMult`
5. `× hotHandMult` (if `hotHandActive && roundsLeft > 0`)
6. `× adrenalineMultiplier` — live: `1 + maxBonus × (1 - betsRemaining / FLOOR_BET_LIMIT)`
7. `profit = finalPayout - betAmount`
8. if `doubleUpActive`: `profit × doubleUpMult`; `finalPayout = betAmount + adjustedProfit`

**Loss:**
1. `bankroll -= betAmount`
2. if `safetyNetActive`: `refund = betAmount × snRefundPct`; `bankroll += refund`; consume
3. if `deadMansHandActive`: `refund = (betAmount - safetyNetRefund) × dmhPct` — live: `dmhPct = maxReduction × (1 - betsRemaining / FLOOR_BET_LIMIT)`; `bankroll += refund`

---

## 5. State fields

**Floor-scoped** (reset on `advanceFloor`):
```
safetyNetActive, safetyNetRefundPct
doubleUpActive, doubleUpMult
hotHandActive, hotHandRoundsLeft, hotHandBoost
floorBoostActive, floorBoostMult
adrenalineActive, adrenalineMaxBonus
deadMansHandActive, deadMansHandMaxReduction
sparkCacheBonus
extraInningsBonusBets
```

**Run-scoped** (persists across floors):
```
runLastResortUsed
```

---

## 6. Not yet implemented

This entire system exists only as a design spec — no code in the current repo
references active items (a grep for "active item" / item names only turns up an
unrelated perk called "Hot Hand" in Run Dice's game-specific perk track, which
is a naming coincidence, not this system).
