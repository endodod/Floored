'use client'

import { useFreeplayStore } from '@/store/freeplay-store'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import { Rail } from '@/components/mode-intro'
import { signed } from '@/components/ui/terminal'

/** Freeplay's rail: the balance against the 10K start, the peak and the resets. */
export function FreeplaySession() {
  const hydrated = useHydrated()
  const bankroll = useFreeplayStore((s) => s.bankroll)
  const peak = useFreeplayStore((s) => s.peakBankroll)
  const resets = useFreeplayStore((s) => s.resetCount)
  const START = 10_000
  const net = bankroll - START

  return (
    <Rail
      title="Your session"
      note="Play money"
      footer="Go broke and a game offers to refill you to 10K. Nothing here costs or pays real money."
    >
      <div className="py-3">
        <p className="text-xs text-dim">Balance</p>
        <p className="num mt-0.5 text-[28px] leading-9 text-ink">{hydrated ? formatChips(bankroll) : '—'}</p>
        {hydrated && (
          <p className={`num text-xs ${net > 0 ? 'text-felt glow-felt' : net < 0 ? 'text-loss' : 'text-dim'}`}>
            {signed(net, formatChips)} <span className="font-sans text-dim">since the 10K start</span>
          </p>
        )}
      </div>
      <dl className="divide-y divide-rule border-t border-rule">
        {[
          { label: 'Peak balance', value: hydrated ? formatChips(peak) : '—' },
          { label: 'Resets', value: hydrated ? String(resets) : '—' },
        ].map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-[13px] text-dim">{r.label}</dt>
            <dd className="num text-[13px] text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Rail>
  )
}
