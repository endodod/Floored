import type { LadderLastResult } from '@/store/ladder-store'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { formatMultiplier } from '@/lib/daily/share'
import { formatChips } from '@/utils/format'
import { CHECKPOINT_EVERY } from '@/lib/ladder/rules'

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
    case 'reset':
      return {
        title: 'Run reset',
        body: `${got} on ${label} — no profit before the first checkpoint, so the run starts over with ${formatChips(state.pot)}. Lives only count from checkpoint ${CHECKPOINT_EVERY}.`,
        tone: 'bad',
      }
    case 'failed':
      return {
        title: 'Daily ladder failed',
        body: `${got} on ${label} — no profit before checkpoint ${CHECKPOINT_EVERY}, so today's climb is over with nothing banked. A new ladder opens at 00:00 UTC.`,
        tone: 'bad',
      }
    case 'out':
      return { title: 'Out of lives', body: `${got} on ${label} — no profit. You bank your last checkpoint: ${formatChips(state.finalPot)}.`, tone: 'bad' }
  }
}
