import type { LadderLastResult } from '@/store/ladder-store'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { formatMultiplier } from '@/lib/daily/share'
import { formatChips } from '@/utils/format'

/** Title + body for the result of the last settled round, read against the state it left behind. */
export function describeLadderResult(
  result: LadderLastResult,
  state: { rung: number; pot: number; lives: number; finalPot: number },
): { title: string; body: string; tone: 'good' | 'bad' | 'neutral' } {
  const label = GAME_BY_NAME.get(result.game)?.label ?? result.game
  const got = formatMultiplier(result.multiplier)

  switch (result.kind) {
    case 'clear':
      return { title: `Rung ${state.rung} cleared`, body: `${got} on ${label} — pot is now ${formatChips(state.pot)}.`, tone: 'good' }
    case 'checkpoint':
      return {
        title: `Checkpoint ${state.rung} reached`,
        body: `${got} on ${label}. ${formatChips(state.pot)} is saved — a fall brings you back here.`,
        tone: 'good',
      }
    case 'topped':
      return { title: 'You topped the ladder!', body: `${got} on ${label}. Final pot with bonus: ${formatChips(state.finalPot)}.`, tone: 'good' }
    case 'push':
      return { title: 'Push', body: `${label} returned your stake. Play the rung again.`, tone: 'neutral' }
    case 'fall':
      return {
        title: 'You fell',
        body: `${got} on ${label} — no profit. Back to ${state.rung === 0 ? 'the ground' : `checkpoint ${state.rung}`} with ${formatChips(state.pot)} — ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left. Games used since the checkpoint are free again.`,
        tone: 'bad',
      }
    case 'out':
      return { title: 'Out of lives', body: `${got} on ${label} — no profit. You bank your last checkpoint: ${formatChips(state.finalPot)}.`, tone: 'bad' }
  }
}
