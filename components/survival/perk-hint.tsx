'use client'

interface PerkHintProps {
  children: React.ReactNode
  className?: string
  /** When false, hint is hidden (perk owned but did not proc this bet). */
  active?: boolean
}

/** Banner when a survival perk proc’d for the current bet. */
export function PerkHint({ children, className = '', active = true }: PerkHintProps) {
  if (!active) return null

  return (
    <p
      className={`unit-current rounded-full bg-felt-tint px-3 py-1 text-center text-xs font-semibold text-felt ${className}`}
    >
      Perk active · {children}
    </p>
  )
}
