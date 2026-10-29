'use client'

interface PerkHintProps {
  children: React.ReactNode
  className?: string
  /** When false, hint is hidden (perk owned but did not proc this bet). */
  active?: boolean
}

/**
 * Pill for a survival perk that proc'd this bet. It sits in the game's status bar,
 * between the name and the message, so it never covers the board or its badges.
 */
export function PerkHint({ children, className = '', active = true }: PerkHintProps) {
  if (!active) return null

  return (
    <p
      className={`unit-current min-w-0 truncate rounded-full bg-felt-tint px-3 py-0.5 text-xs font-semibold text-felt ${className}`}
    >
      Perk active · {children}
    </p>
  )
}
