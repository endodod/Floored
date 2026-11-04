'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Portrait } from '@/components/story/portrait'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import { CHARACTER_BY_ID } from '@/lib/story/content/characters'
import { JOB_LIMIT } from '@/lib/story/economy'
import { jobKindName, jobReward, type Job } from '@/lib/story/jobs'
import { formatChips } from '@/utils/format'

const money = (n: number) => `$${formatChips(n)}`
const isLook = (id: string): id is PortraitLook => (PORTRAIT_LOOKS as string[]).includes(id)

/**
 * The jobs notebook: a matchbook that opens from the HUD with tonight's two
 * hustles (ticked once met tonight), the jobs you took (pay and standing), who
 * has a job waiting for you, and last night's net.
 */
export function Notebook({
  hustles,
  jobs,
  offers,
  hustlePay,
  minBet,
  nightOn,
  lastNet,
  onLastNight,
  onClose,
}: {
  hustles: { id: string; text: string; met: boolean }[]
  /** Jobs you took in this town. */
  jobs: Job[]
  /** Jobs waiting at their giver until you talk to them. */
  offers: Job[]
  hustlePay: number
  /** The city's minimum bet: job pay is in multiples of it. */
  minBet: number
  nightOn: boolean
  lastNet: number | null
  onLastNight?: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  return (
    <>
      <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 z-30 cursor-default bg-black/30" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="jobs-h"
        className="st-notebook st-motion absolute inset-x-2 top-2 z-40 flex max-h-[calc(100%_-_1rem)] flex-col overflow-hidden rounded-md outline-none sm:inset-x-auto sm:right-3 sm:w-[360px]"
      >
        <div className="st-matchbook flex items-center gap-3 px-4 py-2.5">
          <span aria-hidden className="st-striker h-6 w-2.5 shrink-0 rounded-[2px]" />
          <div className="min-w-0 flex-1">
            <h2 id="jobs-h" className="font-mono text-[15px] font-bold uppercase tracking-[0.2em] text-[#f7eed6]">Jobs</h2>
            <p className="text-[11px] leading-4 text-[#f0c9a8]">Hustles pay {money(hustlePay)} each when the night ends</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close jobs" className="flex h-8 w-8 items-center justify-center rounded-full text-[#f7eed6]/80 hover:bg-black/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="st-paper flex min-h-0 flex-col gap-3 px-4 pb-4 pt-3 text-[#2a2420]">
          <section aria-label="Tonight's hustles">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6f6354]">{nightOn ? 'Tonight' : 'Next night'}</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {hustles.map((h) => (
                <li key={h.id} className="flex items-start gap-2 text-[13.5px] leading-5">
                  <span aria-hidden className={`mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] text-[12px] font-black ${h.met ? 'border-[#1d5a3e] bg-[#1d5a3e] text-[#f7eed6]' : 'border-[#2a2420]/50'}`}>
                    {h.met ? '✓' : ''}
                  </span>
                  <span className={h.met ? 'text-[#1d5a3e]' : undefined}>
                    {h.text}
                    <span className="sr-only">{h.met ? ' (met)' : ' (not met yet)'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {(jobs.length > 0 || offers.length > 0) && (
            <section aria-label="Jobs" className="border-t border-dashed border-[#2a2420]/30 pt-2.5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6f6354]">
                Jobs · {jobs.length + offers.length} of {JOB_LIMIT}
              </p>
              <ul className="mt-1.5 flex flex-col gap-2">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-start gap-2.5">
                    <span className="w-7 shrink-0">{isLook(j.giver) && <Portrait look={j.giver} className="block w-full [&_svg]:h-auto [&_svg]:w-full" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold leading-5">{j.title}</span>
                      <span className="block text-[12.5px] leading-[17px] text-[#5a4f43]">{j.task}</span>
                      <span className="mt-0.5 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#1d5a3e]">
                        {jobKindName(j)} · {jobReward(j, minBet)}
                      </span>
                      <span className="sr-only">From {CHARACTER_BY_ID.get(j.giver)?.name ?? j.giver}</span>
                    </span>
                  </li>
                ))}
                {offers.map((j) => (
                  <li key={j.id} className="flex items-center gap-2.5">
                    <span className="w-7 shrink-0">{isLook(j.giver) && <Portrait look={j.giver} className="block w-full [&_svg]:h-auto [&_svg]:w-full" />}</span>
                    <span className="min-w-0 flex-1 text-[12.5px] italic leading-[17px] text-[#5a4f43]">
                      {CHARACTER_BY_ID.get(j.giver)?.name ?? j.giver} has a {jobKindName(j)} for you. Go and talk to them.
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {lastNet != null && onLastNight && (
            <button type="button" onClick={onLastNight} className="flex items-center justify-between border-t border-dashed border-[#2a2420]/30 pt-2.5 text-left font-mono text-[12px] text-[#5a4f43] hover:text-[#2a2420] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
              <span className="uppercase tracking-[0.16em]">Last night&apos;s tab</span>
              <span className={`num font-bold ${lastNet < 0 ? 'text-[#8f2633]' : 'text-[#1d5a3e]'}`}>
                {lastNet < 0 ? '-' : '+'}
                {money(Math.abs(lastNet))}
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}

/** News as slips of paper pinned to the corner of the street; each one can be dismissed. */
export function NewsSlips({ news, onDismiss }: { news: { id: number; text: string }[]; onDismiss: (id: number) => void }) {
  if (!news.length) return null
  return (
    <ul className="pointer-events-none absolute left-2 right-2 top-2 z-20 flex flex-col items-end gap-1.5 sm:left-auto sm:right-3 sm:top-3 sm:w-[300px]" aria-label="News" aria-live="polite">
      {news.slice(0, 3).map((n, i) => (
        <li
          key={n.id}
          className="st-slip st-motion pointer-events-auto flex w-full max-w-[300px] items-start gap-2 py-2 pl-3 pr-1.5 text-[12.5px] leading-[17px] text-[#2a2420]"
          style={{ rotate: `${i % 2 ? 0.8 : -0.8}deg` }}
        >
          <span className="min-w-0 flex-1">{n.text}</span>
          <button type="button" onClick={() => onDismiss(n.id)} className="-my-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#6f6354] hover:bg-black/10 hover:text-[#2a2420] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </li>
      ))}
      {news.length > 3 && <li className="pointer-events-auto font-mono text-[10px] uppercase tracking-[0.16em] text-dim">+{news.length - 3} more</li>}
    </ul>
  )
}
