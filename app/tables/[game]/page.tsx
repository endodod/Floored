import { notFound } from 'next/navigation'
import { TABLES_ENABLED } from '@/lib/features'
import { TABLE_GAME_REGISTRY } from '@/lib/tables/registry'
import type { TableGameName } from '@/lib/tables/types'

export default async function TableGamePage({ params }: { params: Promise<{ game: string }> }) {
  if (!TABLES_ENABLED) notFound()
  const { game } = await params
  const Game = TABLE_GAME_REGISTRY[game as TableGameName]
  if (!Game) notFound()
  return <Game />
}
