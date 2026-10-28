import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import { GAMES, GAME_BY_NAME } from '@/lib/game-catalog'
import { GAME_TUTORIALS } from '@/lib/game-tutorials'
import { GAME_MAX_MULT, formatMaxMult } from '@/lib/ladder/rules'
import type { GameName } from '@/store/types'
import { PageTitle, SectionTitle, Suit } from '@/components/ui/terminal'
import { HowItWorks, StartPanel } from '@/components/mode-intro'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/back-button'
import { PayoutCaption } from '@/components/game-payout'

type Params = Promise<{ game: string }>

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.name }))
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { game } = await params
  const entry = GAME_BY_NAME.get(game as GameName)
  return entry ? { title: `How to play ${entry.label} · Floored` } : {}
}

/** One game's rules: the round step by step, what to know, and the way into Freeplay to try it. */
export default async function HowToPlayPage({ params }: { params: Params }) {
  const { game } = await params
  const entry = GAME_BY_NAME.get(game as GameName)
  const tutorial = entry ? GAME_TUTORIALS[entry.name] : undefined
  if (!entry || !tutorial) notFound()

  const others = GAMES.filter((g) => g.name !== entry.name)
  const maxMult = GAME_MAX_MULT[entry.name]

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-10 pb-12">
      <PageTitle title={`How to play ${entry.label}`} sub={tutorial.intro} aside={<BackButton />} />

      <StartPanel
        figures={[
          {
            label: 'Pays up to',
            value: maxMult === Infinity ? 'No cap' : maxMult == null ? 'Varies' : formatMaxMult(entry.name),
          },
          { label: 'Practice balance', value: '10K' },
          { label: 'Minimum bet', value: 'None' },
        ]}
        action={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/freeplay/${entry.name}`}>Play in Freeplay →</Link>
          </Button>
        }
        note="Freeplay is play money with no pressure. The rules are the same in Daily, Ladder and Survival."
      />

      <HowItWorks steps={tutorial.steps} delay={180} />

      {tutorial.notes.length > 0 && (
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
      )}

      <section className="rise flex flex-col gap-4 [--d:300ms]" aria-labelledby="other-games">
        <SectionTitle suit={3} note="Rules for every game">
          <span id="other-games">Other games</span>
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((g, i) => (
            <li key={g.name} className="rise border-t border-rule" style={{ '--d': `${320 + i * 15}ms` } as CSSProperties}>
              <Link
                href={`/how-to-play/${g.name}`}
                className="m-instant group flex items-baseline justify-between gap-4 py-3 transition-[padding] duration-200 hover:pl-1.5"
              >
                <span className="min-w-0">
                  <span className="mark-line text-[14px] font-medium text-ink">{g.label}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-dim">{g.sub}</span>
                </span>
                <PayoutCaption game={g.name} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
