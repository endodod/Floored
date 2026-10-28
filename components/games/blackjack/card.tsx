'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { BlackjackCard } from '@/games/blackjack/types'
import { PlayingCard } from '@/components/games/playing-card'

/** A dealt card: deals in from the shoe, turns face up when the dealer's hole card is revealed. */
export function CardFace({
  card,
  hidden = false,
  index = 0,
  className,
  style,
}: {
  card: BlackjackCard
  hidden?: boolean
  /** Position in the hand: staggers the deal. */
  index?: number
  className?: string
  style?: CSSProperties
}) {
  const prevHidden = useRef(hidden)
  const [animCls, setAnimCls] = useState<'g-deal' | 'g-flip' | ''>('g-deal')

  useEffect(() => {
    if (prevHidden.current && !hidden) {
      setAnimCls('g-flip')
      prevHidden.current = false
      const t = setTimeout(() => setAnimCls(''), 350)
      return () => clearTimeout(t)
    }
    prevHidden.current = hidden
  }, [hidden])

  return (
    <PlayingCard
      variant={hidden ? 'back' : 'face'}
      rank={card.rank}
      suit={card.suit}
      className={`${animCls} ${className ?? ''}`}
      style={{ ...(animCls === 'g-deal' ? { '--i': index } : {}), ...style } as CSSProperties}
    />
  )
}

/** Where a card will land, before the deal: a dashed spot on the felt. */
export function CardBack({ style }: { style?: CSSProperties }) {
  return <PlayingCard variant="slot" style={style} />
}
