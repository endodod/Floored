import type { CaseBattleState, CaseDef, CaseItem, CaseRarity, OpenedCase } from './types'

export const CASE_MULTIPLIERS = [1, 5, 10, 50, 100] as const

// Item value ratios relative to case price (same across all cases → uniform EV ~0.94×)
const ITEM_TIERS: Array<{ ratio: number; rarity: CaseRarity; weight: number }> = [
  { ratio: 0.2, rarity: 'common',    weight: 30 },
  { ratio: 0.6, rarity: 'common',    weight: 28 },
  { ratio: 1.0, rarity: 'uncommon',  weight: 22 },
  { ratio: 1.6, rarity: 'rare',      weight: 12 },
  { ratio: 3.0, rarity: 'epic',      weight: 6  },
  { ratio: 6.0, rarity: 'legendary', weight: 2  },
]

const CASE_TEMPLATES = [
  {
    name: 'Bronze Case', emoji: '📦', colorHex: '#b45309',
    items: [
      { name: 'Worn Glove',   icon: '🧤' },
      { name: 'Cracked Lens', icon: '🔭' },
      { name: 'Steel Pipe',   icon: '🔧' },
      { name: 'Hunter Coat',  icon: '🧥' },
      { name: 'Shadow Fang',  icon: '🗡️'  },
      { name: 'Cursed Relic', icon: '💀' },
    ],
  },
  {
    name: 'Silver Case', emoji: '🗃️', colorHex: '#71717a',
    items: [
      { name: 'Frayed Rope',   icon: '🪢' },
      { name: 'Basic Grenade', icon: '💥' },
      { name: 'Combat Knife',  icon: '🔪' },
      { name: 'Tactical Vest', icon: '🦺' },
      { name: 'Elite Scope',   icon: '🎯' },
      { name: 'Phantom Blade', icon: '⚔️'  },
    ],
  },
  {
    name: 'Gold Case', emoji: '💼', colorHex: '#ca8a04',
    items: [
      { name: 'Iron Shield',     icon: '🛡️'  },
      { name: 'Precision Rifle', icon: '🔫' },
      { name: 'Battle Armor',    icon: '🪖' },
      { name: "Dragon's Eye",    icon: '👁️'  },
      { name: 'Void Cannon',     icon: '💣' },
      { name: 'Mythic Greaves',  icon: '👟' },
    ],
  },
  {
    name: 'Diamond Case', emoji: '💎', colorHex: '#22d3ee',
    items: [
      { name: 'Dark Crystal',  icon: '🔷' },
      { name: 'Inferno Blade', icon: '🔥' },
      { name: 'War Machine',   icon: '⚙️'  },
      { name: 'Thunder Fist',  icon: '⚡' },
      { name: 'Cosmic Dagger', icon: '🌙' },
      { name: 'Eternal Aegis', icon: '🌀' },
    ],
  },
  {
    name: 'Crown Case', emoji: '👑', colorHex: '#a855f7',
    items: [
      { name: 'Storm Rune',    icon: '🔮' },
      { name: 'Chaos Engine',  icon: '🌪️'  },
      { name: 'Celestial Bow', icon: '🏹' },
      { name: "God's Anvil",   icon: '⚒️'  },
      { name: 'Reality Shard', icon: '💫' },
      { name: 'Omega Crown',   icon: '👑' },
    ],
  },
]

/** Relative case prices in the ladder, where one of each case is opened for the whole pot. */
const LADDER_CASE_WEIGHTS = [1, 2, 3, 4, 5] as const

export function getCases(minBet: number): CaseDef[] {
  return buildCases(CASE_TEMPLATES.map((_, idx) => Math.round(minBet * CASE_MULTIPLIERS[idx]!)))
}

/** One of each case, priced by `LADDER_CASE_WEIGHTS` so the five together cost exactly `pot`. */
export function getLadderCases(pot: number): CaseDef[] {
  const totalWeight = LADDER_CASE_WEIGHTS.reduce((s, w) => s + w, 0)
  const prices = LADDER_CASE_WEIGHTS.map((w) => Math.max(1, Math.floor((pot * w) / totalWeight)))
  // Rounding remainder goes to the top case.
  prices[prices.length - 1]! += pot - prices.reduce((s, p) => s + p, 0)
  return buildCases(prices)
}

function buildCases(prices: number[]): CaseDef[] {
  return CASE_TEMPLATES.map((tpl, idx) => {
    const price = prices[idx]!
    return {
      id: idx,
      name: tpl.name,
      price,
      emoji: tpl.emoji,
      colorHex: tpl.colorHex,
      items: tpl.items.map((item, tierIdx) => {
        const tier = ITEM_TIERS[tierIdx]!
        return {
          item: {
            name: item.name,
            icon: item.icon,
            value: Math.max(1, Math.round(price * tier.ratio)),
            rarity: tier.rarity,
          },
          weight: tier.weight,
        }
      }),
    }
  })
}

function rollItem(caseDef: CaseDef): CaseItem {
  const total = caseDef.items.reduce((s, e) => s + e.weight, 0)
  let r = Math.random() * total
  for (const entry of caseDef.items) {
    r -= entry.weight
    if (r <= 0) return entry.item
  }
  return caseDef.items[caseDef.items.length - 1]!.item
}

