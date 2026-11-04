'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { NightSummary } from '@/store/story-store'
import { formatChips } from '@/utils/format'

const money = (n: number) => `$${formatChips(n)}`

/**
 * The end-of-night slip: a till receipt on paper listing comps, the standing
 * bonus (on a night up), hustles and lodging, the net in bold, then "Next night". Shown over the dimmed street.
 */
export function NightCard({ summary, cityName, onNext }: { summary: NightSummary; cityName: string; onNext: () => void }) {
  const btn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    btn.current?.focus()
  }, [])
  const rows: { label: string; value: string; tone?: 'win' | 'miss' | 'cost' }[] = []
  if (summary.played) rows.push({ label: 'Comps', value: `+${money(summary.comps)}`, tone: 'win' })
  if (summary.bonus) rows.push({ label: `Standing bonus · ${Math.round((summary.bonusRate ?? 0) * 100)}% of the win`, value: `+${money(summary.bonus)}`, tone: 'win' })
  for (const h of summary.hustles) rows.push({ label: h.text, value: h.paid ? `+${money(h.paid)}` : 'missed', tone: h.paid ? 'win' : 'miss' })
  rows.push({
    label: summary.car ? 'Slept in the car' : 'A room for the night',
    value: summary.lodging ? `-${money(summary.lodging)}` : '$0',
    ...(summary.lodging ? { tone: 'cost' as const } : {}),
  })
  // Saves from before version 8 have no nextBets on their last receipt.
  if (summary.nextBets) rows.push({ label: 'Bets tomorrow', value: String(summary.nextBets) })

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="night-card-h">
      <div className="st-receipt st-motion relative w-full max-w-[340px] px-5 pb-6 pt-5">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[#6f6354]">{cityName} · Night {summary.night}</p>
        <h2 id="night-card-h" className="mt-1 text-center font-mono text-[17px] font-bold uppercase tracking-[0.12em] text-[#2a2420]">
          {summary.played ? 'The night’s tab' : 'A night off'}
        </h2>
        <div aria-hidden className="my-3 border-t border-dashed border-[#2a2420]/40" />
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 font-mono text-[12.5px] leading-[17px] text-[#2a2420]">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className={r.tone === 'miss' ? 'text-[#8a7e6c] line-through decoration-[#8a7e6c]/60' : undefined}>{r.label}</dt>
              <dd className={`num text-right ${r.tone === 'win' ? 'text-[#1d5a3e]' : r.tone === 'cost' ? 'text-[#8f2633]' : r.tone === 'miss' ? 'text-[#8a7e6c]' : ''}`}>{r.value}</dd>
            </div>
          ))}
        </dl>
        <div aria-hidden className="my-3 border-t border-dashed border-[#2a2420]/40" />
        <div className="flex items-baseline justify-between font-mono text-[#2a2420]">
          <span className="text-[13px] font-bold uppercase tracking-[0.16em]">Net</span>
          <span className={`num text-[24px] font-bold ${summary.net < 0 ? 'text-[#8f2633]' : 'text-[#1d5a3e]'}`}>
            {summary.net < 0 ? '-' : '+'}
            {money(Math.abs(summary.net))}
          </span>
        </div>
        {summary.bust && (
          <p className="st-stamp mt-3 rotate-[-4deg] text-center font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-[#8f2633]">
            Bust · borrow, or work a job
          </p>
        )}
        <div className="mt-5 flex justify-center">
          <Button ref={btn} size="lg" onClick={onNext}>
            Next night
          </Button>
        </div>
      </div>
    </div>
  )
}
