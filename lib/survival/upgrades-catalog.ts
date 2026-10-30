import { SURVIVAL_GAME_POOL } from './balance'
import { LOBBY_REROLL_TICKET, LOBBY_REROLL_TICKET_ID } from './lobby-ticket'
import { perkProcChancePercent } from './perk-proc'
import {
  COIN_BIAS_CHANCE_BY_LEVEL,
  CRASH_CUSHION_BY_LEVEL,
  GAME_PAYOUT_MULT_BY_LEVEL,
  MAX_UPGRADE_LEVEL,
  OPENING_TICKET_CAP_BY_LEVEL,
  RUN_PAYOUT_MULT_BY_LEVEL,
  levelCost,
  levelRoman,
  normalizeUpgradeId,
  payoutPercentLabel,
} from './upgrade-levels'
import type { GameName, PurchasedUpgrade } from '@/store/types'

export type UpgradeScope = 'run' | 'game' | 'consumable'

export interface CatalogItem {
  id: string
  name: string
  description: string
  baseCost: number
  scope: UpgradeScope
  game?: GameName
  effectKey: string
  rarity?: 'common' | 'rare' | 'epic'
  /** Upgrade track id (e.g. blackjack_perk). */
  familyId?: string
  level?: number
  /** Payout multiplier for boost items (e.g. 1.08 = +8%). */
  payoutMult?: number
}

const GAME_BOOST_LABELS: Record<GameName, { name: string }> = {
  'deck-countdown': { name: 'Card Memory' },
  'tower-of-cards': { name: 'High Card' },
  baccarat: { name: 'Shoe Reader' },
  'sic-bo': { name: 'Hot Dice' },
  'andar-bahar': { name: 'Pile Reader' },
  'dragon-tiger': { name: 'Tiger Eye' },
  blackjack: { name: 'Card Counter' },
  crash: { name: 'Early Cashout' },
  plinko: { name: 'Gravity Bias' },
  'over-under': { name: 'Loaded Dice' },
  wheel: { name: 'Wheel Weight' },
  'run-dice': { name: 'Hot Hand' },
  mines: { name: 'Safe Step' },
  'chicken-road': { name: 'Feathered Path' },
  slots: { name: 'Jackpot Juice' },
  roulette: { name: 'Ball Magnet' },
  'dragon-tower': { name: 'Dragon Sight' },
  'chicken-race': { name: 'Race Analyst' },
  'street-cups': { name: 'Sharp Eyes' },
  'case-battles': { name: 'Case Hunter' },
  'poker-1p': { name: 'Poker Face' },
  hilo: { name: 'Ace Spotter' },
  keno: { name: 'Lucky Grid' },
  'coin-flip': { name: 'Weighted Coin' },
}

const GAME_PERK_DEFS: Record<
  GameName,
  { name: string; description: string; effectKey: string; baseCost: number; rarity: 'rare' | 'epic'; descriptionForLevel?: (level: number) => string }
