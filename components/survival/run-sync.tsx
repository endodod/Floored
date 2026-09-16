'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth/client'
import { useSurvivalStore } from '@/store/survival-store'
import { buildRunSyncPayload } from '@/lib/survival/run-sync'

/** Persists each concluded survival run to the server for signed-in users. Renders nothing. */
export function RunSync() {
  const session = authClient.useSession()
  const lastRun = useSurvivalStore((s) => s.lastRun)
  const diceConfig = useSurvivalStore((s) => s.diceConfig)
  const lastSyncedRunAt = useSurvivalStore((s) => s.lastSyncedRunAt)
  const markRunSynced = useSurvivalStore((s) => s.markRunSynced)

  useEffect(() => {
    if (!session.data?.user) return
    if (!lastRun || lastRun.endedAt === lastSyncedRunAt) return

    const payload = buildRunSyncPayload(lastRun, diceConfig)
    if (!payload) return

    const endedAt = lastRun.endedAt
    fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) markRunSynced(endedAt)
      })
      .catch(() => {
        // Best-effort sync — a failed attempt is simply retried next time lastRun changes.
      })
  }, [session.data?.user, lastRun, lastSyncedRunAt, diceConfig, markRunSynced])

  return null
}
