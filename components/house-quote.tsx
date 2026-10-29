'use client'

import { useEffect, useState } from 'react'
import { GAMBLING_QUOTES, pickQuote } from '@/lib/gambling-quotes'

/** A line from the house, drawn at random on each visit; tap it to draw another. */
export function HouseQuote() {
  const [idx, setIdx] = useState<number | null>(null)
  // Drawn after mount so the server render and the client agree.
  useEffect(() => setIdx(pickQuote()), [])

  if (idx == null) return <p className="h-5" aria-hidden />
  return (
    <button
      type="button"
      onClick={() => setIdx((i) => pickQuote(i ?? undefined))}
      title="Draw another"
      className="group flex max-w-full items-baseline gap-2 text-left text-[13px] italic text-dim transition-colors hover:text-soft"
    >
      <span key={idx} className="quote-in truncate">
        &ldquo;{GAMBLING_QUOTES[idx]}&rdquo;
      </span>
      <span aria-hidden className="not-italic text-xs opacity-0 transition-opacity group-hover:opacity-100">
        ↻
      </span>
    </button>
  )
}