> = {
  'deck-countdown': { name: 'Burn Card', description: 'The first repeated rank is burned instead of busting.', effectKey: 'perk_deck_burn', baseCost: 22, rarity: 'rare' },
  'tower-of-cards': { name: 'Safety Net', description: 'A wrong call from step two returns the multiplier banked before it.', effectKey: 'perk_tower_net', baseCost: 20, rarity: 'rare' },
  baccarat: { name: 'Shoe Peek', description: 'See the Player’s first card before dealing.', effectKey: 'perk_baccarat_peek', baseCost: 22, rarity: 'epic' },
  'sic-bo': { name: 'Cold Faces', description: 'Two faces that cannot land are crossed out before the roll.', effectKey: 'perk_sic_bo_cold', baseCost: 20, rarity: 'rare' },
  'andar-bahar': { name: 'Side Count', description: 'When active, the pile you choose is favoured to receive the match.', effectKey: 'perk_andar_bahar_count', baseCost: 20, rarity: 'rare' },
  'dragon-tiger': { name: 'Tiger Eye', description: 'See the Dragon card before dealing.', effectKey: 'perk_dragon_tiger_peek', baseCost: 22, rarity: 'epic' },
  blackjack: {
    name: 'Hole Card Reader',
    description: 'See the dealer’s hole card while you play your hand.',
    effectKey: 'perk_peek_dealer',
    baseCost: 24,
    rarity: 'epic',
    descriptionForLevel: (level) => {
      const parts = ['See the dealer hole card after your first two cards are dealt.']
      if (level >= 2) parts.push('Hole card visible before you place your bet.')
      if (level >= 3) parts.push('Dealer blackjack refunds your bet.')
      if (level >= 4) parts.push('Double down anytime.')
      if (level >= 5) parts.push('Blackjack pays 3×.')
      return parts.join(' ')
    },
  },
  hilo: {
    name: 'Hot Streak',
    description: 'Each correct guess has a 25% chance to advance your streak by 2 instead of 1.',
    effectKey: 'perk_hilo_range',
    baseCost: 20,
    rarity: 'rare',
  },
  'chicken-race': {
    name: 'Slow Scout',
    description: 'Cross out one chicken that will not win before the race.',
    effectKey: 'perk_chicken_scout',
    baseCost: 22,
    rarity: 'rare',
  },
  crash: {
    name: 'Crash Cushion',
    description: 'Recovers a portion of your bet when the rocket crashes below 3×.',
    effectKey: 'perk_crash_zone',
    baseCost: 22,
    rarity: 'rare',
    descriptionForLevel: (level) => {
      const pct = Math.round((CRASH_CUSHION_BY_LEVEL[level - 1] ?? 0.25) * 100)
      return `Recover ${pct}% of your bet on a sub-3× crash.`
    },
  },
  mines: {
    name: 'Mine Sweeper',
    description: 'One safe tile is revealed when the round starts.',
    effectKey: 'perk_mines_safe',
    baseCost: 20,
    rarity: 'rare',
  },
  plinko: {
    name: 'Golden Ball',
    description: 'When active, the dropped ball turns golden and pays out 2× its normal payout.',
    effectKey: 'perk_plinko_golden_ball',
    baseCost: 18,
    rarity: 'rare',
  },
  'over-under': {
    name: 'Safe Opening Roll',
    description: 'When active, your first roll cannot lose money (refunded to a push).',
    effectKey: 'perk_over_under_shield',
    baseCost: 16,
    rarity: 'rare',
  },
  wheel: {
    name: 'Color Scout',
    description: 'When active, one losing color is crossed off before you spin.',
    effectKey: 'perk_wheel_scout',
    baseCost: 18,
    rarity: 'rare',
  },
  'run-dice': {
    name: 'Loss Shield',
    description: 'When active, a loss roll returns your bet (push) instead of losing.',
    effectKey: 'perk_run_dice_insight',
    baseCost: 16,
    rarity: 'rare',
  },
  'chicken-road': {
    name: 'Safe Lane',
    description: 'When active, your first crossing each round can’t fail; that lane is ringed in green.',
    effectKey: 'perk_chicken_road_lane',
    baseCost: 20,
    rarity: 'rare',
  },
  slots: {
    name: 'First Spin Shield',
    description: 'When active, your first spin cannot lose money (refunded to a push).',
    effectKey: 'perk_slots_shield',
    baseCost: 18,
    rarity: 'rare',
  },
  roulette: {
    name: 'Ball Tracker',
    description: 'Three numbers that will not hit are shown while you place bets.',
    effectKey: 'perk_roulette_tracker',
    baseCost: 22,
    rarity: 'epic',
  },
  'dragon-tower': {
    name: 'Dragon’s Blind Spot',
    description: 'One safe tile is marked on each of the first two floors.',
    effectKey: 'perk_dragon_blindspot',
    baseCost: 22,
    rarity: 'rare',
  },
  'street-cups': {
    name: 'Cup Truth',
    description: 'One empty cup is crossed off before you pick.',
    effectKey: 'perk_street_cups_truth',
    baseCost: 18,
    rarity: 'rare',
  },
  'case-battles': {
    name: 'Case X-Ray',
    description: 'When active, once your cases open you may reroll one of your items (or skip).',
    effectKey: 'perk_case_xray',
    baseCost: 20,
    rarity: 'rare',
  },
  'poker-1p': {
    name: 'Hold Harmony',
    description: 'When active, the draw favors cards matching the ranks you held.',
    effectKey: 'perk_poker_hold_bias',
    baseCost: 20,
    rarity: 'rare',
  },
  keno: {
    name: 'Number Heat',
    description: 'Two numbers that will hit are highlighted before the draw.',
    effectKey: 'perk_keno_heat',
    baseCost: 22,
    rarity: 'epic',
  },
  'coin-flip': {
    name: 'Weighted Edge',
    description: 'Your chosen side is more likely to win each flip.',
    effectKey: 'perk_coin_bias',
    baseCost: 20,
    rarity: 'rare',
    descriptionForLevel: (level) => {
      const pct = Math.round((COIN_BIAS_CHANCE_BY_LEVEL[level] ?? 0.60) * 100)
      return `Your chosen side wins ${pct}% of the time.`
    },
  },
}

