'use client'

import { useEffect, useState } from 'react'
import { msUntilNextDaily } from '@/lib/daily/challenge'

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Time until the next daily (00:00 UTC). Renders nothing until mounted. */
export function DailyCountdown({ className }: { className?: string }) {
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setMs(msUntilNextDaily())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (ms == null) return null
  return <span className={`tabular-nums ${className ?? ''}`}>{format(ms)}</span>
}
