'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ROWS, SLOT_COUNT, ballColAtRow, getSlotMultipliers } from '@/games/plinko/engine'
import type { PlinkoPath, PlinkoRisk } from '@/games/plinko/types'
import {
  BALL_R,
  PIN_R,
  SLOT_BAND_TOP,
  SLOT_HEIGHT,
  SLOT_WIDTH,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
  pinX,
  pinY,
  slotCenterX,
  slotLeft,
} from '@/games/plinko/board-geometry'

// ─── Animation timing ────────────────────────────────────────────────────────
const ENTRY_MS = 140
const SEGMENT_MS = 180
const LANDING_MS = 100
const TOTAL_MS = ENTRY_MS + ROWS * SEGMENT_MS + LANDING_MS

function easeIn(t: number): number { return t * t }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

// Bucket colour carries what it pays: under 1× loses, 1× is even, above wins, 5× and up is the money.
type SlotTone = 'loss' | 'even' | 'felt' | 'gold'
function slotTone(mult: number): SlotTone {
  return mult < 1 ? 'loss' : mult === 1 ? 'even' : mult < 5 ? 'felt' : 'gold'
}
const SLOT_FILL: Record<SlotTone, string> = {
  loss: 'var(--loss-tint)',
  even: 'rgba(0,0,0,0.35)',
  felt: 'var(--felt-tint)',
  gold: 'var(--gold-tint)',
}
const SLOT_INK: Record<SlotTone, string> = {
  loss: 'var(--loss)',
  even: 'var(--soft)',
  felt: 'var(--felt)',
  gold: 'var(--gold)',
}

