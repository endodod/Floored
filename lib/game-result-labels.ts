import type { MatchHistoryEntry, MatchHistoryTone } from '@/components/game-match-history'
import { formatChips, formatMultiplier } from '@/utils/format'

export interface GameRoundAmounts {
  betAmount: number
  payout: number
  outcome: 'win' | 'loss' | 'push'
}

export interface GamePendingResult {
  tone: 'win' | 'loss'
  betSummary: string
  resultSummary: string
  profitLabel: string
  multiplierHint?: string
  entry: MatchHistoryEntry
}

/** Separator between primary value and specification (all outcome UIs). */
export const BET_LINE_SEP = ' · '

/** Plinko pyramid risk label for current-bet / history specs. */
export function formatPlinkoRiskLabel(risk: 'low' | 'medium' | 'high'): string {
  return `${risk.charAt(0).toUpperCase()}${risk.slice(1)} risk`
}

/** Replace color emoji/symbols with written color names for outcome UI. */
export function formatOutcomeDisplayText(text: string): string {
  return text
    .replace(/🔴\s*/g, 'Red ')
    .replace(/⚫\s*/g, 'Black ')
    .replace(/🟢\s*/g, 'Green ')
    .replace(/🔥\s*/g, 'Red ')
    .replace(/💎\s*/g, 'Blue ')
    .replace(/🍀\s*/g, 'Green ')
    .replace(/⭐\s*/g, 'Gold ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSeparators(text: string): string {
  return text.replace(/\s*[-–|]\s*/g, BET_LINE_SEP).replace(/\s+/g, ' ').trim()
}

/**
 * Unified outcome line: `primary · specification` (e.g. `25 · Red`, `36 · Red`).
 * Single-token lines pass through unchanged.
 */
export function formatOutcomeLine(primary: string, specification?: string): string {
  const p = normalizeSeparators(formatOutcomeDisplayText(primary))
  const raw = specification?.trim()
  if (!raw) return p

  const spec = normalizeSeparators(formatOutcomeDisplayText(raw))
  if (!spec || spec === p) return p
  if (p.includes(BET_LINE_SEP)) return normalizeSeparators(`${p}${BET_LINE_SEP}${spec}`)
  return `${p}${BET_LINE_SEP}${spec}`
}

/** Normalize legacy result strings to `primary · specification`. */
export function normalizeOutcomeLine(text: string): string {
  const t = normalizeSeparators(formatOutcomeDisplayText(text))
  if (t.includes(BET_LINE_SEP)) return t

  const colorNum = t.match(/^(Red|Black|Green)\s+(\d+)$/i)
  if (colorNum) return `${colorNum[2]}${BET_LINE_SEP}${colorNum[1]}`

  const roll = t.match(/^Roll\s+(\d+)$/i)
  if (roll) return `${roll[1]}${BET_LINE_SEP}Roll`

  const cashed = t.match(/^Cashed at\s+(.+)$/i)
  if (cashed) return `${cashed[1]}${BET_LINE_SEP}Cashed`

  const crashed = t.match(/^Crashed at\s+(.+)$/i)
  if (crashed) return `${crashed[1]}${BET_LINE_SEP}Crashed`

  const floor = t.match(/^Floor\s+(\d+)$/i)
  if (floor) return `${floor[1]}${BET_LINE_SEP}Floor`

  const hits = t.match(/^(\d+)\/(\d+)\s+hits$/i)
  if (hits) return `${hits[1]}/${hits[2]}${BET_LINE_SEP}hits`

  return t
}

/** Outcome "Your bet": `$25 · Red`, `$25 · Black 6`, or `$25`. */
export function formatBetSummary(betAmount: number, specification?: string): string {
  const amount = formatChips(betAmount)
  const raw = specification?.trim()
  if (!raw) return amount

  const spec = formatOutcomeDisplayText(raw)
  if (spec.includes('$') || spec.startsWith(amount)) {
    return normalizeSeparators(spec)
  }
  return formatOutcomeLine(amount, spec)
}

/** Single-line active bet — same as "Your bet". */
export function formatCurrentBetLine(betAmount: number, specification?: string): string {
  return formatBetSummary(betAmount, specification)
}

/** Outcome "Result": `36 · Red`, `2.50× · Cashed`, etc. */
export function formatResultSummary(primary: string, specification?: string): string {
  if (specification?.trim()) return formatOutcomeLine(primary, specification)
  return normalizeOutcomeLine(primary)
}

/** Net profit/loss for settled dock display. */
export function formatNetProfitDisplay(
  payout: number,
  betAmount: number,
  outcome: GameRoundAmounts['outcome'],
): string {
  if (outcome === 'push') return '0'
  const net = payout - betAmount
  if (net > 0) return `+${formatChips(net)}`
  if (net < 0) return `−${formatChips(-net)}`
  return '0'
}

/** Match history title: net profit/loss. */
export function formatHistoryNetTitle(payout: number, betAmount: number, outcome: GameRoundAmounts['outcome']) {
  if (outcome === 'push') return '0'
  const net = payout - betAmount
  if (outcome === 'win' && net === 0 && payout > 0) return formatChips(payout)
  if (net > 0) return `+${formatChips(net)}`
  if (net < 0) return `−${formatChips(-net)}`
  return '0'
}

export function formatSettledMultiplierHint(
  gameMultiplier?: number,
  payoutBoostMult?: number,
): string | undefined {
  const parts: string[] = []
  if (gameMultiplier != null && gameMultiplier > 0) {
    parts.push(formatMultiplier(gameMultiplier))
  }
  if (payoutBoostMult != null && payoutBoostMult > 1) {
    parts.push(`${formatMultiplier(payoutBoostMult)} boost`)
  }
  return parts.length > 0 ? parts.join(BET_LINE_SEP) : undefined
}

export function buildPendingResult(
  amounts: GameRoundAmounts,
  detail: {
    result: string
    resultSpecification?: string
    bet?: string
    betSpecification?: string
  },
  options?: {
    historySubtitle?: string
    gameMultiplier?: number
    payoutBoostMult?: number
    freeBet?: boolean
  },
): GamePendingResult {
  const betSummary = formatOutcomeDisplayText(
    detail.bet ?? formatBetSummary(amounts.betAmount, detail.betSpecification),
  )
  const resultSummary = formatResultSummary(detail.result, detail.resultSpecification)
  const isFreeBet = options?.freeBet === true
  const net = amounts.payout - amounts.betAmount
  const tone: 'win' | 'loss' = isFreeBet ? 'win' : net >= 0 ? 'win' : 'loss'
  const historyTone: MatchHistoryTone =
    amounts.outcome === 'win' || amounts.outcome === 'push'
      ? 'win'
      : amounts.outcome === 'loss'
        ? 'loss'
        : amounts.payout > amounts.betAmount
          ? 'win'
          : 'loss'
  const freeBetWin = isFreeBet && amounts.outcome === 'win' && amounts.payout > 0
  const title = isFreeBet
    ? freeBetWin ? `+${formatChips(amounts.payout)}` : 'Free bet'
    : formatHistoryNetTitle(amounts.payout, amounts.betAmount, amounts.outcome)
  const profitLabel = isFreeBet
    ? freeBetWin ? `+${formatChips(amounts.payout)}` : 'Free bet'
    : formatNetProfitDisplay(amounts.payout, amounts.betAmount, amounts.outcome)
  const multiplierHint = formatSettledMultiplierHint(options?.gameMultiplier, options?.payoutBoostMult)
  const subtitle =
    options?.historySubtitle != null
      ? normalizeOutcomeLine(formatOutcomeDisplayText(options.historySubtitle))
      : `${betSummary} → ${resultSummary}`

  return {
    tone,
    betSummary,
    resultSummary,
    profitLabel,
    multiplierHint,
    entry: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      at: new Date(),
      title,
      subtitle,
      tone: historyTone,
      betSummary,
      resultSummary,
      profitLabel,
      profitTone: tone,
    },
  }
}
