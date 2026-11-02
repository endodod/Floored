import type { CSSProperties } from 'react'
import { ModeSelect } from '@/components/mode-select'
import { PageTitle, Suit } from '@/components/ui/terminal'
import { DailyCountdown } from '@/components/daily/countdown'
import { HouseQuote } from '@/components/house-quote'
import { GAMES } from '@/lib/game-catalog'
import { TABLES_ENABLED } from '@/lib/features'

/** How the site fits together: each card jumps to its group of modes below. */
const GUIDE = [
  {
    href: '#compete',
    title: 'Compete',
    body: 'Challenges and the Ladder are the real game: set runs with a fixed start, scored and kept in your records. A new Daily challenge and Daily ladder every day, the same for everyone.',
  },
  {
    href: '#practise',
    title: 'Practise',
    body: `Freeplay opens all ${GAMES.length} games with a balance you can reset. Train for each mode here: learn a game's odds before you take it into a challenge or up the ladder.`,
  },
  ...(TABLES_ENABLED
    ? [
        {
          href: '#fun',
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
          title="Welcome to Floored"
          sub={`A casino with ${GAMES.length} games and nothing at stake: everything here is play money, nothing costs or pays out real money.`}
          aside={
            <p className="text-[13px] text-dim">
              Next daily in <DailyCountdown className="num text-ink" />
            </p>
          }
        />
        <div className="rise [--d:60ms]">
          <HouseQuote />
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="How Floored works">
        {GUIDE.map((g, i) => (
          <li key={g.href} className="rise" style={{ '--d': `${80 + i * 60}ms` } as CSSProperties}>
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
    </div>
  )
}