// Compute ball screen position from its precomputed columns, drop start time, and now.
// Returns null when the ball has finished its animation.
function getBallPos(
  cols: number[],
  startedAt: number,
  now: number,
): { x: number; y: number } | null {
  const elapsed = now - startedAt
  if (elapsed < 0 || elapsed >= TOTAL_MS) return null

  const finalX = slotCenterX(cols[ROWS] ?? 0)
  const finalY = SLOT_BAND_TOP + SLOT_HEIGHT / 2

  if (elapsed < ENTRY_MS) {
    return { x: pinX(0, 0), y: lerp(pinY(0) - 40, pinY(0), easeIn(elapsed / ENTRY_MS)) }
  }
  if (elapsed < ENTRY_MS + ROWS * SEGMENT_MS) {
    const segElapsed = elapsed - ENTRY_MS
    const seg = Math.min(Math.floor(segElapsed / SEGMENT_MS), ROWS - 1)
    const ts = easeIn((segElapsed - seg * SEGMENT_MS) / SEGMENT_MS)
    return {
      x: lerp(pinX(seg, cols[seg] ?? 0), pinX(seg + 1, cols[seg + 1] ?? 0), ts),
      y: lerp(pinY(seg), pinY(seg + 1), ts),
    }
  }
  const tl = easeIn((elapsed - ENTRY_MS - ROWS * SEGMENT_MS) / LANDING_MS)
  return { x: finalX, y: lerp(pinY(ROWS), finalY, tl) }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PlinkoBall {
  id: string
  path: PlinkoPath
  startedAt: number  // performance.now() at drop time
}

interface PlinkoBoardProps {
  balls: PlinkoBall[]
  onBallComplete: (id: string) => void
  risk: PlinkoRisk
  goldenBallIds?: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlinkoBoard({ balls, onBallComplete, risk, goldenBallIds }: PlinkoBoardProps) {
  const glowId = `pg-${useId().replace(/:/g, '')}`
  const multipliers = getSlotMultipliers(risk)

  const [animNow, setAnimNow] = useState(0)
  // Last ball to land in each slot, so the bucket flashes once per landing.
  const [hits, setHits] = useState<Record<number, string>>({})

  const ballsRef = useRef(balls)
  ballsRef.current = balls
  const onBallCompleteRef = useRef(onBallComplete)
  onBallCompleteRef.current = onBallComplete
  const reportedIdsRef = useRef<Set<string>>(new Set())
  const rafRef = useRef<number | null>(null)

  // Start the loop if not already running. Safe to call multiple times.
  const kickLoop = () => {
    if (rafRef.current !== null) return

    const tick = (now: number) => {
      const active = ballsRef.current

      for (const ball of active) {
        if (now - ball.startedAt >= TOTAL_MS && !reportedIdsRef.current.has(ball.id)) {
          reportedIdsRef.current.add(ball.id)
          const slot = ballColAtRow(ball.path.decisions, ROWS)
          setHits((h) => ({ ...h, [slot]: ball.id }))
          onBallCompleteRef.current(ball.id)
        }
      }

      setAnimNow(now)

      if (active.some((b) => now - b.startedAt < TOTAL_MS)) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  // Kick the loop whenever new balls arrive.
  useEffect(() => {
    if (balls.length > 0) kickLoop()
  }, [balls]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel on unmount only.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // A peg is lit for the first half of the segment after a ball leaves it.
  const litPegs = new Set<string>()
  for (const ball of balls) {
    const seg = Math.floor((animNow - ball.startedAt - ENTRY_MS) / SEGMENT_MS)
    if (seg < 0 || seg >= ROWS) continue
    if ((animNow - ball.startedAt - ENTRY_MS) % SEGMENT_MS > SEGMENT_MS / 2) continue
    litPegs.add(`${seg}-${ballColAtRow(ball.path.decisions, seg)}`)
  }

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="w-full h-full select-none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${glowId}-gold`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`${glowId}-peg`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f6e7c1" />
          <stop offset="55%" stopColor="#c99a45" />
          <stop offset="100%" stopColor="#6e5222" />
        </radialGradient>
      </defs>

      {/* Brass pegs; a peg lights as a ball leaves it. */}
      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: row + 1 }, (_, col) => {
          const lit = litPegs.has(`${row}-${col}`)
          return (
            <g key={`p${row}-${col}`}>
              <circle cx={pinX(row, col)} cy={pinY(row) + 1.4} r={PIN_R} fill="rgba(0,0,0,0.45)" />
              <circle
                cx={pinX(row, col)}
                cy={pinY(row)}
                r={lit ? PIN_R + 0.8 : PIN_R}
                fill={lit ? 'var(--ink)' : `url(#${glowId}-peg)`}
                filter={lit ? `url(#${glowId})` : undefined}
              />
            </g>
          )
        })
      )}

      {/* Buckets, tinted by what they pay; one flashes when a ball lands in it. */}
      {multipliers.map((mult, i) => {
        const tone = slotTone(mult)
        const x = slotLeft(i) + 1.5
        const w = SLOT_WIDTH - 3
        return (
          <g key={i}>
            <rect x={x} y={SLOT_BAND_TOP} width={w} height={SLOT_HEIGHT} rx={5} fill={SLOT_FILL[tone]} />
            <rect x={x} y={SLOT_BAND_TOP} width={w} height={2.5} rx={1.25} fill={SLOT_INK[tone]} opacity={0.85} />
            {hits[i] && (
              <rect
                key={hits[i]}
                x={x}
                y={SLOT_BAND_TOP}
                width={w}
                height={SLOT_HEIGHT}
                rx={5}
                fill={SLOT_INK[tone]}
                className="pl-hit"
              />
            )}
            <text
              x={slotCenterX(i)}
              y={SLOT_BAND_TOP + SLOT_HEIGHT * 0.64}
              textAnchor="middle"
              fill={SLOT_INK[tone]}
              fontWeight={600}
              className="num"
              style={{ fontSize: `${mult}×`.length <= 2 ? 10 : `${mult}×`.length === 3 ? 9 : 7.5, letterSpacing: '-0.02em' }}
            >
              {mult}×
            </text>
          </g>
        )
      })}

      {/* Animated balls — one circle per active drop */}
      {balls.map((ball) => {
        const cols = Array.from({ length: ROWS + 1 }, (_, r) => ballColAtRow(ball.path.decisions, r))
        const pos = getBallPos(cols, ball.startedAt, animNow)
        if (!pos) return null
        const isGolden = goldenBallIds?.includes(ball.id) ?? false
        return (
          <circle
            key={ball.id}
            cx={pos.x}
            cy={pos.y}
            r={BALL_R}
            fill={isGolden ? 'var(--gold)' : 'var(--ink)'}
            stroke={isGolden ? '#f6e7c1' : 'rgba(0,0,0,0.35)'}
            strokeWidth={1.5}
            filter={`url(#${glowId}${isGolden ? '-gold' : ''})`}
          />
        )
      })}
    </svg>
  )
}
