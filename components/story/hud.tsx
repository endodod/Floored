'use client'

import Link from 'next/link'
import { forwardRef, type ReactNode } from 'react'
import { ChevronLeft, Star } from 'lucide-react'
import { CITY_BY_ID } from '@/lib/story/cities'
import { NIGHT_BETS, STANDING_BONUS, STANDING_MAX } from '@/lib/story/economy'
import { useStoryStore, VENUE_NAMES } from '@/store/story-store'
import { cn } from '@/lib/utils'
import { formatChips } from '@/utils/format'

const money = (n: number) => `$${formatChips(n)}`

/** A short stack of chips: the money figure's icon. */
function ChipStack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5 shrink-0', className)} aria-hidden>
      {[
        { y: 17, c: '#2a7a57' },
        { y: 12.5, c: '#a92b42' },
        { y: 8, c: '#d9a441' },
      ].map(({ y, c }) => (
        <g key={y}>
          <ellipse cx="12" cy={y + 2} rx="9" ry="3.2" fill="#000" opacity="0.45" />
          <rect x="3" y={y - 1.6} width="18" height="3.4" fill={c} />
          <ellipse cx="12" cy={y + 1.8} rx="9" ry="3.2" fill={c} />
          <ellipse cx="12" cy={y - 1.6} rx="9" ry="3.2" fill={c} stroke="#fbfaf6" strokeWidth="0.9" strokeDasharray="2.2 2.6" />
        </g>
      ))}
    </svg>
  )
}

/** Standing in a town, as a row of STANDING_MAX stars. */
export function StandingStars({ standing, city, className }: { standing: number; city?: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-[1px]', className)}
      role="img"
      aria-label={`Standing ${standing} of ${STANDING_MAX}${city ? ` in ${city}` : ''}`}
    >
      {Array.from({ length: STANDING_MAX }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn('h-[11px] w-[11px] sm:h-3 sm:w-3', i < standing ? 'fill-gold text-gold drop-shadow-[0_0_4px_rgba(217,164,65,0.6)]' : 'fill-transparent text-[#5a4a2e]')}
          strokeWidth={2}
        />
      ))}
    </span>
  )
}

const PLAQUE = 'rounded-[5px] bg-black/45 shadow-[inset_0_0_0_1px_rgba(217,164,65,0.3)]'

