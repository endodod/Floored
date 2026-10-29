'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSurvivalStore } from '@/store/survival-store'
import type { RunSummary as RunSummaryType } from '@/store/types'

interface RunSummaryProps {
  lastRun: RunSummaryType
}

function headline(lastRun: RunSummaryType): { title: string; description: string; accent: string } {
  if (lastRun.victory) {
    return {
      title: 'Victory',
      description: 'You cleared all 10 floors.',
      accent: 'text-felt',
    }
  }
  if (lastRun.endBankroll <= 0) {
    return {
      title: 'Defeated',
      description: 'Your bankroll hit zero.',
      accent: 'text-loss',
    }
  }
  return {
    title: 'Run over',
    description: lastRun.endlessMode
      ? `Endless run ended on floor ${lastRun.floorsReached}.`
      : 'Your survival run has ended.',
    accent: 'text-ink',
  }
}

export function RunSummary({ lastRun }: RunSummaryProps) {
  const router = useRouter()
  const clearLastRun = useSurvivalStore((s) => s.clearLastRun)
  const { title, description, accent } = headline(lastRun)

  function handleContinue() {
    clearLastRun()
    router.push('/')
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5 py-10" aria-labelledby="run-summary-title">
      <div className="rounded-md bg-surface p-6">
        <h1 id="run-summary-title" className={`text-[26px] font-semibold leading-tight ${accent}`}>
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-soft">{description}</p>
      </div>
      <Button onClick={handleContinue} size="lg" className="self-start">
        Back to modes
      </Button>
    </section>
  )
}
