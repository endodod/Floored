'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Crown } from 'lucide-react'
import { GAME_CONTROL_DOCK, GAME_STATUS_BAR } from '@/components/game-layout'
import { CUPS, ROUNDS, SWAP_MS, guess, next, score, start, type TrackerState } from '@/lib/story/minigames/shuffle-tracker'

const REDUCED_STEP_MS = 1000
const END_MS = 1200

type Phase = 'peek' | 'shuffle' | 'pick' | 'reveal' | 'done'

const prefersReduced = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.getAttribute('data-motion') === 'reduced' ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches))

/** Pike's table: the queen goes under a cup, follow it through the swaps. */
export function ShuffleTrackerBoard({ onFinish }: { onFinish: (score: number) => void }) {
  const [game, setGame] = useState<TrackerState>(() => start(Math.random))
  const [phase, setPhase] = useState<Phase>('peek')
  /** slotOf[cup] = the slot the cup stands in. Cup ids stay put; the queen is under cup `queenCup`. */
  const [slotOf, setSlotOf] = useState<number[]>([0, 1, 2])
  const [swapping, setSwapping] = useState<[number, number] | null>(null)
  const [reduced, setReduced] = useState(false)
  const finished = useRef(false)
  const queenCup = game.shuffle.queenStart
  const swapMs = SWAP_MS[game.round]!

  // Each round: show the queen, cover it, run the swaps, then wait for a pick.
  useEffect(() => {
    if (game.over) return
    const red = prefersReduced()
    setReduced(red)
    setSlotOf([0, 1, 2])
    setSwapping(null)
    setPhase('peek')
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    let t = 1100
    at(t, () => setPhase('shuffle'))
    t += 350
    const step = red ? REDUCED_STEP_MS : swapMs
    game.shuffle.swaps.forEach(([a, b]) => {
      if (red) {
        // Slow discrete steps: mark the two cups, hold, then jump.
        at(t, () => setSwapping([a, b]))
        at(t + step * 0.6, () => {
          setSlotOf((s) => s.map((v) => (v === a ? b : v === b ? a : v)))
          setSwapping(null)
        })
        t += step
      } else {
        at(t, () => setSlotOf((s) => s.map((v) => (v === a ? b : v === b ? a : v))))
        t += step + 40
      }
    })
    at(t, () => setPhase('pick'))
    return () => timers.forEach(clearTimeout)
  }, [game.round, game.over, game.shuffle, swapMs])

  const pick = useCallback((slot: number) => {
    if (phase !== 'pick') return
    const { state } = guess(game, slot)
    setGame(state)
    setPhase('reveal')
    setTimeout(() => {
      if (state.round + 1 >= ROUNDS) {
        if (finished.current) return
        finished.current = true
        setPhase('done')
        setTimeout(() => onFinish(score(state)), 300)
      } else {
        setGame(next(state, Math.random))
      }
    }, END_MS)
  }, [phase, game, onFinish])

  const lifted = (cup: number) =>
    (phase === 'peek' && cup === queenCup) || ((phase === 'reveal' || phase === 'done') && slotOf[cup] === game.shuffle.queenEnd)
  const headline =
    phase === 'peek' ? 'Watch the queen' :
    phase === 'shuffle' ? (reduced ? 'Follow the highlighted cups' : 'Follow it') :
    phase === 'pick' ? 'Where is the queen?' :
    game.picked === game.shuffle.queenEnd ? 'Found her' : 'Missed'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line" data-testid="shuffle-tracker">
      <div className={GAME_STATUS_BAR}>
        <span className="num text-[13px] text-soft">Round {game.round + 1} of {ROUNDS}</span>
        <span className="num text-[13px] text-dim">{game.shuffle.swaps.length} swaps · {game.right} right</span>
      </div>
      <div className="table-felt relative flex min-h-[88px] w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-4 sm:gap-5">
        <p className="text-sm font-semibold text-ink" aria-live="polite" data-testid="st-headline">{headline}</p>
        <div className="relative h-[clamp(72px,16vh,128px)] w-full max-w-[360px] shrink-0">
          {Array.from({ length: CUPS }, (_, cup) => {
            const slot = slotOf[cup]!
            const marked = swapping != null && (slotOf[cup] === swapping[0] || slotOf[cup] === swapping[1])
            const up = lifted(cup)
            const isQueen = cup === queenCup
            return (
              <div
                key={cup}
                className="absolute top-0 h-full w-1/3 p-1.5"
                style={{
                  transform: `translateX(${slot * 100}%)`,
                  transition: reduced ? 'none' : `transform ${swapMs}ms ease-in-out`,
                }}
              >
                <button
                  type="button"
                  disabled={phase !== 'pick'}
                  onClick={() => pick(slot)}
                  aria-label={`Cup ${slot + 1}`}
                  data-slot={slot}
                  className={`relative flex h-full w-full items-end justify-center rounded-md border focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-felt ${
                    marked ? 'border-gold bg-gold-tint' : 'border-line bg-raised'
                  } ${phase === 'pick' ? 'hover:border-felt' : ''}`}
                >
                  {isQueen && (
                    <Crown
                      aria-hidden
                      className={`absolute bottom-2 h-7 w-7 text-gold ${up ? 'opacity-100' : 'opacity-0'}`}
                    />
                  )}
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 top-0 flex h-full items-center justify-center rounded-md border border-line bg-surface text-xl text-dim ${
                      up ? '-translate-y-6 opacity-30' : ''
                    } ${reduced ? '' : 'transition-all duration-300'} ${marked ? 'bg-gold-tint text-gold' : ''}`}
                  >
                    {phase === 'reveal' && game.picked === slot ? (game.picked === game.shuffle.queenEnd ? '✓' : '✕') : '?'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
      <div className={`${GAME_CONTROL_DOCK} py-3`}>
        <p className="text-center text-xs text-dim">
          {reduced ? 'Reduced motion: each swap is shown as a highlight, then the cups jump.' : 'Tap the cup you think hides the queen.'}
        </p>
      </div>
    </div>
  )
}
