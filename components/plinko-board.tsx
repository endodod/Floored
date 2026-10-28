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

function slotEdge(i: number, total: number): number {
  return Math.abs(i - (total - 1) / 2) / ((total - 1) / 2)
}

// Dark at the centre, warming to the app's gold at the high-payout edges.
function slotFill(i: number, total: number): string {
  const edge = slotEdge(i, total)
  const r = Math.round(33 + 184 * edge)
  const g = Math.round(32 + 132 * edge)
  const b = Math.round(35 + 30 * edge)
  return `rgb(${r},${g},${b})`
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
      </defs>

      {/* Pin grid */}
      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: row + 1 }, (_, col) => (
          <circle key={`p${row}-${col}`} cx={pinX(row, col)} cy={pinY(row)} r={PIN_R} fill="rgba(255,255,255,0.32)" />
        ))
      )}

      {/* Slot band — brighter slots = more landings (heat map) */}
      {multipliers.map((mult, i) => (
        <g key={i}>
          <rect
            x={slotLeft(i)}
            y={SLOT_BAND_TOP}
            width={SLOT_WIDTH}
            height={SLOT_HEIGHT}
            fill={slotFill(i, SLOT_COUNT)}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={0.5}
          />
          <text
            x={slotCenterX(i)}
            y={SLOT_BAND_TOP + SLOT_HEIGHT * 0.62}
            textAnchor="middle"
            fill={slotEdge(i, SLOT_COUNT) > 0.55 ? '#171719' : '#ffffff'}
            fontWeight="600"
            style={{ fontSize: 8 }}
          >
            {mult}x
          </text>
        </g>
      ))}

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
            fill={isGolden ? '#d9a441' : '#ffffff'}
            stroke={isGolden ? '#f0c060' : '#4fae84'}
            strokeWidth={1.5}
            filter={`url(#${glowId}${isGolden ? '-gold' : ''})`}
          />
        )
      })}
    </svg>
  )
}
