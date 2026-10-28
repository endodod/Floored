import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One playing card for every card game (Blackjack, HiLo, Poker). Sized by the
 * `--card-h` custom property (set it on the card or any ancestor); the width
 * follows at a 5:7 ratio and every mark inside scales with the height.
 *
 * - face: ivory stock, ranks and suits in the corners, the suit large in the middle
 * - back: felt green with a gold lattice and inner frame
 * - slot: a dashed spot printed on the felt where a card will land
 */
export type CardSuit = '♠' | '♥' | '♦' | '♣' | string

const TEXT_SUIT: Record<string, string> = { '♠': '♠︎', '♥': '♥︎', '♦': '♦︎', '♣': '♣︎' }

export function isRedSuit(suit: CardSuit) {
  return suit === '♥' || suit === '♦'
}

export function PlayingCard({
  rank,
  suit,
  variant = 'face',
  height,
  className,
  style,
  children,
}: {
  rank?: string
  suit?: CardSuit
  variant?: 'face' | 'back' | 'slot'
  /** CSS length for the card height; defaults to the inherited --card-h. */
  height?: string
  className?: string
  style?: CSSProperties
  /** Overlay content (a "Held" tag, a highlight ring). */
  children?: ReactNode
}) {
  const sizing = (height ? { '--card-h': height } : {}) as CSSProperties

  if (variant === 'slot') {
    return <div className={cn('pcard pcard-slot', className)} style={{ ...sizing, ...style }} aria-hidden />
  }
  if (variant === 'back' || !rank || !suit) {
    return (
      <div className={cn('pcard pcard-back', className)} style={{ ...sizing, ...style }} aria-label="Face-down card">
        <span className="pcard-back-emblem" aria-hidden />
        {children}
      </div>
    )
  }

  const glyph = TEXT_SUIT[suit] ?? suit
  const label = `${rank} of ${{ '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' }[suit as string] ?? suit}`
  return (
    <div
      className={cn('pcard pcard-face', isRedSuit(suit) && 'pcard-red', className)}
      style={{ ...sizing, ...style }}
      role="img"
      aria-label={label}
    >
      <span className="pcard-corner">
        <span className="pcard-rank">{rank}</span>
        <span className="pcard-suit">{glyph}</span>
      </span>
      <span className="pcard-pip" aria-hidden>
        {glyph}
      </span>
      <span className="pcard-corner pcard-corner-flip" aria-hidden>
        <span className="pcard-rank">{rank}</span>
        <span className="pcard-suit">{glyph}</span>
      </span>
      {children}
    </div>
  )
}
