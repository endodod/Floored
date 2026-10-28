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

const CARD_HEIGHT = 'min-h-[6.5rem] sm:min-h-[10rem]'

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
    const scopeTone = 'text-dim'

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
        className={`flex flex-col justify-center gap-1 rounded-md border border-dashed border-control p-4 ${CARD_HEIGHT}`}
      >
        <p className="text-[13px] text-dim">{label}</p>
        <p className="text-[15px] font-semibold text-soft">Bought</p>
        <p className="text-[13px] text-dim">A new offer arrives next floor.</p>
      </div>
    )
  }

  function renderEmptyOfferSlot(label: string, slotIndex: number) {
    return (
      <div
        key={`empty-${slotIndex}`}
        className={`flex flex-col justify-center gap-1 rounded-md border border-dashed border-control p-4 ${CARD_HEIGHT}`}
      >
        <p className="text-[13px] text-dim">{label}</p>
        <p className="text-[15px] font-semibold text-soft">Nothing on offer</p>
        <p className="text-[13px] text-dim">This slot has no item left this floor.</p>
      </div>
    )
  }

  function renderSlot(offer: ShopOffer | null, slotIndex: number, emptyLabel: string) {
    if (shopPurchasedSlotIndices.includes(slotIndex)) return renderAlreadyBoughtSlot(emptyLabel, slotIndex)
    if (!offer) return renderEmptyOfferSlot(emptyLabel, slotIndex)
    return renderOfferCard(offer, slotIndex)
  }

  return (
    <div className={`flex flex-col gap-4 ${embedded ? '' : 'rounded-md bg-surface p-5'}`}>
      {!embedded && (
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">Shop</h3>
          <p className="text-[13px] text-dim">
            <span className="num text-gold glow-gold">✦ {formatChips(sparks)}</span> sparks
          </p>
        </div>
      )}

      <p className="-mt-2 text-[13px] leading-5 text-dim">
        Each item or mission appears at most once per floor; each slot can be rerolled once with a ticket.
        {shopRerollCount > 0 && ` Rerolled ${shopRerollCount}× this floor.`}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {renderSlot(runOffer, SHOP_SLOT_RUN, 'Run upgrade')}
        {renderSlot(activeOffer, SHOP_SLOT_ACTIVE, 'Active item')}
        {gameOffers.map((offer, i) =>
          renderSlot(offer, i === 0 ? SHOP_SLOT_GAME_0 : SHOP_SLOT_GAME_1, `Game upgrade ${i + 1}`),
        )}
      </div>

      {poolEmpty && (
        <p className="py-2 text-center text-[13px] text-dim">
          The shop is empty for this floor. New items arrive as you climb.
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
  const meta = [scopeLabel, item.level != null ? `Level ${item.level}` : null, item.rarity]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={`relative flex flex-col gap-2 rounded-md bg-raised p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_rgba(217,164,65,0.35),0_10px_30px_-14px_rgba(217,164,65,0.5)] ${CARD_HEIGHT}`}>
      {canReroll && (
        <button
          type="button"
          title={`Spend 1 reroll ticket on this offer (${ticketCount} owned)`}
          onClick={onReroll}
          className="absolute right-3 top-3 z-10 h-7 rounded-full border border-control px-2.5 text-xs font-medium text-soft transition-colors hover:border-dim hover:text-ink"
        >
          Reroll · {REROLL_TICKET_COST} ticket
        </button>
      )}
      <div className={`flex items-start justify-between gap-2 ${canReroll ? 'pr-28' : ''}`}>
        <div className="min-w-0">
          {meta && <p className={`text-[13px] ${scopeTone}`}>{meta}</p>}
          <p className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">{item.name}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-label="Show description"
          aria-expanded={showInfo}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] italic transition-colors sm:hidden ${
            showInfo ? 'border-felt text-ink' : 'border-control text-dim hover:text-ink'
          }`}
        >
          i
        </button>
      </div>

      {/* Desktop: description always visible */}
      <p className="hidden flex-1 text-[13px] leading-5 text-soft sm:block">{item.description}</p>

      {/* Mobile: description only when info toggle is on */}
      {showInfo && <p className="text-[13px] leading-5 text-soft sm:hidden">{item.description}</p>}

      <Button
        size="sm"
        variant={ownedText || !canAfford ? 'outline' : 'default'}
        disabled={disabled}
        className="mt-auto w-full"
        onClick={onPurchase}
      >
        {ownedText ?? (
          <>
            <span>{canAfford ? 'Buy for' : 'Needs'}</span>
            <span className="num">{price}</span>
            <span>sparks</span>
          </>
        )}
      </Button>
    </div>
  )
}

const RARITY_TONE: Record<string, string> = {
  common: 'text-dim',
  rare: 'text-soft',
  epic: 'text-gold',
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
              className={`flex cursor-default flex-col gap-0.5 rounded px-1.5 py-1 transition-colors ${
                relevant ? 'bg-raised' : 'hover:bg-raised'
              }`}
            >
              <p className={`text-[12px] leading-snug ${relevant ? 'text-ink' : 'text-soft'}`}>
                {item.name}
              </p>
              <p className={`text-[11px] leading-tight ${relevant ? 'text-felt' : 'text-dim'}`}>
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
              className="flex cursor-default flex-col gap-0.5 rounded px-1.5 py-1 hover:bg-raised"
            >
              <p className="text-[12px] leading-snug text-soft">{ci.name} ×{count}</p>
              <p className="text-[11px] leading-tight text-dim">Consumable</p>
            </div>
          )
        })}
      </SurvivalSidebarPanel>

      {hoveredItem && (
        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 flex w-56 flex-col gap-1 rounded-md border border-line bg-raised p-3 shadow-[0_12px_28px_rgba(0,0,0,.4)]">
          <p className="text-[13px] font-semibold leading-snug text-ink">{hoveredItem.name}</p>
          <div className="flex items-center gap-2">
            {hoveredItem.rarity && (
              <p className={`text-[11px] capitalize ${RARITY_TONE[hoveredItem.rarity] ?? 'text-dim'}`}>
                {hoveredItem.rarity}
              </p>
            )}
            {catalogScopeLabel(hoveredItem) && (
              <p className="text-[11px] text-dim">
                {catalogScopeLabel(hoveredItem)}
              </p>
            )}
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-soft">{hoveredItem.description}</p>
        </div>
      )}
    </div>
  )
}