/** A HUD button: a dark brass-ruled square with an icon, the label shown from sm up. */
export const HudButton = forwardRef<HTMLButtonElement, { icon: ReactNode; label: string; badge?: number; active?: boolean; onClick: () => void; disabled?: boolean }>(
  function HudButton({ icon, label, badge, active, onClick, disabled }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={badge ? `${label} (${badge})` : label}
        aria-expanded={active}
        className={cn(
          PLAQUE,
          'relative flex h-10 min-w-10 items-center justify-center gap-1.5 px-2 text-[12px] font-semibold text-soft transition-colors hover:text-ink hover:shadow-[inset_0_0_0_1px_rgba(217,164,65,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold disabled:opacity-40 sm:px-2.5',
          active && 'text-ink shadow-[inset_0_0_0_1px_rgba(217,164,65,0.8)]',
        )}
      >
        <span aria-hidden className="[&_svg]:h-[17px] [&_svg]:w-[17px]">{icon}</span>
        <span className="hidden md:inline">{label}</span>
        {badge ? (
          <span aria-hidden className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </button>
    )
  },
)

/**
 * The story HUD: the city and night on a wood title plate, money as a chip
 * stack, the marker in red when one is owed, standing in this town as stars and,
 * while a night is on, the bets left; at a game, the table min / max. `back` adds a link back to the city scene;
 * `actions` sits at the right (the hub's Jobs, Map and menu buttons).
 */
export function StoryHud({
  back,
  title,
  table,
  actions,
  className,
}: {
  back?: boolean
  title?: string
  /** A house game's table limits, shown beside standing and bets left (from sm up). `max` null: no limit. */
  table?: { min: number; max: number | null }
  actions?: ReactNode
  className?: string
}) {
  const cityId = useStoryStore((s) => s.city)
  const night = useStoryStore((s) => s.night)
  const moneyNow = useStoryStore((s) => s.money)
  const owed = useStoryStore((s) => s.owed)
  const rep = useStoryStore((s) => s.rep())
  const tonight = useStoryStore((s) => s.tonight)
  const city = CITY_BY_ID.get(cityId)!
  const betsLeft = tonight ? Math.max(0, (tonight.limit ?? NIGHT_BETS) - tonight.bets) : null
  const low = moneyNow < city.minBet
  const bonus = STANDING_BONUS[rep] ?? 0

  const backEl = back && (
    <Link
      href="/story"
      className={cn(PLAQUE, 'flex h-10 shrink-0 items-center gap-0.5 pl-1 pr-2 text-[12px] font-semibold text-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold')}
      aria-label={`Back to ${city.name}`}
    >
      <ChevronLeft aria-hidden className="h-4 w-4" />
      <span className="hidden sm:inline">{city.name}</span>
      <span className="sm:hidden">Back</span>
    </Link>
  )
  const plateEl = (
    <div className="st-plate-wood flex h-10 min-w-0 shrink flex-col justify-center rounded-[5px] px-2.5 sm:px-3">
      <p className="truncate text-[14px] font-bold leading-[17px] tracking-[0.02em] text-[#f7eed6] sm:text-[15px]">{title ?? city.name}</p>
      <p className="flex items-center gap-1.5 whitespace-nowrap text-[10.5px] font-semibold uppercase leading-[13px] tracking-[0.12em] text-[#d9b779]">
        <span className="num">Night {night + 1}</span>
        {tonight && <span className="hidden lg:inline">· {VENUE_NAMES[tonight.venue]}</span>}
        <StandingStars standing={rep} city={city.name} className="lg:hidden" />
      </p>
    </div>
  )
  const moneyEl = (
    <div className={cn(PLAQUE, 'flex h-10 shrink-0 items-center gap-1.5 pl-1.5 pr-2.5')} aria-label={`Money ${money(moneyNow)}${owed > 0 ? `, owed ${money(owed)}` : ''}`} role="group">
      <ChipStack />
      <span className="flex flex-col justify-center leading-none">
        <span className={cn('num text-[15px] font-bold sm:text-base', low ? 'text-loss' : 'text-gold glow-gold')}>{money(moneyNow)}</span>
        {owed > 0 && <span className="num mt-0.5 text-[10px] font-semibold text-loss">owe {money(owed)}</span>}
      </span>
    </div>
  )
  const standingEl = (
    <div
      className={cn(PLAQUE, 'hidden h-10 shrink-0 flex-col items-center justify-center gap-0.5 px-2.5 lg:flex')}
      role="group"
      aria-label={`Standing in ${city.name}${bonus ? `, ${Math.round(bonus * 100)}% bonus on a night up` : ''}`}
    >
      <span className="felt-print block max-w-[240px] truncate !text-[9px] !tracking-[0.1em]" title={`Standing in ${city.name}`}>
        Standing in {city.name}
      </span>
      <span className="flex items-center gap-1.5">
        <StandingStars standing={rep} city={city.name} />
        {bonus > 0 && (
          <span className="num text-[10.5px] font-bold leading-none text-gold" title={`A night up at the tables earns ${Math.round(bonus * 100)}% of the win on top`}>
            +{Math.round(bonus * 100)}%
          </span>
        )}
      </span>
    </div>
  )
  const betsEl = betsLeft != null && (
    <div className={cn(PLAQUE, 'hidden h-10 shrink-0 flex-col items-center justify-center px-2.5 sm:flex')} aria-label={`${betsLeft} of ${tonight?.limit ?? NIGHT_BETS} bets left tonight`} role="group">
      <span className={cn('num text-[15px] font-bold leading-none', betsLeft === 0 ? 'text-loss' : 'text-ink')}>{betsLeft}</span>
      <span className="felt-print mt-0.5 !text-[9px] !tracking-[0.14em]">bets left</span>
    </div>
  )

  // At a house game: the back link at the left, standing at the right, and the
  // game, money, bets left and table limits centred between them.
  if (table) {
    return (
      <header className={cn('st-hud relative z-30 flex h-[52px] shrink-0 items-center gap-1.5 px-2 sm:gap-2.5 sm:px-3', className)}>
        {backEl}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2.5">
          {plateEl}
          {moneyEl}
          {betsEl}
          <div
            className={cn(PLAQUE, 'hidden h-10 shrink-0 flex-col items-center justify-center px-2.5 sm:flex')}
            role="group"
            aria-label={`Table min ${money(table.min)}, max ${table.max == null ? 'none' : money(table.max)}`}
          >
            <span className="num text-[15px] font-bold leading-none text-ink">
              {formatChips(table.min)} / {table.max == null ? 'None' : formatChips(table.max)}
            </span>
            <span className="felt-print mt-0.5 !text-[9px] !tracking-[0.14em]">Table min / max</span>
          </div>
        </div>
        {standingEl}
      </header>
    )
  }

  return (
    <header className={cn('st-hud relative z-30 flex h-[52px] shrink-0 items-center gap-1.5 px-2 sm:gap-2.5 sm:px-3', className)}>
      {backEl}
      {plateEl}
      {moneyEl}
      {standingEl}
      {betsEl}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>
    </header>
  )
}
