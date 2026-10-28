'use client'

import { useState } from 'react'
import type { LadderRecord } from '@/store/ladder-store'
import { LADDER_RUNGS, START_POT, TOP_BONUS } from '@/lib/ladder/rules'
import { END_LABEL, buildLadderShareText } from '@/lib/ladder/share'
import { formatChips } from '@/utils/format'

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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wider ${out ? 'text-red-400/80' : 'text-zinc-500'}`}>
            {END_LABEL[record.endReason]}
          </p>
          <p className="mt-1 text-4xl font-black tabular-nums text-white">
            {record.endReason === 'topped' && <span className="mr-2" aria-hidden>👑</span>}
            {formatChips(record.finalPot)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Reached rung {record.peakRung}/{LADDER_RUNGS} · {record.falls} fall{record.falls === 1 ? '' : 's'} · started
            with {formatChips(START_POT)}
            {record.endReason === 'topped' && ` · ×${TOP_BONUS} top bonus`}
            {out && ' · banked your last checkpoint'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="px-5 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white font-bold rounded-lg transition-colors text-sm"
          >
            {copied ? 'Copied!' : 'Share result'}
          </button>
          <button
            type="button"
            onClick={onNewRun}
            className="px-5 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-sm shadow-lg"
          >
            New run
          </button>
        </div>
      </div>
    </div>
  )
}
