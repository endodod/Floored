'use client'

import { useFreeplayStore } from '@/store/freeplay-store'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import { signed } from '@/components/ui/terminal'

/** Compact Freeplay session figures for the page title row. */
export function FreeplaySession() {
  const hydrated = useHydrated()
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const peak = useFreeplayStore((s) => s.peakBankroll)
  const resets = useFreeplayStore((s) => s.resetCount)
  const START = 10_000
  const net = bankroll - START

  return (
    <section className="rise flex min-w-0 flex-col gap-1.5" aria-label="Your session">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-xs font-semibold text-ink">Your session</h2>
        <p className="text-[11px] text-dim">Play money</p>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-md bg-surface px-3 py-2">
        <div>
          <dt className="text-[10px] text-dim">Balance</dt>
          <dd className="num mt-0.5 text-base leading-5 text-ink">{hydrated ? formatChips(bankroll) : '—'}</dd>
          {hydrated && net !== 0 && (
            <dd className={net > 0 ? 'num text-[10px] text-felt glow-felt' : net < 0 ? 'num text-[10px] text-loss' : 'num text-[10px] text-dim'}>
              {signed(net, formatChips)} since start
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[10px] text-dim">Peak balance</dt>
          <dd className="num mt-0.5 text-base leading-5 text-ink">{hydrated ? formatChips(peak) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-dim">Resets</dt>
          <dd className="num mt-0.5 text-base leading-5 text-ink">{hydrated ? String(resets) : '—'}</dd>
        </div>
      </dl>
    </section>
  )
}
