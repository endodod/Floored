'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GAME_CONTROL_DOCK, GAME_STATUS_BAR } from '@/components/game-layout'
import { CHIPS, ROUNDS, call, roundSeconds, score, start, type ChipCountState } from '@/lib/story/minigames/chip-count'

const LEAD_MS = 700
const SHOW_RESULT_MS = 900
const END_MS = 1100

type Phase = 'lead' | 'count' | 'result' | 'done'

const chipStyle = (i: number): CSSProperties => ({ '--chip': CHIPS[i]!.chip, '--chip-ink': CHIPS[i]!.ink }) as CSSProperties

/** Jo's cashier drill: count the stack, tap its total before the clock runs out. */
export function ChipCountBoard({ onFinish }: { onFinish: (score: number) => void }) {
  const [game, setGame] = useState<ChipCountState>(() => start(Math.random))
  /** The stack and answer on show (kept through the result beat while `game` already holds the next round). */
  const [shown, setShown] = useState(() => game)
  const [phase, setPhase] = useState<Phase>('lead')
  const [picked, setPicked] = useState<number | null>(null)
  const [left, setLeft] = useState(roundSeconds(0))
  const finished = useRef(false)
  const pending = useRef<ChipCountState | null>(null)

  // Each round: a short lead-in, then the clock runs.
  useEffect(() => {
    if (phase !== 'lead') return
    const t = setTimeout(() => {
      setLeft(roundSeconds(shown.round))
      setPhase('count')
    }, LEAD_MS)
    return () => clearTimeout(t)
  }, [phase, shown.round])

  // The clock, in whole seconds; at zero the round is lost.
  useEffect(() => {
    if (phase !== 'count') return
    if (left <= 0) {
      settle(null)
      return
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
    // settle reads the latest state through refs and setters only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left])

  function settle(value: number | null) {
    if (phase !== 'count') return
    const { state } = call(game, value, Math.random)
    pending.current = state
    setPicked(value)
    setPhase('result')
    setTimeout(() => {
      const next = pending.current!
      setGame(next)
      if (next.over) {
        setPhase('done')
        if (!finished.current) {
          finished.current = true
          setTimeout(() => onFinish(score(next)), END_MS)
        }
        return
      }
      setShown(next)
      setPicked(null)
      setPhase('lead')
    }, SHOW_RESULT_MS)
  }

  const answered = phase === 'result' || phase === 'done'
  const right = answered && picked === shown.answer
  const headline =
    phase === 'lead' ? `Stack ${shown.round + 1}: ${shown.stack.length} chips` :
    phase === 'count' ? 'Count it' :
    phase === 'done' ? 'Shift done' :
    picked == null ? `Time. It was ${shown.answer}.` :
    right ? 'Right.' : `No. It was ${shown.answer}.`
  const seconds = roundSeconds(shown.round)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line" data-testid="chip-count">
      <div className={GAME_STATUS_BAR}>
        <span className="num text-[13px] text-soft">Stack {Math.min(shown.round + 1, ROUNDS)} of {ROUNDS}</span>
        <span className="num text-[13px] text-dim">{(phase === 'done' ? game : pending.current ?? game).correct} right</span>
      </div>
      <div className="table-felt relative flex min-h-[120px] w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-4 sm:gap-4">
        <p className={`text-sm font-semibold ${answered && !right ? 'text-loss' : 'text-ink'}`} aria-live="polite" data-testid="cc-headline">
          {headline}
        </p>
        {/* The stack, largest chips first, as a dealer would cut it. It hides at once for the
            lead-in (no fade, or the next stack would flash as it fades out) and fades in when the clock starts. */}
        <ul
          className={`flex max-w-[360px] flex-wrap justify-center gap-1.5 sm:gap-2 ${phase === 'lead' ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}`}
          aria-label={phase === 'lead' ? 'Stack coming' : `Stack of ${shown.stack.length} chips`}
        >
          {shown.stack.map((c, i) => (
            <li
              key={i}
              className="chip num flex h-[clamp(36px,7vh,52px)] w-[clamp(36px,7vh,52px)] items-center justify-center text-[clamp(10px,1.8vh,13px)] font-semibold"
              style={chipStyle(c)}
            >
              <span>{CHIPS[c]!.label}</span>
            </li>
          ))}
        </ul>
        {/* The clock: drains over the round's seconds. */}
        <div className="h-1.5 w-[min(320px,80%)] overflow-hidden rounded-full bg-control" aria-hidden>
          <div
            className={`h-full rounded-full ${left <= 2 ? 'bg-loss' : 'bg-gold'}`}
            style={{ width: phase === 'count' ? `${(left / seconds) * 100}%` : phase === 'lead' ? '100%' : '0%', transition: 'width 1s linear' }}
          />
        </div>
        <span className="sr-only" aria-live="off">{phase === 'count' ? `${left} seconds left` : ''}</span>
      </div>
      <div className={`${GAME_CONTROL_DOCK} py-2 sm:py-3`}>
        <div className="mx-auto grid max-w-[420px] grid-cols-2 gap-2">
          {shown.options.map((v) => {
            const isAnswer = answered && v === shown.answer
            const isWrongPick = answered && v === picked && v !== shown.answer
            return (
              <button
                key={v}
                type="button"
                disabled={phase !== 'count'}
                onClick={() => settle(v)}
                data-total={v}
                className={`num flex h-[clamp(44px,8vh,60px)] items-center justify-center rounded-md border text-[clamp(16px,2.6vh,20px)] font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-felt ${
                  isAnswer ? 'border-felt bg-felt-tint text-ink' : isWrongPick ? 'border-loss text-loss' : 'border-line bg-raised text-ink hover:border-control'
                } ${phase === 'count' || isAnswer || isWrongPick ? '' : 'opacity-60'}`}
              >
                {v}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
