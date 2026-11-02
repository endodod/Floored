import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/prisma'
import { parseSlots, type CommunityChallengeDetailDto } from '@/lib/challenges/community'

/**
 * One community challenge. GET returns it with its top ten. POST records an
 * attempt: `{ event: 'try' }` when one starts (anyone), `{ event: 'result',
 * endReason, endBankroll }` when one ends — a completed result is kept as the
 * signed-in player's best if it beats it. The client sends one of each per
 * attempt (store/challenge-store.ts), never per bet.
 */

const LEADERBOARD_SIZE = 10

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await prisma.communityChallenge.findUnique({
    where: { id },
    include: { scores: { orderBy: { best: 'desc' }, take: LEADERBOARD_SIZE, select: { displayName: true, best: true } } },
  })
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const leaderboard = r.scores.map((s) => ({ name: s.displayName, best: s.best }))
  const out: CommunityChallengeDetailDto = {
    id: r.id,
    name: r.name,
    theme: r.theme,
    description: r.description,
    minBet: r.minBet,
    games: parseSlots(r.games),
    author: r.createdByName,
    tries: r.tries,
    top: leaderboard[0] ?? null,
    createdAt: r.createdAt.toISOString(),
    leaderboard,
  }
  return NextResponse.json(out)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || (body.event !== 'try' && body.event !== 'result')) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  }

  try {
    if (body.event === 'try') {
      await prisma.communityChallenge.update({ where: { id }, data: { tries: { increment: 1 } }, select: { id: true } })
      return NextResponse.json({ ok: true })
    }

    const { endReason, endBankroll } = body
    // Only an attempt with every bet placed sets a best, like the local stats.
    if (endReason !== 'complete') return NextResponse.json({ ok: true })
    if (typeof endBankroll !== 'number' || !Number.isFinite(endBankroll) || endBankroll < 0) {
      return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
    }
    const session = await auth.getSession()
    const user = session.data?.user
    if (!user?.id) return NextResponse.json({ ok: true, saved: false })

    const name = (user.name?.trim() || user.email?.split('@')[0] || 'Player').slice(0, 32)
    const best = Math.floor(endBankroll)
    const prev = await prisma.communityChallengeScore.findUnique({
      where: { challengeId_userId: { challengeId: id, userId: user.id } },
      select: { best: true },
    })
    if (!prev) {
      await prisma.communityChallengeScore.create({ data: { challengeId: id, userId: user.id, displayName: name, best } })
    } else if (best > prev.best) {
      await prisma.communityChallengeScore.update({
        where: { challengeId_userId: { challengeId: id, userId: user.id } },
        data: { best, displayName: name },
      })
    }
    return NextResponse.json({ ok: true, saved: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2025' || e.code === 'P2003')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    throw e
  }
}
