import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SectionTitle, Suit } from '@/components/ui/terminal'
import type { TutorialStep } from '@/components/mode-tutorial'

/**
 * The shared layout of a mode's intro screen (and its in-run hub): the work on
 * the left, the mode's own track as a rail on the right. The rail keeps its
 * content height and stays in view while the left side scrolls.
 */
export function ModeColumns({ children, rail, className }: { children: ReactNode; rail: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 simple:grid-cols-1 simple:gap-6', className)}>
      <div className="flex min-w-0 flex-col gap-10 simple:gap-6">{children}</div>
      {/* Simple view keeps the one column: the figures and the game cards already say where you are. */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-0 simple:hidden">{rail}</aside>
    </div>
  )
}

/** A rail card: a heading with a note, the track inside a surface. */
export function Rail({
  title,
  note,
  children,
  footer,
  delay = 160,
}: {
  title: string
  note?: ReactNode
  children: ReactNode
  footer?: ReactNode
  delay?: number
}) {
  return (
    <section
      className="rise flex flex-col gap-2"
      style={{ '--d': `${delay}ms` } as CSSProperties}
      aria-label={title}
    >
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {note && <p className="text-xs text-dim">{note}</p>}
      </div>
      <div className="rounded-md bg-surface px-4 py-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">{children}</div>
      {footer && <div className="px-1 text-xs leading-5 text-dim">{footer}</div>}
    </section>
  )
}

/** "How it works": the tutorial's steps laid out in two columns so they fill the width. */
export function HowItWorks({ steps, delay = 60 }: { steps: TutorialStep[]; delay?: number }) {
  return (
    <section className="rise flex flex-col gap-4 simple:hidden" style={{ '--d': `${delay}ms` } as CSSProperties} aria-labelledby="how-it-works">
      <SectionTitle suit={0}>
        <span id="how-it-works">How it works</span>
      </SectionTitle>
      <ol className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3 border-t border-rule py-4">
            <Suit index={i} className="w-4 shrink-0 pt-0.5 text-center text-[13px]" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-soft">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * The way in: the mode's opening figures beside one large action, on a felt-lit
 * panel. Figures are label over mono value.
 */
export function StartPanel({
  figures,
  action,
  note,
  delay = 120,
}: {
  figures: { label: string; value: ReactNode }[]
  action: ReactNode
  note?: ReactNode
  delay?: number
}) {
  return (
    <section
      className="rise relative w-full overflow-hidden rounded-md bg-surface p-5 simple:max-w-2xl shadow-[inset_0_0_0_1px_rgba(79,174,132,0.22),0_0_70px_-30px_rgba(79,174,132,0.55)] sm:p-6"
      style={{ '--d': `${delay}ms` } as CSSProperties}
      aria-label="Start"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between simple:flex-col simple:items-stretch simple:gap-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-3 simple:grid simple:grid-cols-2 simple:gap-x-4 simple:gap-y-4 sm:simple:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-dim simple:text-[15px] simple:text-soft">{f.label}</dt>
              <dd className="num mt-0.5 text-xl leading-7 text-ink simple:text-[26px] simple:leading-9">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="shrink-0 simple:[&>*]:w-full">{action}</div>
      </div>
      {note && <p className="mt-4 text-xs leading-5 text-dim simple:hidden">{note}</p>}
    </section>
  )
}
