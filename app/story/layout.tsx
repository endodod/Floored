import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STORY_ENABLED } from '@/lib/features'

/**
 * Story mode is desktop-only for now (owner decision 2026-11-05): below the `sm`
 * breakpoint (640px, the same line Survival uses) every story page shows a note
 * instead. Pure CSS, so a phone never flashes the street first.
 */
export default function StoryLayout({ children }: { children: React.ReactNode }) {
  if (!STORY_ENABLED) notFound()
  return (
    <>
      <div className="hidden sm:contents">{children}</div>
      <section className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center sm:hidden" aria-labelledby="story-desktop-only">
        <p className="felt-print !text-[10px]">The Circuit</p>
        <h1 id="story-desktop-only" className="text-xl font-semibold text-ink">
          Story mode is desktop only for now
        </h1>
        <p className="text-[14px] leading-5 text-soft">Open Floored on a computer or a wider screen to play it. Your progress is saved in this browser.</p>
        <Link href="/" className="mt-2 text-[14px] font-medium text-gold underline-offset-4 hover:underline">
          Back to all modes
        </Link>
      </section>
    </>
  )
}
