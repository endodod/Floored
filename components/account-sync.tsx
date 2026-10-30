'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth/client'
import { useDailyStore } from '@/store/daily-store'
import { useFreeplayStore } from '@/store/freeplay-store'
import { useLadderStore } from '@/store/ladder-store'
import { useSurvivalStore } from '@/store/survival-store'
import { useTablesStore } from '@/store/tables-store'
import { SYNCED_STORE_KEYS, type SyncPayload, type SyncedStoreKey } from '@/lib/sync/keys'

/** A persisted zustand store: all the sync needs from it. */
interface PersistedStore {
  subscribe: (listener: () => void) => () => void
  persist: { getOptions: () => { name?: string }; rehydrate: () => Promise<void> | void }
}

const STORES: Record<SyncedStoreKey, PersistedStore> = {
  freeplay: useFreeplayStore as unknown as PersistedStore,
  daily: useDailyStore as unknown as PersistedStore,
  ladder: useLadderStore as unknown as PersistedStore,
  tables: useTablesStore as unknown as PersistedStore,
  survival: useSurvivalStore as unknown as PersistedStore,
}

/**
 * Writes are batched to keep the database asleep: Neon's free compute stays
 * awake 5 minutes after each request, so a write per bet would keep it running
 * for the whole session. Changes go up at most every FLUSH_MS while playing,
 * and when the tab is hidden or closed.
 */
const FLUSH_MS = 15 * 60_000
/** Coming back to a tab hidden this long pulls again (you may have played elsewhere). */
const REPULL_AFTER_HIDDEN_MS = 30 * 60_000
/** Browsers cap keepalive request bodies at 64 KB. */
const KEEPALIVE_MAX = 60_000
const META_KEY = 'floored-sync'
/** First retry of a failed pull; later ones wait 2× and 3× as long. */
const PULL_RETRY_MS = 2 * 60_000

interface Meta {
  /** The account the local stores last synced with; null = never signed in here. */
  userId: string | null
  /** Per store: when it last changed here, and the server `changedAt` it last matched. */
  keys: Partial<Record<SyncedStoreKey, { changedAt: number; syncedAt: number }>>
}

function readMeta(): Meta {
  try {
    const raw = window.localStorage.getItem(META_KEY)
    if (raw) return JSON.parse(raw) as Meta
  } catch {
    // Unreadable meta: start over (the next pull settles every store).
  }
  return { userId: null, keys: {} }
}

function writeMeta(meta: Meta) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Without storage there is nothing to sync from anyway.
  }
}

function storageName(key: SyncedStoreKey): string {
  return STORES[key].persist.getOptions().name ?? `floored-${key}`
}

function readRaw(key: SyncedStoreKey): string | null {
  try {
    return window.localStorage.getItem(storageName(key))
  } catch {
    return null
  }
}

