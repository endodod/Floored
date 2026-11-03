'use client'

import { useSettingsStore } from '@/store/settings-store'
import { useHydrated } from '@/hooks/use-hydrated'
import { cn } from '@/lib/utils'

/** The switch's track and knob; on = felt green. */
function Switch({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
        on ? 'border-felt bg-felt-tint' : 'border-control bg-ground',
        className,
      )}
    >
      <span
        className={cn(
          // `left`, not a transform: reduced motion strips transforms, and the knob must still show the state.
          'absolute h-3.5 w-3.5 rounded-full transition-[left] duration-200',
          on ? 'left-[18px] bg-felt' : 'left-[2px] bg-dim',
        )}
      />
    </span>
  )
}

/**
 * Turns Simple view on and off. `pill` sits in the navbar; `row` is a full-width
 * line for the phone menu and the account settings.
 */
export function SimpleViewToggle({ variant = 'pill', className }: { variant?: 'pill' | 'row'; className?: string }) {
  const hydrated = useHydrated()
  const stored = useSettingsStore((s) => s.simpleView)
  const setSimpleView = useSettingsStore((s) => s.setSimpleView)
  const on = hydrated && stored

  if (variant === 'row') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setSimpleView(!on)}
        className={cn('flex w-full items-center justify-between gap-4 text-left', className)}
      >
        <span className="min-w-0">
          <span className="block text-ink">Simple view</span>
          <span className="block text-[13px] text-dim simple:text-[15px]">Big buttons, fewer words</span>
        </span>
        <Switch on={on} />
      </button>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Simple view"
      title={on ? 'Simple view is on: tap to show everything' : 'Simple view: big buttons, fewer words'}
      onClick={() => setSimpleView(!on)}
      className={cn(
        'flex h-8 shrink-0 items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors tall:h-10 tall:px-3 tall:text-[13px]',
        on ? 'border-felt text-ink' : 'border-control text-soft hover:border-dim hover:text-ink',
        className,
      )}
    >
      <span>Simple</span>
      <Switch on={on} />
    </button>
  )
}
