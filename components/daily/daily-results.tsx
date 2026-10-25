'use client'

import { useState } from 'react'
import type { DailyRecord } from '@/store/daily-store'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { buildShareText, dailyMultiplier, formatMultiplier } from '@/lib/daily/share'
import { formatChips } from '@/utils/format'
import { DailyCountdown } from './countdown'

const END_LABEL: Record<DailyRecord['endReason'], string> = {
  complete: 'All bets played',
  cashout: 'Cashed out early',
  bust: 'Busted',
}

export function DailyResults({ record }: { record: DailyRecord }) {
  const [copied, setCopied] = useState(false)
  const m = dailyMultiplier(record)
  const up = record.endBankroll >= record.startBankroll

  async function handleShare() {
    const text = buildShareText(record, window.location.origin)
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {END_LABEL[record.endReason]}
          </p>
          <p className="mt-1 text-4xl font-black tabular-nums text-white">
            {formatChips(record.endBankroll)}
            <span className={`ml-2 text-xl ${up ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatMultiplier(m)}
            </span>
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Started with {formatChips(record.startBankroll)}
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="px-5 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-sm shadow-lg"
          >
            {copied ? 'Copied!' : 'Share result'}
          </button>
          <p className="text-xs text-zinc-500">
            Next daily in <DailyCountdown className="font-semibold text-zinc-300" />
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {record.gameNets.map(({ game, net }) => {
          const entry = GAME_BY_NAME.get(game)
          return (
            <div key={game} className="flex items-center justify-between gap-2 rounded-lg bg-black/25 border border-white/5 px-3 py-2">
              <span className="text-sm text-white/80 truncate">
                <span className="mr-1.5" aria-hidden>{entry?.symbol}</span>
                {entry?.label ?? game}
              </span>
              <span
                className={`text-sm font-bold tabular-nums shrink-0 ${
                  net == null ? 'text-zinc-600' : net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-zinc-300'
                }`}
              >
                {net == null ? '—' : `${net > 0 ? '+' : ''}${formatChips(net)}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