function withProcNote(description: string, effectKey: string, level: number): string {
  const pct = perkProcChancePercent(effectKey, level)
  if (pct == null) return description
  return `${description} (~${pct}% chance to activate each bet.)`
}

function leveledItems(
  familyId: string,
  base: Omit<CatalogItem, 'id' | 'familyId' | 'level' | 'baseCost'> & { baseCost: number },
  levels: number,
  build: (level: number) => Pick<CatalogItem, 'description' | 'payoutMult' | 'name'>,
): CatalogItem[] {
  const items: CatalogItem[] = []
  for (let level = 1; level <= levels; level++) {
    const extra = build(level)
    items.push({
      ...base,
      ...extra,
      id: `${familyId}_l${level}`,
      familyId,
      level,
      baseCost: levelCost(base.baseCost, level),
    })
  }
  return items
}

function gameBoostItems(): CatalogItem[] {
  return SURVIVAL_GAME_POOL.flatMap((game) => {
    const label = GAME_BOOST_LABELS[game]
    const familyId = `${game.replace(/-/g, '_')}_boost`
    return leveledItems(
      familyId,
      {
        name: label.name,
        description: '',
        baseCost: 14,
        scope: 'game',
        game,
        effectKey: 'payout_boost',
        rarity: 'common',
      },
      MAX_UPGRADE_LEVEL,
      (level) => {
        const mult = GAME_PAYOUT_MULT_BY_LEVEL[level - 1]!
        return {
          name: `${label.name} ${levelRoman(level)}`,
          description: `${payoutPercentLabel(mult)} ${formatGameLabel(game)} win payouts.`,
          payoutMult: mult,
        }
      },
    )
  })
}

function gamePerkItems(): CatalogItem[] {
  return SURVIVAL_GAME_POOL.flatMap((game) => {
    const perk = GAME_PERK_DEFS[game]
    const familyId = `${game.replace(/-/g, '_')}_perk`
    return leveledItems(
      familyId,
      {
        name: perk.name,
        description: perk.description,
        baseCost: perk.baseCost,
        scope: 'game',
        game,
        effectKey: perk.effectKey,
        rarity: perk.rarity,
      },
      MAX_UPGRADE_LEVEL,
      (level) => ({
        name: `${perk.name} ${levelRoman(level)}`,
        description: perk.descriptionForLevel
          ? perk.descriptionForLevel(level)
          : withProcNote(perk.description, perk.effectKey, level),
      }),
    )
  })
}

function runPayoutBoostItems(): CatalogItem[] {
  return leveledItems(
    'run_payout_boost',
    {
      name: 'Lucky Charm',
      description: '',
      baseCost: 12,
      scope: 'run',
      effectKey: 'payout_boost',
      rarity: 'common',
    },
    MAX_UPGRADE_LEVEL,
    (level) => {
      const mult = RUN_PAYOUT_MULT_BY_LEVEL[level - 1]!
      return {
        name: `Lucky Charm ${levelRoman(level)}`,
        description: `${payoutPercentLabel(mult)} payout on all wins for the rest of the run.`,
        payoutMult: mult,
      }
    },
  )
}

function openingTicketItems(): CatalogItem[] {
  return leveledItems(
    'first_bet_free',
    {
      name: 'Opening Ticket',
      description: '',
      baseCost: 20,
      scope: 'run',
      effectKey: 'first_bet_free',
      rarity: 'rare',
    },
    MAX_UPGRADE_LEVEL,
    (level) => {
      const cap = OPENING_TICKET_CAP_BY_LEVEL[level - 1]!
      return {
        name: `Opening Ticket ${levelRoman(level)}`,
        description: `First bet on each floor is free up to ${cap}× the floor minimum bet. Excess is charged normally.`,
      }
    },
  )
}