export function initCaseBattle(): CaseBattleState {
  return {
    stage: 'setup',
    selectedCases: [],
    totalCost: 0,
    userItems: [],
    botItems: [],
    userTotal: 0,
    botTotal: 0,
    outcome: null,
    message: 'Select up to 5 cases to battle.',
  }
}

function computeCost(ids: number[], cases: CaseDef[]): number {
  return ids.reduce((s, id) => s + (cases[id]?.price ?? 0), 0)
}

export function addCase(state: CaseBattleState, caseId: number, cases: CaseDef[]): CaseBattleState {
  if (state.selectedCases.length >= 5) return state
  const next = [...state.selectedCases, caseId]
  return { ...state, selectedCases: next, totalCost: computeCost(next, cases) }
}

export function removeCase(state: CaseBattleState, caseId: number, cases: CaseDef[]): CaseBattleState {
  const idx = state.selectedCases.lastIndexOf(caseId)
  if (idx === -1) return state
  const next = [...state.selectedCases]
  next.splice(idx, 1)
  return { ...state, selectedCases: next, totalCost: computeCost(next, cases) }
}

export function startBattle(state: CaseBattleState, cases: CaseDef[]): CaseBattleState {
  if (state.selectedCases.length === 0) return state

  const userItems: OpenedCase[] = state.selectedCases.map(caseId => ({
    caseId,
    item: rollItem(cases[caseId]!),
  }))
  const botItems: OpenedCase[] = state.selectedCases.map(caseId => ({
    caseId,
    item: rollItem(cases[caseId]!),
  }))

  return {
    ...state,
    stage: 'opening',
    userItems,
    botItems,
    userTotal: 0,
    botTotal: 0,
    outcome: null,
    message: 'Opening cases…',
  }
}

function rollItemFromTiers(caseDef: CaseDef, tierIndices: number[]): CaseItem {
  const pool = tierIndices
    .map((i) => caseDef.items[i])
    .filter((e): e is { item: CaseItem; weight: number } => e != null)
  if (pool.length === 0) return caseDef.items[0]!.item
  const total = pool.reduce((s, e) => s + e.weight, 0)
  let r = Math.random() * total
  for (const entry of pool) {
    r -= entry.weight
    if (r <= 0) return entry.item
  }
  return pool[pool.length - 1]!.item
}

/**
 * Cursed battle: player draws from common tiers (0.2× / 0.6×), bot draws
 * from rare/epic/legendary (1.6× / 3.0× / 6.0×). Bot's worst beats
 * player's best, so the loss is guaranteed with natural-looking rolls.
 */
export function loseGame(state: CaseBattleState, cases: CaseDef[]): CaseBattleState {
  if (state.selectedCases.length === 0) return state
  const userItems: OpenedCase[] = state.selectedCases.map((caseId) => ({
    caseId,
    item: rollItemFromTiers(cases[caseId]!, [0, 1]),
  }))
  const botItems: OpenedCase[] = state.selectedCases.map((caseId) => ({
    caseId,
    item: rollItemFromTiers(cases[caseId]!, [3, 4, 5]),
  }))
  return {
    ...state,
    stage: 'opening',
    userItems,
    botItems,
    userTotal: 0,
    botTotal: 0,
    outcome: null,
    message: 'Opening cases…',
  }
}

/**
 * Blessed battle: player draws from rare/epic/legendary tiers (1.6× / 3.0× / 6.0×),
 * bot draws from common tiers (0.2× / 0.6×). Player always wins by a wide margin.
 */
export function winGame(state: CaseBattleState, cases: CaseDef[]): CaseBattleState {
  if (state.selectedCases.length === 0) return state
  const userItems: OpenedCase[] = state.selectedCases.map((caseId) => ({
    caseId,
    item: rollItemFromTiers(cases[caseId]!, [3, 4, 5]),
  }))
  const botItems: OpenedCase[] = state.selectedCases.map((caseId) => ({
    caseId,
    item: rollItemFromTiers(cases[caseId]!, [0, 1]),
  }))
  return {
    ...state,
    stage: 'opening',
    userItems,
    botItems,
    userTotal: 0,
    botTotal: 0,
    outcome: null,
    message: 'Opening cases…',
  }
}

export function rerollUserItem(state: CaseBattleState, slotIndex: number, cases: CaseDef[]): CaseBattleState {
  if (slotIndex < 0 || slotIndex >= state.userItems.length) return state
  const oc = state.userItems[slotIndex]!
  const userItems = [...state.userItems]
  userItems[slotIndex] = { ...oc, item: rollItem(cases[oc.caseId]!) }
  return { ...state, userItems }
}

export function settleBattle(state: CaseBattleState): CaseBattleState {
  const userTotal = state.userItems.reduce((s, oc) => s + oc.item.value, 0)
  const botTotal  = state.botItems.reduce((s, oc) => s + oc.item.value, 0)
  const isTie     = userTotal === botTotal
  const userWon   = userTotal > botTotal

  return {
    ...state,
    stage: 'settled',
    userTotal,
    botTotal,
    outcome: userWon ? 'win' : isTie ? 'push' : 'loss',
    message: userWon
      ? 'You win! Higher total value!'
      : isTie
        ? 'Tie — bet returned.'
        : 'Bot wins! Better luck next time.',
  }
}
