'use client'

import { useMemo, useState } from 'react'
import { useSurvivalStore } from '@/store/survival-store'
import { Button } from '@/components/ui/button'
import {
  slotIdsToOffers,
  getShopPools,
  canRerollShopSlot,
  canRerollShopKind,
  shopPoolKindForSlot,
  SHOP_SLOT_GAME_0,
  SHOP_SLOT_GAME_1,
  SHOP_SLOT_RUN,
  SHOP_SLOT_ACTIVE,
  type ShopOffer,
} from '@/lib/survival/shop-offers'
import { getLobbyTicketCount, LOBBY_REROLL_TICKET_ID } from '@/lib/survival/lobby-ticket'
import {
  getCatalogItem,
  catalogScopeLabel,
  normalizeUpgradeId,
  type CatalogItem,
} from '@/lib/survival/upgrades-catalog'
import type { GameName } from '@/store/types'
import { formatChips } from '@/utils/format'
import { SurvivalSidebarPanel, SurvivalSidebarRow } from '@/components/survival/survival-sidebar-panel'

const CARD_HEIGHT = 'min-h-[6.5rem] sm:min-h-[12rem]'

interface SurvivalShopProps {
  /** Hide title when embedded in floor-complete modal */
  embedded?: boolean
}

export function SurvivalShop({ embedded = false }: SurvivalShopProps) {
  const difficulty = useSurvivalStore((s) => s.difficulty)
  const floorGames = useSurvivalStore((s) => s.floorGames)
  const sparks = useSurvivalStore((s) => s.sparks)
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)
  const inventory = useSurvivalStore((s) => s.inventory)
  const shopRerollCount = useSurvivalStore((s) => s.shopRerollCount)
  const shopPurchasedSlotIndices = useSurvivalStore((s) => s.shopPurchasedSlotIndices)
  const shopSlotItemIds = useSurvivalStore((s) => s.shopSlotItemIds)
  const shopOfferedIds = useSurvivalStore((s) => s.shopOfferedIds)
  const purchaseUpgrade = useSurvivalStore((s) => s.purchaseUpgrade)
  const rerollShopOfferWithTicket = useSurvivalStore((s) => s.rerollShopOfferWithTicket)
  const lobbyTicketCount = getLobbyTicketCount(inventory)

  const ownedUpgradeIds = useMemo(
    () => purchasedUpgrades.map((u) => u.id),
    [purchasedUpgrades],
  )

  const pools = useMemo(
    () => (difficulty != null ? getShopPools(floorGames, ownedUpgradeIds) : null),
    [difficulty, floorGames, ownedUpgradeIds],
  )

  const offers = useMemo(() => {
    if (!difficulty) return [] as (ShopOffer | null)[]
    return slotIdsToOffers(shopSlotItemIds, difficulty)
  }, [difficulty, shopSlotItemIds])

  const kindCanReroll = useMemo(() => {
    if (!pools) return { game: false, run: false, active: false }
    return {
      game: canRerollShopKind('game', shopSlotItemIds, pools, shopOfferedIds),
      run: canRerollShopKind('run', shopSlotItemIds, pools, shopOfferedIds),
      active: canRerollShopKind('active', shopSlotItemIds, pools, shopOfferedIds),
    }
  }, [pools, shopSlotItemIds, shopOfferedIds])

  function showRerollButton(slotIndex: number): boolean {
    if (lobbyTicketCount <= 0) return false
    if (shopPurchasedSlotIndices.includes(slotIndex)) return false
    if (!pools) return false
    const kind = shopPoolKindForSlot(slotIndex)
    if (!kindCanReroll[kind]) return false
    return canRerollShopSlot(slotIndex, shopSlotItemIds, pools, shopOfferedIds)
  }

  function isOwned(id: string, scope: string): boolean {
    if (scope === 'consumable') {
      return (inventory.find((i) => i.id === id)?.count ?? 0) > 0
    }
    return purchasedUpgrades.some((u) => normalizeUpgradeId(u.id) === id)
  }

  function ownedLabel(id: string, scope: string): string | null {
    if (scope === 'consumable') {
      const count = inventory.find((i) => i.id === id)?.count ?? 0
      return count > 0 ? `×${count}` : null
    }
    const owned = purchasedUpgrades.some((u) => normalizeUpgradeId(u.id) === id)
    if (!owned) return null
    const catalog = getCatalogItem(id)
    return catalog?.level != null ? `Owned · Lv.${catalog.level}` : 'Owned'
  }

  const runOffer = offers[SHOP_SLOT_RUN] ?? null
  const activeOffer = offers[SHOP_SLOT_ACTIVE] ?? null
  const gameOffers: (ShopOffer | null)[] = [
    offers[SHOP_SLOT_GAME_0] ?? null,
    offers[SHOP_SLOT_GAME_1] ?? null,
  ]

  const poolEmpty =
    pools != null &&
    pools.game.length === 0 &&
    pools.run.length === 0 &&
    pools.active.length === 0

  function renderOfferCard(offer: ShopOffer, slotIndex: number) {
    const { item, price } = offer
    const owned = isOwned(item.id, item.scope)
    const ownedText = ownedLabel(item.id, item.scope)
    const canAfford = sparks >= price
    const disabled = (item.scope !== 'consumable' && owned) || !canAfford
    const scopeLabel = catalogScopeLabel(item)
    const scopeTone =
      item.scope === 'game'
        ? 'text-sky-400/90'
        : item.scope === 'run'
          ? 'text-violet-400/80'
          : 'text-zinc-500'

    return (
      <OfferCard
        key={`slot-${slotIndex}`}
        item={item}
        price={price}
        ownedText={ownedText}
        canAfford={canAfford}
        disabled={disabled}
        scopeLabel={scopeLabel}
        scopeTone={scopeTone}
        canReroll={showRerollButton(slotIndex)}
        ticketCount={lobbyTicketCount}
        onReroll={() => rerollShopOfferWithTicket(slotIndex)}
        onPurchase={() => purchaseUpgrade(item.id, price, slotIndex)}
      />
    )
  }

  function renderAlreadyBoughtSlot(label: string, slotIndex: number) {
    return (
      <div
        key={`bought-${slotIndex}`}
        className={`rounded-xl border border-zinc-800/40 bg-zinc-950/20 p-3 flex flex-col gap-2 ${CARD_HEIGHT} opacity-50`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-zinc-600">
              {label}
            </p>
            <p className="text-sm font-semibold text-zinc-600">Already Bought</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-base text-zinc-600 shrink-0">
            ✓
          </span>
        </div>
        <p className="text-xs text-zinc-700 leading-snug flex-1">Refreshes next floor.</p>
        <button
          disabled
          className="w-full mt-auto rounded-md bg-zinc-900 text-zinc-700 text-xs py-1.5 cursor-not-allowed"
        >
          Already Bought
        </button>
      </div>
    )
  }

  function renderEmptyOfferSlot(label: string, slotIndex: number) {
    return (
      <div
        key={`empty-${slotIndex}`}
        className={`rounded-xl border border-dashed border-zinc-700/50 bg-zinc-950/20 p-3 flex flex-col gap-2 opacity-60 ${CARD_HEIGHT}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-zinc-600">
              {label}
            </p>
            <p className="text-sm font-semibold text-zinc-600">Empty</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-lg text-zinc-700 shrink-0">
            ∅
          </span>
        </div>
        <p className="text-xs text-zinc-700 leading-snug flex-1">No offer available this floor.</p>
        <button
          disabled
          className="w-full mt-auto rounded-md bg-zinc-900 text-zinc-700 text-xs py-1.5 cursor-not-allowed"
        >
          —
        </button>
      </div>
    )
  }

  function renderSlot(offer: ShopOffer | null, slotIndex: number, emptyLabel: string) {
    if (shopPurchasedSlotIndices.includes(slotIndex)) return renderAlreadyBoughtSlot(emptyLabel, slotIndex)
    if (!offer) return renderEmptyOfferSlot(emptyLabel, slotIndex)
    return renderOfferCard(offer, slotIndex)
  }

  return (
    <div className={`flex flex-col gap-3 ${embedded ? '' : 'rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4'}`}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Shop</h3>
          <span className="text-sm font-bold text-amber-400 tabular-nums">
            <span className="text-[10px] font-normal text-zinc-500 mr-1">Sparks:</span>✦ {formatChips(sparks)}
          </span>
        </div>
      )}

      <p className="text-[10px] text-zinc-600 leading-snug">
        Shared pools per floor — each item or mission appears at most once. One ticket reroll per slot.
        {shopRerollCount > 0 && ` · Rerolled ${shopRerollCount}× this floor`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {renderSlot(runOffer, SHOP_SLOT_RUN, 'Run upgrade')}
        {renderSlot(activeOffer, SHOP_SLOT_ACTIVE, 'Active item')}
        {gameOffers.map((offer, i) =>
          renderSlot(offer, i === 0 ? SHOP_SLOT_GAME_0 : SHOP_SLOT_GAME_1, `Game upgrade ${i + 1}`),
        )}
      </div>

      {poolEmpty && (
        <p className="text-xs text-zinc-500 text-center py-2">
          No shop items left for this floor — try next floor after more purchases.
        </p>
      )}
    </div>
  )
}

interface OfferCardProps {
  item: CatalogItem
  price: number
  ownedText: string | null
  canAfford: boolean
  disabled: boolean
  scopeLabel: string | null
  scopeTone: string
  canReroll: boolean
  ticketCount: number
  onReroll: () => void
  onPurchase: () => void
}

const REROLL_TICKET_COST = 1

function OfferCard({
  item,
  price,
  ownedText,
  canAfford,
  disabled,
  scopeLabel,
  scopeTone,
  canReroll,
  ticketCount,
  onReroll,
  onPurchase,
}: OfferCardProps) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div
      className={`relative rounded-xl border border-zinc-800 bg-zinc-950/50 p-2 sm:p-3 flex flex-col gap-1.5 sm:gap-2 ${CARD_HEIGHT}`}
    >
      {canReroll && (
        <button
          type="button"
          title={`Spend 1 lobby reroll ticket to reroll this offer (${ticketCount} owned)`}
          onClick={onReroll}
          className="absolute top-2 right-2 z-10 flex items-center gap-1 h-6 pl-1 pr-1.5 rounded-md border border-white/20 bg-black/40 text-white/90 hover:bg-black/60"
        >
          <span aria-hidden className="text-xs leading-none">↻:</span>
          <span aria-hidden className="text-xs leading-none">🎟️</span>
          <span className="text-[10px] font-bold tabular-nums leading-none">×{REROLL_TICKET_COST}</span>
        </button>
      )}
      <div className="flex items-start justify-between gap-2 pr-14">
        <div className="min-w-0">
          {scopeLabel && (
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${scopeTone}`}>
              {scopeLabel}
            </p>
          )}
          <p className="text-sm font-semibold text-zinc-200">{item.name}</p>
          {item.level != null && <p className="text-[10px] text-zinc-500">Level {item.level}</p>}
          {item.rarity && (
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">{item.rarity}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Show description"
            aria-expanded={showInfo}
            className={`sm:hidden flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold italic transition-colors ${
              showInfo
                ? 'border-sky-500 text-sky-400 bg-sky-950/40'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            i
          </button>
        </div>
      </div>

      {/* Desktop: description always visible */}
      <p className="hidden sm:block text-xs text-zinc-500 leading-snug flex-1">{item.description}</p>

      {/* Mobile: description only when info toggle is on */}
      {showInfo && (
        <p className="sm:hidden text-[11px] text-zinc-500 leading-snug">{item.description}</p>
      )}

      <Button
        size="sm"
        variant={ownedText ? 'secondary' : 'default'}
        disabled={disabled}
        className="w-full mt-auto flex items-center justify-center gap-1.5"
        onClick={onPurchase}
      >
        {ownedText ?? (
          <>
            <span>{canAfford ? 'Purchase' : 'Not enough sparks'}</span>
            <span className="font-bold tabular-nums">✦ {price}</span>
          </>
        )}
      </Button>
    </div>
  )
}

const RARITY_TONE: Record<string, string> = {
  common: 'text-zinc-500',
  rare: 'text-sky-400',
  epic: 'text-fuchsia-400',
}

/** Compact list of owned run upgrades for game sidebar */
export function OwnedUpgradesList({
  compact = false,
  currentGame,
}: {
  compact?: boolean
  currentGame?: GameName
}) {
  const purchasedUpgrades = useSurvivalStore((s) => s.purchasedUpgrades)
  const inventory = useSurvivalStore((s) => s.inventory)
  const [hoveredItem, setHoveredItem] = useState<CatalogItem | null>(null)

  const ownedItems = purchasedUpgrades
    .map((u) => getCatalogItem(u.id))
    .filter((i): i is CatalogItem => i != null && i.scope !== 'consumable')

  const consumables = inventory
    .filter((c) => c.count > 0 && c.id !== LOBBY_REROLL_TICKET_ID)
    .map((c) => ({ ...c, item: getCatalogItem(c.id) }))
    .filter((c) => c.item)

  const totalCount = ownedItems.length + consumables.length

  if (totalCount === 0) {
    return (
      <SurvivalSidebarPanel compact={compact} title="Upgrades" count={0} empty emptyLabel="No upgrades yet" />
    )
  }

  function isRelevant(item: CatalogItem) {
    return item.scope === 'run' || item.game === currentGame
  }

  const sortedItems =
    currentGame != null
      ? [
          ...ownedItems.filter(isRelevant),
          ...ownedItems.filter((i) => !isRelevant(i)),
        ]
      : ownedItems

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <SurvivalSidebarPanel compact={compact} title="Upgrades" count={totalCount}>
        {sortedItems.map((item) => {
          const relevant = currentGame != null && isRelevant(item)
          return (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`flex flex-col gap-0.5 py-1 px-1.5 rounded-md cursor-default transition-colors ${
                relevant
                  ? 'bg-sky-950/50 border border-sky-900/40'
                  : 'hover:bg-zinc-800/40 border border-transparent'
              }`}
            >
              <p className={`text-[11px] leading-snug ${relevant ? 'text-sky-200' : 'text-zinc-300'}`}>
                {item.name}
              </p>
              <p className={`text-[9px] uppercase tracking-wide leading-none ${relevant ? 'text-sky-500/70' : 'text-zinc-600'}`}>
                {catalogScopeLabel(item)}
              </p>
            </div>
          )
        })}
        {consumables.map(({ id, count, item }) => {
          const ci = item!
          return (
            <div
              key={id}
              onMouseEnter={() => setHoveredItem(ci)}
              onMouseLeave={() => setHoveredItem(null)}
              className="flex flex-col gap-0.5 py-1 px-1.5 rounded-md cursor-default hover:bg-zinc-800/40 border border-transparent"
            >
              <p className="text-[11px] text-zinc-300 leading-snug">{ci.name} ×{count}</p>
              <p className="text-[9px] text-zinc-600 uppercase tracking-wide leading-none">Consumable</p>
            </div>
          )
        })}
      </SurvivalSidebarPanel>

      {hoveredItem && (
        <div className="absolute left-full top-0 ml-2 z-50 w-56 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl p-3 pointer-events-none flex flex-col gap-1">
          <p className="text-xs font-semibold text-zinc-100 leading-snug">{hoveredItem.name}</p>
          <div className="flex items-center gap-2">
            {hoveredItem.rarity && (
              <p className={`text-[9px] font-semibold uppercase tracking-wider ${RARITY_TONE[hoveredItem.rarity] ?? 'text-zinc-500'}`}>
                {hoveredItem.rarity}
              </p>
            )}
            {catalogScopeLabel(hoveredItem) && (
              <p className="text-[9px] uppercase tracking-wider text-zinc-600">
                {catalogScopeLabel(hoveredItem)}
              </p>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{hoveredItem.description}</p>
        </div>
      )}
    </div>
  )
}
