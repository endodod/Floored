import type { CSSProperties, ReactNode } from 'react'

interface ModeRowProps {
  name: string
  symbol: string
  description: string
  track: ReactNode
  trackCaption: ReactNode
  figureLabel: string
  figure: ReactNode
  figureSub?: ReactNode
  action: ReactNode
  index: number
}

/** One mode as a ledger row: what it is, where you are on its track, its money, the way in. */
export function ModeRow({ name, symbol, description, track, trackCaption, figureLabel, figure, figureSub, action, index }: ModeRowProps) {
  return (
    <li
      className="rise group relative grid grid-cols-1 gap-4 px-4 py-5 transition-colors duration-300 hover:bg-[#17161c] sm:px-6 lg:grid-cols-[minmax(0,1fr)_220px_168px_148px] lg:items-center lg:gap-8"
      style={{ '--d': `${120 + index * 70}ms` } as CSSProperties}
    >
      {/* the felt edge that lights up on the row you are about to pick */}
      <span
        aria-hidden
        className="m-instant absolute bottom-4 left-0 top-4 w-[2px] origin-center scale-y-0 bg-felt shadow-[0_0_12px_rgba(79,174,132,0.9)] transition-transform duration-300 group-hover:scale-y-100"
      />
      <div className="min-w-0">
        <h2 className="flex items-baseline gap-2 text-[17px] font-semibold leading-snug text-ink">
          <span aria-hidden className="text-[15px] leading-none opacity-85">{symbol}</span>
          {name}
        </h2>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-5 text-dim">{description}</p>
      </div>
      <div className="flex flex-col gap-2">
        {track}
        <p className="text-xs tabular-nums text-soft">{trackCaption}</p>
      </div>
      <div className="flex items-baseline justify-between gap-3 lg:block lg:text-right">
        <p className="text-xs text-dim">{figureLabel}</p>
        <p className="num text-xl leading-7 text-ink lg:mt-0.5">{figure}</p>
        {figureSub && <p className="text-xs tabular-nums text-dim lg:mt-0.5">{figureSub}</p>}
      </div>
      <div className="lg:justify-self-end">{action}</div>
    </li>
  )
}

/** The ledger list the mode rows sit in. */
export function ModeRowList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <ul className={`divide-y divide-rule overflow-hidden rounded-md bg-surface shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] ${className}`}>
      {children}
    </ul>
  )
}
