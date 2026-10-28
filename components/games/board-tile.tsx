'use client'
import type { CSSProperties, ReactNode } from 'react'

/**
 * One tile for the grid games (Mines, Dragon Tower, Keno, Chicken Road).
 * Sized by the `--tile` CSS variable; set it on the board from cq units.
 *
 * hidden    face down, playable
 * idle      face down, waiting (no round, or not this row)
 * selected  picked by the player (Keno before the draw)
 * safe      turned up good: felt
 * bad       turned up bad: loss (the mine that was hit)
 * hit       picked and drawn (Keno): gold
 * dormant   turned up at the end without being picked: muted
 */
export type BoardTileState = 'hidden' | 'idle' | 'selected' | 'safe' | 'bad' | 'hit' | 'dormant'

const FACE_UP: BoardTileState[] = ['safe', 'bad', 'hit', 'dormant']

export function BoardTile({
  state,
  onClick,
  disabled,
  index = 0,
  className = '',
  style,
  label,
  children,
}: {
  state: BoardTileState
  onClick?: () => void
  disabled?: boolean
  /** Position in the cascade (diagonal index works well for a grid). */
  index?: number
  className?: string
  style?: CSSProperties
  label?: string
  children?: ReactNode
}) {
  const faceUp = FACE_UP.includes(state)
  // Face-down tiles cascade in; a tile turning up flips (on its own, or in the
  // cascade when the rest of the board turns up at the end).
  const motion = faceUp ? 'g-flip' : state === 'selected' ? '' : 'g-pop'
  const stagger = state === 'dormant' || state === 'hidden' || state === 'idle'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      data-state={state}
      className={`btile m-still ${motion} ${className}`}
      style={{ ...(stagger ? ({ '--i': index } as CSSProperties) : null), ...style }}
    >
      {children}
    </button>
  )
}

/** Drawn marks for a turned-up tile (no emoji in the UI). */
export function TileMark({ kind, className = '' }: { kind: 'gem' | 'mine' | 'flame'; className?: string }) {
  if (kind === 'gem')
    return (
      <svg viewBox="0 0 24 24" className={`btile-mark ${className}`} aria-hidden>
        <path d="M12 2.5 21 12l-9 9.5L3 12z" fill="currentColor" opacity="0.9" />
        <path d="M12 2.5 16.5 12 12 21.5 7.5 12z" fill="#fff" opacity="0.22" />
      </svg>
    )
  if (kind === 'flame')
    return (
      <svg viewBox="0 0 24 24" className={`btile-mark ${className}`} aria-hidden>
        <path
          d="M12 2c1 3.6 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.2-4 2.4-5.2.2 1.7.9 2.8 2 3.3C10.6 8.6 11 5.2 12 2z"
          fill="currentColor"
        />
        <path d="M12 13.5c.6 1.4 2.2 2.2 2.2 4a2.2 2.2 0 0 1-4.4 0c0-1.5 1.4-2.3 2.2-4z" fill="#fff" opacity="0.3" />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" className={`btile-mark ${className}`} aria-hidden>
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </g>
      <circle cx="12" cy="12" r="6" fill="currentColor" />
      <circle cx="10" cy="10" r="1.6" fill="#fff" opacity="0.45" />
    </svg>
  )
}
