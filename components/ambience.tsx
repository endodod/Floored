'use client'

import { usePathname } from 'next/navigation'

type Mood = 'felt' | 'gold' | 'ember' | 'steel' | 'dim'

const MOODS: Mood[] = ['felt', 'gold', 'ember', 'steel', 'dim']

/** Each mode lights the table its own colour: the daily on green felt, the ladder in gold, survival in embers. */
function moodFor(pathname: string): Mood {
  if (pathname.startsWith('/ladder')) return 'gold'
  if (pathname.startsWith('/survival')) return 'ember'
  if (pathname.startsWith('/freeplay')) return 'steel'
  if (pathname.startsWith('/account') || pathname.startsWith('/auth')) return 'dim'
  return 'felt'
}

/** Fixed background: a mode-tinted lamp (crossfaded between modes), felt grain and a vignette. */
export function Ambience() {
  const mood = moodFor(usePathname() ?? '/')
  return (
    <div className="ambience" aria-hidden>
      {MOODS.map((m) => (
        <div key={m} className="ambience-lamp" data-mode={m} data-on={m === mood} />
      ))}
      <div className="ambience-vignette" />
      <div className="ambience-grain" />
    </div>
  )
}
