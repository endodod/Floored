import type { GameName } from '@/store/types'
import { GAME_MAX_MULT, formatMaxMult } from '@/lib/ladder/rules'

/** The most one round of a game can pay, as a lobby caption: "up to 30×", the figure in mono. */
export function PayoutCaption({ game, className = 'text-xs text-soft' }: { game: GameName; className?: string }) {
  if (GAME_MAX_MULT[game] == null) return <span className={`shrink-0 ${className}`}>payout varies</span>
  return (
    <span className={`shrink-0 ${className}`}>
      up to <span className="num text-ink">{formatMaxMult(game)}</span>
    </span>
  )
}
