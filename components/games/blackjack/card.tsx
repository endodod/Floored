'use client'

import { useEffect, useRef, useState } from 'react'
import type { BlackjackCard } from '@/games/blackjack/types'
import { PlayingCard } from '@/components/games/playing-card'

/** A dealt card: slides in on deal, flips up when the dealer's hole card is revealed. */
export function CardFace({
  card,
  hidden = false,
  animDelay = 0,
}: {
  card: BlackjackCard
  hidden?: boolean
  animDelay?: number
}) {
  const prevHidden = useRef(hidden)
  const [animCls, setAnimCls] = useState<'card-deal-in' | 'card-reveal' | ''>('card-deal-in')

  useEffect(() => {
    if (prevHidden.current && !hidden) {
      setAnimCls('card-reveal')
      prevHidden.current = false
      const t = setTimeout(() => setAnimCls(''), 350)
      return () => clearTimeout(t)
    }
    prevHidden.current = hidden
  }, [hidden])

  const dealStyle = animCls === 'card-deal-in' ? { animationDelay: `${animDelay}ms` } : {}

  return (
    <PlayingCard
      variant={hidden ? 'back' : 'face'}
      rank={card.rank}
      suit={card.suit}
      className={animCls}
      style={dealStyle}
    />
  )
}

/** Where a card will land, before the deal: a dashed spot on the felt. */
export function CardBack() {
  return <PlayingCard variant="slot" />
}
