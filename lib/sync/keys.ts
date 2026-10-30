/**
 * Account sync: which stores follow a signed-in player across devices, and the
 * limits the /api/state route enforces. Shared by the route and the client.
 * Each key's value is the store's persisted localStorage entry ({ state, version }).
 */
export const SYNCED_STORE_KEYS = ['freeplay', 'daily', 'ladder', 'tables'] as const
export type SyncedStoreKey = (typeof SYNCED_STORE_KEYS)[number]

export function isSyncedStoreKey(key: string): key is SyncedStoreKey {
  return (SYNCED_STORE_KEYS as readonly string[]).includes(key)
}

/** Largest stored value per key (JSON characters). Daily history grows ~300 per day played. */
export const MAX_STORE_JSON = 256_000

/** One synced store as it travels: the persisted value and when the player last changed it. */
export interface SyncedEntry {
  data: unknown
  /** Milliseconds since epoch, client clock. */
  changedAt: number
}

export type SyncPayload = Partial<Record<SyncedStoreKey, SyncedEntry>>
