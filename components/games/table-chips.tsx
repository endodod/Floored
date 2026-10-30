import type { CSSProperties } from 'react'
import { formatChips } from '@/utils/format'
import type { DockChip } from '@/components/game-dock-parts'

export function chipFor(amount: number, chips: DockChip[]): DockChip {
  const sorted = [...chips].sort((a, b) => a.value - b.value)
  return sorted.filter((chip) => chip.value <= amount).pop() ?? sorted[0]!
}

export function TableChipLayer<T extends string | number>({
  bets, chips, result, cellFor, isWinning, gridTemplateColumns, gridTemplateRows,
}: {
  bets: Record<string, number>
  chips: DockChip[]
  result: T | null
  cellFor: (target: string) => CSSProperties | null
  isWinning: (result: T, target: string) => boolean
  gridTemplateColumns: string
  gridTemplateRows: string
}) {
  return <div aria-hidden className="pointer-events-none absolute inset-0 z-20 grid gap-px p-px" style={{ gridTemplateColumns, gridTemplateRows }}>
    {Object.entries(bets).map(([target, amount]) => {
      const at = cellFor(target)
      if (!at || amount <= 0) return null
      const chip = chipFor(amount, chips)
      const stacked = amount > chip.value
      const tone = result == null ? 'g-pop' : isWinning(result, target) ? 'g-gold' : 'g-dim'
      return <span key={`${target}-${amount}`} className="relative flex items-center justify-center" style={at}>
        <span className={`chip relative flex aspect-square items-center justify-center font-bold tracking-[-0.04em] tabular-nums ${tone}`} style={{ '--chip': chip.chip, '--chip-ink': chip.ink, width: 'min(calc(var(--cell-h) * 0.92), 2.25rem)', fontSize: 'clamp(6px, calc(var(--cell-h) * 0.27), 10.5px)', boxShadow: stacked ? `0 2px 0 ${chip.chip}, 0 3px 0 rgba(0,0,0,0.5), 0 5px 0 ${chip.chip}, 0 7px 10px rgba(0,0,0,0.6)` : '0 3px 8px rgba(0,0,0,0.6)' } as CSSProperties}>
          {formatChips(amount)}
        </span>
      </span>
    })}
  </div>
}