function readLocal(key: SyncedStoreKey): unknown | null {
  try {
    const raw = window.localStorage.getItem(storageName(key))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Keeps Freeplay, Daily, Ladder, Tables and Survival progress on the signed-in account
 * (`/api/state`), so it follows the player across devices. Renders nothing.
 *
 * On load: pull once. A store changed on another device since this one last
 * synced replaces the local copy, unless this device changed it more recently
 * (newest change wins, per store). First sign-in on a device: the account's
 * progress wins; stores the account doesn't have yet are uploaded from here.
 *
 * A change counts only when the store's saved value really changed. Changes made
 * before the first pull lands (a page rolling Daily over to a new day as it
 * opens) wait for it: they are dropped for a store the account replaces, so a
 * stale device can't beat the account's newer progress.
 */
export function AccountSync() {
  const session = authClient.useSession()
  const uid = session.data?.user?.id ?? null

  useEffect(() => {
    if (!uid) return
    let applying = false
    let ready = false
    /** Changes seen before the first pull finished: store → when. */
    const early = new Map<SyncedStoreKey, number>()
    /** The saved value each store had at its last counted change, to skip no-op writes. */
    const lastRaw = new Map(SYNCED_STORE_KEYS.map((key) => [key, readRaw(key)] as const))
    let timer: ReturnType<typeof setTimeout> | null = null
    let hiddenAt = 0
    let alive = true

    const entry = (meta: Meta, key: SyncedStoreKey) => (meta.keys[key] ??= { changedAt: 0, syncedAt: 0 })

    async function flush(keepalive = false) {
      if (timer) clearTimeout(timer)
      timer = null
      const meta = readMeta()
      if (meta.userId !== uid) return
      const body: SyncPayload = {}
      for (const key of SYNCED_STORE_KEYS) {
        const e = meta.keys[key]
        const data = readLocal(key)
        if (e && e.changedAt > e.syncedAt && data) body[key] = { data, changedAt: e.changedAt }
      }
      const sent = Object.entries(body) as [SyncedStoreKey, { changedAt: number }][]
      if (!sent.length) return
      const json = JSON.stringify(body)
      try {
        const res = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: json,
          keepalive: keepalive && json.length < KEEPALIVE_MAX,
        })
        if (!res.ok) return
        const after = readMeta()
        for (const [key, { changedAt }] of sent) {
          const e = entry(after, key)
          e.syncedAt = Math.max(e.syncedAt, changedAt)
        }
        writeMeta(after)
      } catch {
        // Offline or closing: still dirty, sent with the next flush.
      }
    }

    function schedule() {
      if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS)
    }

    async function apply(key: SyncedStoreKey, data: unknown) {
      applying = true
      try {
        window.localStorage.setItem(storageName(key), JSON.stringify(data))
        await STORES[key].persist.rehydrate()
        // Let the store write itself back before taking its saved value as the baseline.
        await Promise.resolve()
      } catch {
        // Keep the local copy if the account's can't be stored or read.
      } finally {
        lastRaw.set(key, readRaw(key))
        applying = false
      }
    }

    let retries = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function pull() {
      let server: SyncPayload | null = null
      try {
        const res = await fetch('/api/state')
        if (res.ok) server = (await res.json()) as SyncPayload
      } catch {
        // Handled below.
      }
      if (!server) {
        // Until a pull lands nothing is uploaded, so a device that couldn't check
        // the account never overwrites it. Try again a few times, spaced out.
        if (alive && !ready && retries < 3) retryTimer = setTimeout(() => void pull(), PULL_RETRY_MS * ++retries)
        return
      }
      if (!alive) return
      const meta = readMeta()
      const firstHere = meta.userId !== uid
      const applied = new Set<SyncedStoreKey>()
      for (const key of SYNCED_STORE_KEYS) {
        const s = server[key]
        const e = entry(meta, key)
        if (firstHere) {
          if (s) {
            await apply(key, s.data)
            applied.add(key)
            meta.keys[key] = { changedAt: s.changedAt, syncedAt: s.changedAt }
          } else if (meta.userId == null && readLocal(key)) {
            // Progress made before signing in moves into the new account.
            meta.keys[key] = { changedAt: Date.now(), syncedAt: 0 }
          } else {
            meta.keys[key] = { changedAt: 0, syncedAt: 0 }
          }
          continue
        }
        const dirty = e.changedAt > e.syncedAt
        if (s && s.changedAt > e.syncedAt && (!dirty || s.changedAt >= e.changedAt)) {
          await apply(key, s.data)
          applied.add(key)
          meta.keys[key] = { changedAt: s.changedAt, syncedAt: s.changedAt }
        }
      }
      // Early local changes count only for stores the account didn't replace.
      for (const [key, at] of early) {
        if (applied.has(key) || !readLocal(key)) continue
        const e = entry(meta, key)
        e.changedAt = Math.max(e.changedAt, at)
      }
      early.clear()
      ready = true
      meta.userId = uid
      writeMeta(meta)
      // The database is awake from the pull: send anything pending now, at no extra cost.
      await flush()
    }

    const unsubs = SYNCED_STORE_KEYS.map((key) =>
      STORES[key].subscribe(() => {
        if (applying) return
        const at = Date.now()
        // The store writes its saved value right after notifying; compare once it has.
        queueMicrotask(() => {
          if (applying) return
          const raw = readRaw(key)
          if (raw === lastRaw.get(key)) return
          lastRaw.set(key, raw)
          if (!ready) {
            early.set(key, at)
            return
          }
          const meta = readMeta()
          entry(meta, key).changedAt = at
          writeMeta(meta)
          schedule()
        })
      }),
    )

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        void flush(true)
      } else if (hiddenAt && Date.now() - hiddenAt > REPULL_AFTER_HIDDEN_MS) {
        void pull()
      }
    }
    const onPageHide = () => void flush(true)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    void pull()

    return () => {
      alive = false
      unsubs.forEach((u) => u())
      if (timer) clearTimeout(timer)
      if (retryTimer) clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [uid])

  return null
}
