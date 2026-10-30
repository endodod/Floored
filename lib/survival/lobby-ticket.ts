import { createRng, seedFromString } from '@/utils/rng'
import type { GameName } from '@/store/types'
import { pickWeightedGame } from './floor-generator'

export const LOBBY_REROLL_TICKET_ID = 'reroll_floor_game'

export const LOBBY_REROLL_TICKET = {
  id: LOBBY_REROLL_TICKET_ID,
  name: 'Lobby Reroll Ticket',
  description: 'Reroll one lobby game, shop offer, or mission on this floor.',
  baseCost: 8,
} as const

export function getLobbyTicketCount(inventory: { id: string; count: number }[]): number {
  return inventory.find((i) => i.id === LOBBY_REROLL_TICKET_ID)?.count ?? 0
}

/** Games already used on this floor (current lobby + any previous assignment). */
export function lobbyGamesOfferedFromFloor(floorGames: GameName[]): GameName[] {
  return [...new Set(floorGames)]
}

/** Candidate games for a ticket reroll on one lobby slot. */
export function availableLobbyGamesForSlot(
  pool: GameName[],
  offeredGames: GameName[],
): GameName[] {
  const offered = new Set(offeredGames)
  return pool.filter((g) => !offered.has(g))
}

export function canRerollLobbyGameWithTicket(
  slotIndex: number,
  floorGames: GameName[],
  pool: GameName[],
  offeredGames: GameName[],
): boolean {
  if (slotIndex < 0 || slotIndex >= floorGames.length) return false
  return availableLobbyGamesForSlot(pool, offeredGames).length > 0
}

export function pickLobbyGameReroll(input: {
  runSeed: string
  floor: number
  slotIndex: number
  rollSeq: number
  floorGames: GameName[]
  pool: GameName[]
  offeredGames: GameName[]
  previousFloors?: GameName[][]
  ownedGames?: GameName[]
}): GameName | null {
  const available = availableLobbyGamesForSlot(input.pool, input.offeredGames)
  if (available.length === 0) return null
  const rng = createRng(
    seedFromString(
      `${input.runSeed}:lobby-ticket:${input.floor}:${input.slotIndex}:${input.rollSeq}`,
    ),
  )
  return pickWeightedGame(available, input.previousFloors ?? [], input.ownedGames ?? [], rng)
}

export function applyLobbyGameReroll(
  floorGames: GameName[],
  slotIndex: number,
  replacement: GameName,
): GameName[] {
  const next = [...floorGames]
  next[slotIndex] = replacement
  return next
}