export const UPGRADES_CATALOG: CatalogItem[] = [
  ...runPayoutBoostItems(),
  ...openingTicketItems(),
  ...gameBoostItems(),
  ...gamePerkItems(),
]

export function getCatalogItem(id: string): CatalogItem | undefined {
  const normalized = normalizeUpgradeId(id)
  if (normalized === LOBBY_REROLL_TICKET_ID) {
    return {
      id: LOBBY_REROLL_TICKET_ID,
      name: LOBBY_REROLL_TICKET.name,
      description: LOBBY_REROLL_TICKET.description,
      baseCost: LOBBY_REROLL_TICKET.baseCost,
      scope: 'consumable',
      effectKey: 'consumable_reroll',
      rarity: 'common',
    }
  }
  return UPGRADES_CATALOG.find((i) => i.id === normalized)
}

export function getCatalogItemByEffect(effectKey: string, game?: GameName): CatalogItem | undefined {
  return UPGRADES_CATALOG.find(
    (i) => i.effectKey === effectKey && (game == null || i.game === game || i.scope === 'run'),
  )
}

export function formatGameLabel(game: GameName): string {
  return game
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function catalogScopeLabel(item: CatalogItem): string | null {
  if (item.scope === 'game' && item.game) return formatGameLabel(item.game)
  if (item.scope === 'run') return 'All games'
  if (item.scope === 'consumable') return 'Consumable'
  return null
}

export function getItemsForGame(game: GameName): CatalogItem[] {
  return UPGRADES_CATALOG.filter((i) => i.game === game)
}

/** Dev helper: one max-level item per upgrade family. */
export function allPurchasedUpgradesForDev(): PurchasedUpgrade[] {
  const purchasedAt = new Date().toISOString()
  const byFamily = new Map<string, CatalogItem>()
  for (const item of UPGRADES_CATALOG) {
    if (item.scope === 'consumable' || !item.familyId) continue
    const prev = byFamily.get(item.familyId)
    if (!prev || (item.level ?? 0) > (prev.level ?? 0)) byFamily.set(item.familyId, item)
  }
  return Array.from(byFamily.values()).map((item) => ({ id: item.id, purchasedAt }))
}

export { normalizeUpgradeId } from './upgrade-levels'

export function getMaxOwnedLevelInFamily(
  purchasedUpgrades: PurchasedUpgrade[],
  familyId: string,
): number {
  let max = 0
  for (const pu of purchasedUpgrades) {
    const item = getCatalogItem(normalizeUpgradeId(pu.id))
    if (!item || item.familyId !== familyId) continue
    max = Math.max(max, item.level ?? 0)
  }
  return max
}

export function getMaxOwnedLevelForEffect(
  purchasedUpgrades: PurchasedUpgrade[],
  effectKey: string,
  options?: { game?: string; scope?: 'run' | 'game' },
): number {
  let max = 0
  for (const pu of purchasedUpgrades) {
    const item = getCatalogItem(normalizeUpgradeId(pu.id))
    if (!item || item.effectKey !== effectKey) continue
    if (options?.scope && item.scope !== options.scope) continue
    if (options?.game && item.scope === 'game' && item.game !== options.game) continue
    max = Math.max(max, item.level ?? 0)
  }
  return max
}

export function isUpgradeOfferable(
  item: { id: string; familyId?: string; level?: number },
  ownedIds: string[],
): boolean {
  const normalized = ownedIds.map(normalizeUpgradeId)
  if (normalized.includes(item.id)) return false
  if (!item.familyId || !item.level) return true
  const maxOwned = getMaxOwnedLevelInFamily(
    normalized.map((id) => ({ id, purchasedAt: '' })),
    item.familyId,
  )
  if (maxOwned >= MAX_UPGRADE_LEVEL) return false
  return item.level === maxOwned + 1
}

export function canPurchaseUpgrade(
  id: string,
  purchasedUpgrades: PurchasedUpgrade[],
): boolean {
  const item = getCatalogItem(id)
  if (!item?.familyId || !item.level) return true
  const normalized = purchasedUpgrades.map((u) => normalizeUpgradeId(u.id))
  if (normalized.includes(id)) return false
  const maxOwned = getMaxOwnedLevelInFamily(purchasedUpgrades, item.familyId)
  return item.level === maxOwned + 1
}
