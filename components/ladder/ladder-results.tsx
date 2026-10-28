'use client'

import { useState } from 'react'
import type { LadderRecord } from '@/store/ladder-store'
import { LADDER_RUNGS, START_POT, TOP_BONUS } from '@/lib/ladder/rules'
import { END_LABEL, buildLadderShareText } from '@/lib/ladder/share'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'

export function LadderResults({ record, onNewRun }: { record: LadderRecord; onNewRun: () => void }) {
  const [copied, setCopied] = useState(false)
  const out = record.endReason === 'out'

  async function handleShare() {
    const text = buildLadderShareText(record, `${window.location.origin}/ladder`)
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Share sheet dismissed or clipboard blocked — nothing to do.
    }
  }

  return (
    <section className="rise flex flex-col gap-5 rounded-md bg-surface p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6" aria-labelledby="ladder-result">
      <div>
        <h2 id="ladder-result" className={`text-[13px] ${out ? 'text-loss' : 'text-dim'}`}>
          {END_LABEL[record.endReason]}
        </h2>
        <p className={`num mt-1 text-[32px] leading-tight ${out ? 'text-ink' : 'text-gold glow-gold'}`}>{formatChips(record.finalPot)}</p>
        <p className="mt-1 text-[13px] text-dim">
          Reached rung {record.peakRung}/{LADDER_RUNGS} · {record.falls} fall{record.falls === 1 ? '' : 's'} · started
          with {formatChips(START_POT)}
          {record.endReason === 'topped' && ` · ×${TOP_BONUS} top bonus`}
          {out && ' · banked your last checkpoint'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleShare}>
          {copied ? 'Copied' : 'Share result'}
        </Button>
        <Button onClick={onNewRun}>New run</Button>
      </div>
    </section>
  )
}
