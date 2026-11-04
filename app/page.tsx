import type { CSSProperties } from 'react'
import { ModeSelect } from '@/components/mode-select'
import { PageTitle, Suit } from '@/components/ui/terminal'
import { DailyCountdown } from '@/components/daily/countdown'
import { HouseQuote } from '@/components/house-quote'
import { ZoomHint } from '@/components/zoom-hint'
import { GAMES } from '@/lib/game-catalog'
import { STORY_ENABLED, TABLES_ENABLED } from '@/lib/features'

/** How the site fits together: each card jumps to its group of modes below. */
const GUIDE = [
  ...(STORY_ENABLED
    ? [
        {
          href: '#story',
          title: 'Story',
          body: 'The Circuit is a campaign: play nights, take work and beat each city\'s boss to move on. Its money is its own and touches nothing else.',
        },
      ]
    : []),
  {
    href: '#compete',
    title: 'Compete',
    body: 'Challenges and the Ladder are the real game: set runs with a fixed start, scored and kept in your records. A new Daily challenge and Daily ladder every day, the same for everyone.',
  },
  {
    href: '#play',
    title: 'Practise',
    body: `Freeplay opens all ${GAMES.length} games with a balance you can reset. Train for each mode here: learn a game's odds before you take it into a challenge or up the ladder.`,
  },
  ...(TABLES_ENABLED
    ? [
        {
          href: '#play',
          title: 'Just for fun',
          body: "Tables seats you with bots at Hold'em, Liar's Dice and Blackjack Showdown, on a wallet of its own. Nothing there touches your other modes.",
        },
      ]
    : []),
]

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-10 pb-12">
      <div className="flex flex-col gap-3">
        <PageTitle
          title={
            <>
              <span className="simple:hidden">Welcome to Floored</span>
              <span className="hidden simple:inline">What do you want to play?</span>
            </>
          }
          sub={`A casino with ${GAMES.length} games and nothing at stake: everything here is play money, nothing costs or pays out real money.`}
          aside={
            <p className="text-[13px] text-dim simple:hidden">
              Next daily in <DailyCountdown className="num text-ink" />
            </p>
          }
        />
        <div className="rise [--d:60ms] simple:hidden">
          <HouseQuote />
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 simple:hidden" aria-label="How Floored works">
        {GUIDE.map((g, i) => (
          <li key={g.title} className="rise" style={{ '--d': `${80 + i * 60}ms` } as CSSProperties}>
            <a
              href={g.href}
              className="group flex h-full flex-col gap-1.5 rounded-md bg-surface px-5 py-4 shadow-[inset_0_0_0_1px_var(--line)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(217,164,65,0.35)]"
            >
              <span className="flex items-baseline gap-2 text-[15px] font-semibold text-ink">
                <Suit index={i} className="text-[11px] opacity-80" />
                {g.title}
                <span aria-hidden className="ml-auto text-dim transition-colors group-hover:text-gold">↓</span>
              </span>
              <span className="text-[13px] leading-5 text-soft">{g.body}</span>
            </a>
          </li>
        ))}
      </ol>

      <ModeSelect />
      <ZoomHint />
    </div>
  )
}
