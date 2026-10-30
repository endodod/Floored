import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TABLES_ENABLED } from '@/lib/features'
import { TABLE_GAMES, TABLE_GAME_BY_NAME, isTableGame } from '@/lib/tables/catalog'
import { CASH_STAKES, TABLE_TIERS, limitsLabel, payoutSplits } from '@/lib/tables/stakes'
import { TABLE_TUTORIALS } from '@/lib/tables/tutorials'
import type { TableGameName } from '@/lib/tables/types'
import { formatChips } from '@/utils/format'
import { PageTitle, SectionTitle, Suit } from '@/components/ui/terminal'
import { HowItWorks, StartPanel } from '@/components/mode-intro'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/back-button'

type Params = Promise<{ game: string }>

export function generateStaticParams() {
  return TABLE_GAMES.map((g) => ({ game: g.name }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { game } = await params
  const entry = TABLE_GAME_BY_NAME.get(game as TableGameName)
  return entry ? { title: `How to play ${entry.label} · Floored` } : {}
}

/** A table game's rules: the flow step by step, what to know, and the way to the Tables hub. */
export default async function TableHowToPlayPage({ params }: { params: Params }) {
  const { game } = await params
  const entry = TABLE_GAME_BY_NAME.get(game as TableGameName)
  if (!TABLES_ENABLED || !entry || !isTableGame(entry.name)) notFound()
  const tutorial = TABLE_TUTORIALS[entry.name]
  const others = TABLE_GAMES.filter((g) => g.name !== entry.name)

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-10 pb-12">
      <PageTitle title={`How to play ${entry.label}`} sub={tutorial.intro} aside={<BackButton fallback="/tables/lobby" />} />

      <StartPanel
        figures={[
          { label: 'Seats', value: entry.seats },
          { label: 'Buy-ins', value: TABLE_TIERS.map((t) => formatChips(t.buyIn)).join(' / ') },
          { label: 'Paid places', value: payoutSplits(entry.seats, entry.name).length },
          { label: 'Cash limits', value: CASH_STAKES[entry.name].map((s) => limitsLabel(entry.name, s)).join(' · ') },
        ]}
        action={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/tables/lobby">Choose a table →</Link>
          </Button>
        }
        note={`${entry.skill}. Play money from your Tables wallet; the bots only see what a player in their seat could.`}
      />

      <HowItWorks steps={tutorial.steps} delay={180} />

      <section className="rise flex flex-col gap-4 [--d:240ms]" aria-labelledby="good-to-know">
        <SectionTitle suit={1}>
          <span id="good-to-know">Good to know</span>
        </SectionTitle>
        <ul className="flex flex-col">
          {tutorial.notes.map((note, i) => (
            <li key={note} className="flex gap-3 border-t border-rule py-3 text-[13px] leading-5 text-soft">
              <Suit index={i + 1} className="w-4 shrink-0 pt-0.5 text-center text-[11px] opacity-70" />
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="rise flex flex-col gap-4 [--d:270ms]" aria-labelledby="cash-table">
        <SectionTitle suit={2} note={entry.cash.label}>
          <span id="cash-table">At a cash table</span>
        </SectionTitle>
        <p className="text-[13px] leading-5 text-dim">
          Sit down with any amount from your wallet, play as long as you like, and leave with your stack. No prize pool.
        </p>
        <ul className="flex flex-col">
          {tutorial.cash.map((note, i) => (
            <li key={note} className="flex gap-3 border-t border-rule py-3 text-[13px] leading-5 text-soft">
              <Suit index={i + 2} className="w-4 shrink-0 pt-0.5 text-center text-[11px] opacity-70" />
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="rise flex flex-col gap-4 [--d:300ms]" aria-labelledby="other-tables">
        <SectionTitle suit={3} note="Tables mode">
          <span id="other-tables">Other table games</span>
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {others.map((g) => (
            <li key={g.name} className="border-t border-rule">
              <Link
                href={`/how-to-play/tables/${g.name}`}
                className="m-instant group flex items-baseline justify-between gap-4 py-3 transition-[padding] duration-200 hover:pl-1.5"
              >
                <span className="min-w-0">
                  <span className="mark-line text-[14px] font-medium text-ink">{g.label}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-dim">{g.sub}</span>
                </span>
                <span className="text-xs text-dim">{g.seats} seats</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
