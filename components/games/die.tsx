export type DieTone = 'neutral' | 'win' | 'loss'

// Pip positions on a 3×3 grid (0 = top left, 8 = bottom right).
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** An ivory die with drawn pips, sized by --die (Run Dice, Liar's Dice). */
export function Die({ value, tone = 'neutral', className = '' }: { value: number | null | undefined; tone?: DieTone; className?: string }) {
  const pips = PIPS[value ?? 0] ?? []
  return (
    <div className={`rd-die relative ${tone === 'win' ? 'g-win' : ''} ${className}`} data-tone={tone} aria-label={value ? `Die showing ${value}` : 'Die'}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'rd-pip' : ''} />
      ))}
    </div>
  )
}
