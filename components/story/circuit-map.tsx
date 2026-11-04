'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { CITIES } from '@/lib/story/cities'
import { formatChips } from '@/utils/format'

const ROMAN = ['I', 'II', 'III', 'IV'] as const

type Status = 'current' | 'cleared' | 'passed' | 'ahead'

/** A smooth path through the points (Catmull-Rom as cubic Béziers). */
function smooth(pts: [number, number][]): string {
  let d = `M${pts[0]![0]} ${pts[0]![1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`
  }
  return d
}

/**
 * The circuit as a road-trip map: seven stops along one road, grouped by act,
 * with where you are, what you cleared and what is still ahead. An overlay over
 * the city; Escape or Close shuts it.
 */
export function CircuitMap({ current, cleared, visited, onClose }: { current: string; cleared: string[]; visited: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tall, setTall] = useState(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const opener = document.activeElement as HTMLElement | null
    el.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const ro = new ResizeObserver(() => setTall(el.clientWidth / Math.max(1, el.clientHeight) < 1.1))
    ro.observe(el)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  const idx = CITIES.findIndex((c) => c.id === current)
  const status = (i: number): Status =>
    CITIES[i]!.id === current ? 'current' : cleared.includes(CITIES[i]!.id) ? 'cleared' : i < idx || visited.includes(CITIES[i]!.id) ? 'passed' : 'ahead'

  const W = tall ? 360 : 1200
  const H = tall ? 760 : 500
  // Stops spread over the whole map, however many cities there are.
  const n = CITIES.length
  const gap = tall ? (H - 150) / Math.max(1, n - 1) : (W - 200) / Math.max(1, n - 1)
  const pts: [number, number][] = CITIES.map((_, i) =>
    tall ? [96 + Math.sin(i * 1.25) * 40, 80 + i * gap] : [100 + i * gap, i % 2 ? 330 : 200],
  )
  // Act bands tile the map edge to edge: each runs from halfway after the previous act's last
  // stop to halfway before the next act's first.
  const PAD = tall ? 40 : 70
  const along = (i: number) => (tall ? pts[i]![1] : pts[i]![0])
  const bandEdge = (i: number, side: 'start' | 'end') => {
    if (side === 'start') return i === 0 ? along(0) - PAD : (along(i - 1) + along(i)) / 2
    return i === n - 1 ? along(n - 1) + PAD : (along(i) + along(i + 1)) / 2
  }
  const road = smooth(pts)
  const done = smooth(pts.slice(0, Math.max(1, idx + 1)))

  return (
    <div ref={ref} className="st-map st-motion absolute inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label="The circuit map">
      <div className="flex shrink-0 items-center gap-3 px-4 pt-3 sm:px-6 sm:pt-4">
        <div className="min-w-0 flex-1">
          <p className="felt-print">Road atlas</p>
          <h2 className="text-[20px] font-semibold leading-7 text-[#f7eed6] sm:text-2xl">The Circuit</h2>
        </div>
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-soft shadow-[inset_0_0_0_1px_rgba(217,164,65,0.4)] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          <X className="h-4 w-4" aria-hidden /> Close
        </button>
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-3 sm:px-6 sm:pb-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${CITIES.length} cities. You are in ${CITIES[idx]?.name}.`}>
          <defs>
            <filter id="map-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* act bands */}
          {[1, 2, 3, 4].map((act) => {
            const first = CITIES.findIndex((c) => c.act === act)
            const last = CITIES.map((c) => c.act).lastIndexOf(act as 1 | 2 | 3 | 4)
            if (first < 0) return null
            const from = bandEdge(first, 'start')
            const to = bandEdge(last, 'end')
            const fill = act % 2 ? 'rgba(217,164,65,0.045)' : 'rgba(255,255,255,0.02)'
            return tall ? (
              <g key={act}>
                <rect x={8} y={from + 2} width={W - 16} height={to - from - 4} rx={10} fill={fill} />
                <text x={W - 18} y={from + 18} textAnchor="end" className="fill-[rgba(217,164,65,0.6)]" fontSize={11} fontWeight={700} letterSpacing={2.4}>
                  ACT {ROMAN[act - 1]}
                </text>
              </g>
            ) : (
              <g key={act}>
                <rect x={from + 3} y={30} width={to - from - 6} height={H - 60} rx={14} fill={fill} />
                <text x={(from + to) / 2} y={60} textAnchor="middle" className="fill-[rgba(217,164,65,0.6)]" fontSize={13} fontWeight={700} letterSpacing={3}>
                  ACT {ROMAN[act - 1]}
                </text>
              </g>
            )
          })}
          {/* the road: travelled stretch in gold */}
          <path d={road} fill="none" stroke="#0a0b0c" strokeWidth={tall ? 14 : 18} strokeLinecap="round" />
          <path d={road} fill="none" stroke="#2b2622" strokeWidth={tall ? 10 : 14} strokeLinecap="round" />
          <path d={road} fill="none" stroke="rgba(201,168,90,0.35)" strokeWidth={1.6} strokeDasharray="8 9" />
          {idx > 0 && <path d={done} fill="none" stroke="#d9a441" strokeWidth={3} strokeLinecap="round" filter="url(#map-glow)" />}
          {/* the stops */}
          {CITIES.map((c, i) => {
            const st = status(i)
            const [x, y] = pts[i]!
            const r = st === 'current' ? 13 : 9
            const fill = st === 'current' ? '#4fae84' : st === 'cleared' ? '#d9a441' : st === 'passed' ? '#8a8c92' : '#1a1d1b'
            // Wide: the zigzag's high stops label above, the low ones below, so labels never sit on the road.
            const below = !tall && i % 2 === 1
            const lx = tall ? x + 26 : x
            const ly = tall ? y - 2 : below ? y + 36 : y - 58
            const ink = st === 'ahead' ? '#6b6f6c' : '#f4ead2'
            return (
              <g key={c.id} aria-current={st === 'current' ? 'location' : undefined}>
                {st === 'current' && <circle cx={x} cy={y} r={22} fill="none" stroke="#4fae84" strokeWidth={2} className="st-motion st-ping" style={{ transformOrigin: `${x}px ${y}px` }} />}
                <circle cx={x} cy={y} r={r + 3} fill="#0a0b0c" />
                <circle cx={x} cy={y} r={r} fill={fill} stroke={st === 'ahead' ? '#3a463b' : '#f2d48f'} strokeWidth={1.6} strokeDasharray={st === 'ahead' ? '2 3' : undefined} />
                {st === 'cleared' && <path d={`M${x - 4} ${y} l3 3 l6 -6`} stroke="#1a1206" strokeWidth={2.4} fill="none" strokeLinecap="round" />}
                <text x={lx} y={ly} textAnchor={tall ? 'start' : 'middle'} fontSize={tall ? 14 : 15} fontWeight={700} fill={ink}>
                  {c.name}
                </text>
                <text x={lx} y={ly + (tall ? 16 : 17)} textAnchor={tall ? 'start' : 'middle'} fontSize={tall ? 11 : 12} fill={st === 'ahead' ? '#555a57' : '#a89c84'} className="num">
                  {st === 'current' ? 'You are here' : st === 'cleared' ? 'Cleared' : st === 'passed' ? 'Passed' : i > 0 ? (tall ? `Coming soon · $${formatChips(c.minBet)} min` : 'Coming soon') : tall ? `$${formatChips(c.minBet)} min · ${c.feel}` : `$${formatChips(c.minBet)} min`}
                </text>
                {!tall && st === 'ahead' && (
                  <text x={lx} y={ly + 31} textAnchor="middle" fontSize={11} fontStyle="italic" fill="#4a4f4c">
                    {c.feel}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
