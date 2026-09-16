import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/prisma'

interface GameResultInput {
  game: string
  floor: number
  betAmount: number
  payout: number
  outcome: string
  multiplier?: number | null
  playedAt: string
}

interface RunPayload {
  difficulty: string
  seed: string
  startedAt: string
  endedAt: string
  endBankroll: number
  peakBankroll: number
  floorsReached: number
  gamesPlayed: number
  victory: boolean
  diceWinSums?: number[]
  diceLossSums?: number[]
  results: GameResultInput[]
}

const OUTCOMES = new Set(['win', 'loss', 'push'])

function validatePayload(body: unknown): RunPayload | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>

  if (typeof b.difficulty !== 'string') return null
  if (typeof b.seed !== 'string' || b.seed.length === 0) return null
  if (typeof b.startedAt !== 'string' || Number.isNaN(Date.parse(b.startedAt))) return null
  if (typeof b.endedAt !== 'string' || Number.isNaN(Date.parse(b.endedAt))) return null
  if (typeof b.endBankroll !== 'number') return null
  if (typeof b.peakBankroll !== 'number') return null
  if (typeof b.floorsReached !== 'number') return null
  if (typeof b.gamesPlayed !== 'number') return null
  if (typeof b.victory !== 'boolean') return null
  if (!Array.isArray(b.results)) return null

  const results: GameResultInput[] = []
  for (const r of b.results) {
    if (typeof r !== 'object' || r === null) return null
    const g = r as Record<string, unknown>
    if (typeof g.game !== 'string') return null
    if (typeof g.floor !== 'number') return null
    if (typeof g.betAmount !== 'number') return null
    if (typeof g.payout !== 'number') return null
    if (typeof g.outcome !== 'string' || !OUTCOMES.has(g.outcome)) return null
    if (g.multiplier != null && typeof g.multiplier !== 'number') return null
    if (typeof g.playedAt !== 'string' || Number.isNaN(Date.parse(g.playedAt))) return null
    results.push({
      game: g.game,
      floor: g.floor,
      betAmount: g.betAmount,
      payout: g.payout,
      outcome: g.outcome,
      multiplier: g.multiplier as number | null | undefined,
      playedAt: g.playedAt,
    })
  }

  const diceWinSums = Array.isArray(b.diceWinSums) ? b.diceWinSums.filter((n) => typeof n === 'number') : []
  const diceLossSums = Array.isArray(b.diceLossSums) ? b.diceLossSums.filter((n) => typeof n === 'number') : []

  return {
    difficulty: b.difficulty,
    seed: b.seed,
    startedAt: b.startedAt,
    endedAt: b.endedAt,
    endBankroll: b.endBankroll,
    peakBankroll: b.peakBankroll,
    floorsReached: b.floorsReached,
    gamesPlayed: b.gamesPlayed,
    victory: b.victory,
    diceWinSums,
    diceLossSums,
    results,
  }
}

export async function POST(request: Request) {
  const session = await auth.getSession()
  const userId = session.data?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const payload = validatePayload(body)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid run payload' }, { status: 400 })
  }

  const run = await prisma.run.create({
    data: {
      userId,
      difficulty: payload.difficulty,
      seed: payload.seed,
      startedAt: new Date(payload.startedAt),
      endedAt: new Date(payload.endedAt),
      endBankroll: payload.endBankroll,
      peakBankroll: payload.peakBankroll,
      floorsReached: payload.floorsReached,
      gamesPlayed: payload.gamesPlayed,
      victory: payload.victory,
      diceWinSums: payload.diceWinSums ?? [],
      diceLossSums: payload.diceLossSums ?? [],
      results: {
        create: payload.results.map((r) => ({
          game: r.game,
          floor: r.floor,
          betAmount: r.betAmount,
          payout: r.payout,
          outcome: r.outcome,
          multiplier: r.multiplier ?? null,
          playedAt: new Date(r.playedAt),
        })),
      },
    },
    select: { id: true },
  })

  return NextResponse.json({ id: run.id })
}

export async function GET() {
  const session = await auth.getSession()
  const userId = session.data?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const [aggregate, wins, totalRuns] = await Promise.all([
    prisma.run.aggregate({
      where: { userId },
      _max: { floorsReached: true },
    }),
    prisma.run.count({ where: { userId, victory: true } }),
    prisma.run.count({ where: { userId } }),
  ])

  return NextResponse.json({
    highscore: aggregate._max.floorsReached ?? 0,
    wins,
    totalRuns,
  })
}
