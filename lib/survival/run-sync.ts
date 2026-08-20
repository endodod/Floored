import type { RunSummary } from '@/store/types'
import type { DiceConfig } from '@/store/types'

/** Builds the POST /api/run body from a just-concluded run's summary. Returns null if the
 *  summary is missing fields required to persist it (e.g. state saved before this feature shipped). */
export function buildRunSyncPayload(lastRun: RunSummary, diceConfig: DiceConfig) {
  if (!lastRun.seed || !lastRun.startedAt || !lastRun.difficulty) return null

  return {
    difficulty: lastRun.difficulty,
    seed: lastRun.seed,
    startedAt: lastRun.startedAt,
    endedAt: lastRun.endedAt,
    endBankroll: lastRun.endBankroll,
    peakBankroll: lastRun.peakBankroll,
    floorsReached: lastRun.floorsReached,
    gamesPlayed: lastRun.gamesPlayed,
    victory: lastRun.victory ?? false,
    diceWinSums: diceConfig.win,
    diceLossSums: diceConfig.loss,
    results: lastRun.results.map((r) => ({
      game: r.game,
      floor: r.floor,
      betAmount: r.betAmount,
      payout: r.payout,
      outcome: r.outcome,
      multiplier: r.multiplier ?? null,
      playedAt: new Date(r.playedAt).toISOString(),
    })),
  }
}
