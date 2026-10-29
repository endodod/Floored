'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { GAME_REGISTRY } from '@/lib/game-registry'
import { useFreeplayGameBankroll } from '@/hooks/use-game-bankroll'
import type { GameName } from '@/store/types'

export default function FreeplayGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = use(params)
  const { bankroll, handleBet, handleResolve } = useFreeplayGameBankroll()

  const GameComponent = GAME_REGISTRY[game as GameName]
  if (!GameComponent) notFound()

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <GameComponent mode="freeplay" bankroll={bankroll} onBet={handleBet} onResolve={handleResolve} />
    </div>
  )
}
