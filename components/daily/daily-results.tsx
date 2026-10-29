'use client'

import { useState } from 'react'
import type { DailyRecord } from '@/store/daily-store'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { buildShareText, dailyMultiplier, formatMultiplier } from '@/lib/daily/share'
import { formatChips } from '@/utils/format'
import { DailyCountdown } from './countdown'
import { Button } from '@/components/ui/button'
import { signed } from '@/components/ui/terminal'

export function DailyResults({ record }: { record: DailyRecord }) {
  const [copied, setCopied] = useState(false)
  const m = dailyMultiplier(record)
  const up = record.endBankroll >= record.startBankroll
  const failed = record.endReason !== 'complete'
  const gaveUp = record.endReason === 'gave-up'

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
    <section className="rise grid grid-cols-1 gap-6 rounded-md bg-surface p-5 sm:p-6 lg:grid-cols-2 lg:gap-10" aria-labelledby="daily-result">
      <div className="flex flex-col gap-4">
        <div>
          <h2 id="daily-result" className={`text-[13px] ${failed && !gaveUp ? 'text-loss' : 'text-dim'}`}>
            {gaveUp ? 'Gave up' : failed ? 'Challenge failed' : 'Challenge complete'}
          </h2>
          {failed ? (
            <p className={`num mt-1 text-[32px] leading-tight ${gaveUp ? 'text-ink' : 'glow-loss text-loss'}`}>
              {formatChips(record.endBankroll)}
            </p>
          ) : (
            <p className="mt-1 flex items-baseline gap-3">
              <span className={`num text-[32px] leading-tight ${up ? 'text-felt glow-felt' : 'text-ink'}`}>{formatChips(record.endBankroll)}</span>
              <span className={`num text-lg ${up ? 'text-felt' : 'text-loss'}`}>{formatMultiplier(m)}</span>
            </p>
          )}
          <p className="mt-1 text-[13px] text-dim">
            {gaveUp
              ? `You ended the day early, from ${formatChips(record.startBankroll)}.`
              : failed
              ? `The bankroll fell below the min bet.`
              : `Started with ${formatChips(record.startBankroll)}.`}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-4">
          <Button onClick={handleShare}>{copied ? 'Copied' : 'Share result'}</Button>
          <p className="text-[13px] text-dim">
            Next daily in <DailyCountdown className="num text-ink" />
          </p>
        </div>
      </div>

      <dl className="divide-y divide-rule self-start">
        {record.gameNets.map(({ game, net }) => {
          const entry = GAME_BY_NAME.get(game)
          return (
            <div key={game} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="truncate text-[13px] text-soft">{entry?.label ?? game}</dt>
              <dd className={`num shrink-0 text-[14px] ${net == null ? 'text-dim' : net > 0 ? 'text-felt' : net < 0 ? 'text-loss' : 'text-ink'}`}>
                {net == null ? '—' : signed(net, formatChips)}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
