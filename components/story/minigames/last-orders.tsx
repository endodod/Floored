'use client'

import { useEffect, useRef, useState } from 'react'
import { GAME_BOARD_ARENA, GAME_CONTROL_DOCK, GAME_STATUS_BAR } from '@/components/game-layout'
import { DRINKS, ROUNDS, score, start, tap, type LastOrdersState } from '@/lib/story/minigames/last-orders'

const SHOW_MS = 650
const GAP_MS = 220
const LEAD_MS = 700
const END_MS = 1100

type Phase = 'lead' | 'show' | 'input' | 'done'

/** Marta's bar: watch the order, tap it back. One mistake ends the shift. */
export function LastOrdersBoard({ onFinish }: { onFinish: (score: number) => void }) {
  const [game, setGame] = useState<LastOrdersState>(() => start(Math.random))
  const [phase, setPhase] = useState<Phase>('lead')
  const [lit, setLit] = useState<number | null>(null)
  const [flash, setFlash] = useState<'ok' | 'miss' | null>(null)
  const finished = useRef(false)

  // Lead-in, then show the order one drink at a time.
  useEffect(() => {
    if (game.over) return
    setPhase('lead')
    setLit(null)
    const timers: ReturnType<typeof setTimeout>[] = []
    let t = LEAD_MS
    game.order.forEach((d, i) => {
      timers.push(setTimeout(() => { setPhase('show'); setLit(d) }, t))
      timers.push(setTimeout(() => setLit(null), t + SHOW_MS))
      t += SHOW_MS + GAP_MS
      if (i === game.order.length - 1) timers.push(setTimeout(() => setPhase('input'), t))
    })
    return () => timers.forEach(clearTimeout)
  }, [game.order, game.over])

  const finish = (s: LastOrdersState) => {
    if (finished.current) return
    finished.current = true
    setPhase('done')
    setTimeout(() => onFinish(score(s)), END_MS)
  }

  const press = (d: number) => {
    if (phase !== 'input') return
    const { state, result } = tap(game, d, Math.random)
    setLit(d)
    setTimeout(() => setLit(null), 180)
    if (result === 'miss') { setFlash('miss'); setGame(state); finish(state); return }
    if (result === 'win') { setFlash('ok'); setGame(state); finish(state); return }
    if (result === 'round') setFlash('ok')
    setGame(state)
  }

  const headline =
    phase === 'lead' ? `Order ${game.round + 1}: ${game.order.length} drinks` :
    phase === 'show' ? 'Watch' :
    phase === 'input' ? 'Your turn' :
    flash === 'miss' ? 'Wrong drink. Shift over.' : 'Shift done'
  const big = lit != null ? DRINKS[lit]!.glyph : phase === 'done' && flash === 'miss' ? '✕' : ''

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line" data-testid="last-orders">
      <div className={GAME_STATUS_BAR}>
        <span className="num text-[13px] text-soft">Order {Math.min(game.round + 1, ROUNDS)} of {ROUNDS}</span>
        <span className="num text-[13px] text-dim">{game.cleared} cleared</span>
      </div>
      <div className={`${GAME_BOARD_ARENA} flex flex-col items-center justify-center gap-4 px-4`}>
        <p className="text-sm font-semibold text-ink" aria-live="polite" data-testid="lo-headline">{headline}</p>
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-md bg-ground/60 text-5xl shadow-[inset_0_0_0_1px_var(--line)] ${flash === 'miss' && phase === 'done' ? 'text-loss' : ''}`}
          aria-hidden
        >
          {big}
        </div>
        <ol className="flex flex-wrap justify-center gap-1.5" aria-label="Order progress">
          {game.order.map((_, i) => (
            <li
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${i < game.pos ? 'bg-felt' : 'bg-control'}`}
            />
          ))}
        </ol>
      </div>
      <div className={`${GAME_CONTROL_DOCK} py-3`}>
        <div className="mx-auto grid max-w-[420px] grid-cols-3 gap-2">
          {DRINKS.map((d, i) => (
            <button
              key={d.id}
              type="button"
              disabled={phase !== 'input'}
              onClick={() => press(i)}
              aria-label={d.label}
              data-drink={i}
              className={`flex h-16 items-center justify-center rounded-md border text-3xl transition-colors duration-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-felt ${
                lit === i ? 'border-gold bg-gold-tint' : 'border-line bg-raised hover:border-control'
              } ${phase === 'input' ? '' : 'opacity-60'}`}
            >
              <span aria-hidden>{d.glyph}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
