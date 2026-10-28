'use client'

import { useEffect, useRef, useState } from 'react'
import type { BlackjackCard } from '@/games/blackjack/types'

export const CARD_BACK_PATTERN = 'repeating-linear-gradient(45deg, #27272a, #27272a 4px, #1f1f23 4px, #1f1f23 8px)'

export const cardShell: React.CSSProperties = {
  width:      'calc(var(--card-h) * 5 / 7)',
  height:     'var(--card-h)',
  flexShrink: 0,
}

export const cardInner: React.CSSProperties = {
  width:  '70%',
  height: '71%',
}

function isRedSuit(suit: string) {
  return suit === '♥' || suit === '♦'
}

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

  if (hidden) {
    return (
      <div
        className={`rounded-xl bg-raised border border-control shadow-2xl flex items-center justify-center overflow-hidden ${animCls}`}
        style={{ ...cardShell, ...dealStyle }}
      >
        <div className="rounded-lg border border-zinc-700" style={{ ...cardInner, background: CARD_BACK_PATTERN }} />
      </div>
    )
  }

  const color = isRedSuit(card.suit) ? 'text-red-600' : 'text-zinc-900'

  return (
    <div
      className={`rounded-xl bg-white shadow-2xl flex flex-col justify-between border border-zinc-200 select-none overflow-hidden ${animCls}`}
      style={{ ...cardShell, ...dealStyle, padding: 'calc(var(--card-h) * 0.07)' }}
    >
      <div className={`flex flex-col items-start leading-none ${color}`}>
        <span className="font-black leading-none" style={{ fontSize: 'calc(var(--card-h) * 0.13)' }}>{card.rank}</span>
        <span className="leading-none"            style={{ fontSize: 'calc(var(--card-h) * 0.11)' }}>{card.suit}</span>
      </div>
      <span
        className={`leading-none self-center ${color}`}
        style={{ fontSize: 'calc(var(--card-h) * 0.35)' }}
      >
        {card.suit}
      </span>
      <div className={`flex flex-col items-start rotate-180 leading-none ${color}`}>
        <span className="font-black leading-none" style={{ fontSize: 'calc(var(--card-h) * 0.13)' }}>{card.rank}</span>
        <span className="leading-none"            style={{ fontSize: 'calc(var(--card-h) * 0.11)' }}>{card.suit}</span>
      </div>
    </div>
  )
}

export function CardBack() {
  return (
    <div
      className="rounded-xl bg-raised border border-control shadow-2xl flex items-center justify-center opacity-40"
      style={cardShell}
    >
      <div className="rounded-lg border border-zinc-700" style={{ ...cardInner, background: CARD_BACK_PATTERN }} />
    </div>
  )
}
