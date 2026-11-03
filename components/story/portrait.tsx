import { useId, useMemo } from 'react'
import { CHARACTER_BY_ID } from '@/lib/story/content/characters'
import { portraitSvg, type Expression, type PortraitLook } from '@/lib/story/portraits'

interface PortraitProps {
  look: PortraitLook
  expression?: Expression
  /** Width in px; height follows the 200x240 aspect. Omit to fill the container width. */
  size?: number
  className?: string
}

/** A character portrait (warm noir chip). The SVG is generated locally, never user input. */
export function Portrait({ look, expression = 'neutral', size, className }: PortraitProps) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const svg = useMemo(
    () => portraitSvg(look, expression, { size, idPrefix: `pt-${look}-${expression}-${uid}` }),
    [look, expression, size, uid],
  )
  const name = CHARACTER_BY_ID.get(look)?.name ?? look
  return (
    <span
      role="img"
      aria-label={`${name}, ${expression}`}
      className={className}
      style={{ display: 'inline-block', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
