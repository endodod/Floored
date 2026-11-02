import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/prisma'
import { validateChallengeInput } from '@/lib/challenges/types'
import { parseSlots, type CommunityChallengeDto } from '@/lib/challenges/community'

/**
 * Community challenges. GET lists them (newest or most played, 60 at most);
 * POST publishes one and needs a signed-in player. Playing never needs an
 * account; see ./[id]/route.ts for tries and results.
 */

const LIST_LIMIT = 60
/** A player can keep this many challenges published. */
const MAX_PER_USER = 25

export async function GET(request: Request) {
  const sort = new URL(request.url).searchParams.get('sort') === 'popular' ? 'popular' : 'new'
  const rows = await prisma.communityChallenge.findMany({
    orderBy: sort === 'popular' ? [{ tries: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
    take: LIST_LIMIT,
    include: { scores: { orderBy: { best: 'desc' }, take: 1, select: { displayName: true, best: true } } },
  })
  const out: CommunityChallengeDto[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    theme: r.theme,
    description: r.description,
    minBet: r.minBet,
    games: parseSlots(r.games),
    author: r.createdByName,
    tries: r.tries,
    top: r.scores[0] ? { name: r.scores[0].displayName, best: r.scores[0].best } : null,
    createdAt: r.createdAt.toISOString(),
  }))
  return NextResponse.json(out)
}

export async function POST(request: Request) {
  const session = await auth.getSession()
  const user = session.data?.user
  if (!user?.id) return NextResponse.json({ error: 'Sign in to publish a challenge.' }, { status: 401 })

  const parsed = validateChallengeInput(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const count = await prisma.communityChallenge.count({ where: { createdById: user.id } })
  if (count >= MAX_PER_USER) {
    return NextResponse.json({ error: `You can publish up to ${MAX_PER_USER} challenges.` }, { status: 400 })
  }

  const { name, theme, description, minBet, games } = parsed.value
  const row = await prisma.communityChallenge.create({
    data: {
      name,
      theme,
      description,
      minBet,
      games: games.map((g) => ({ game: g.game, bets: g.bets })),
      createdById: user.id,
      createdByName: displayName(user),
    },
    select: { id: true },
  })
  return NextResponse.json({ id: row.id })
}

function displayName(user: { name?: string | null; email?: string | null }): string {
  const name = user.name?.trim() || user.email?.split('@')[0] || 'Player'
  return name.slice(0, 32)
}
