import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/prisma'
import { MAX_STORE_JSON, SYNCED_STORE_KEYS, isSyncedStoreKey, type SyncPayload } from '@/lib/sync/keys'

/**
 * Account sync for the stores in SYNCED_STORE_KEYS. GET returns every stored
 * value for the signed-in player in one query; PUT upserts the stores sent,
 * each only if it is newer than what is stored (another device may have
 * written in between). The client batches writes (components/account-sync.tsx)
 * so the database wakes a few times per session, not on every bet.
 */

async function userId(): Promise<string | null> {
  const session = await auth.getSession()
  return session.data?.user?.id ?? null
}

export async function GET() {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const rows = await prisma.userState.findMany({
    where: { userId: id, key: { in: [...SYNCED_STORE_KEYS] } },
    select: { key: true, data: true, changedAt: true },
  })
  const out: SyncPayload = {}
  for (const r of rows) {
    if (isSyncedStoreKey(r.key)) out[r.key] = { data: r.data, changedAt: r.changedAt.getTime() }
  }
  return NextResponse.json(out)
}

function parsePayload(body: unknown): { key: string; json: string; changedAt: Date }[] | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const out: { key: string; json: string; changedAt: Date }[] = []
  for (const [key, entry] of Object.entries(body as Record<string, unknown>)) {
    if (!isSyncedStoreKey(key)) return null
    if (typeof entry !== 'object' || entry === null) return null
    const { data, changedAt } = entry as Record<string, unknown>
    if (typeof data !== 'object' || data === null) return null
    if (typeof changedAt !== 'number' || !Number.isFinite(changedAt)) return null
    // A clock far in the future would win every later sync; refuse it.
    if (changedAt > Date.now() + 24 * 3600_000) return null
    const json = JSON.stringify(data)
    if (json.length > MAX_STORE_JSON) return null
    out.push({ key, json, changedAt: new Date(changedAt) })
  }
  return out.length ? out : null
}

export async function PUT(request: Request) {
  const id = await userId()
  if (!id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const entries = parsePayload(await request.json().catch(() => null))
  if (!entries) return NextResponse.json({ error: 'Invalid state payload' }, { status: 400 })

  // One round trip: every store in a single statement, each kept only if newer.
  const values = Prisma.join(
    entries.map((e) => Prisma.sql`(${id}, ${e.key}, ${e.json}::jsonb, ${e.changedAt}, now())`),
  )
  await prisma.$executeRaw`
    INSERT INTO "UserState" ("userId", "key", "data", "changedAt", "updatedAt")
    VALUES ${values}
    ON CONFLICT ("userId", "key") DO UPDATE
      SET "data" = EXCLUDED."data", "changedAt" = EXCLUDED."changedAt", "updatedAt" = now()
      WHERE "UserState"."changedAt" < EXCLUDED."changedAt"
  `
  return NextResponse.json({ ok: true })
}
