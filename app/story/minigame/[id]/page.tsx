'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { StoryHud } from '@/components/story/hud'
import { Portrait } from '@/components/story/portrait'
import { LastOrdersBoard } from '@/components/story/minigames/last-orders'
import { ShuffleTrackerBoard } from '@/components/story/minigames/shuffle-tracker'
import { ChipCountBoard } from '@/components/story/minigames/chip-count'
import { useHydrated } from '@/hooks/use-hydrated'
import { CITY_BY_ID } from '@/lib/story/cities'
import { CHARACTERS } from '@/lib/story/content/characters'
import { TRAVELLING_GIVERS } from '@/lib/story/jobs'
import type { CityId } from '@/lib/story/cities'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import type { MinigameId } from '@/lib/story/types'
import type { Job } from '@/lib/story/jobs'
import { useStoryStore } from '@/store/story-store'
import { formatChips } from '@/utils/format'

const money = (n: number) => `$${formatChips(n)}`

const INFO: Record<string, { title: string; rule: string; intro: string }> = {
  'last-orders': {
    title: 'Last Orders',
    rule: 'Watch the drinks light up, then tap them back in order. One mistake ends the shift.',
    intro: 'Six rounds. Orders grow from 3 drinks to 8.',
  },
  'shuffle-tracker': {
    title: 'Shuffle Tracker',
    rule: 'Follow the queen through the swaps, then tap her cup. Five rounds, each faster.',
    intro: 'Five rounds. More swaps and quicker hands each time.',
  },
  'chip-count': {
    title: 'Chip Count',
    rule: 'Count the stack and tap its total before the clock runs out. A wrong total costs that stack, not the shift.',
    intro: 'Five stacks: 4 chips up to 8, 9 seconds down to 5. Chips are worth 1, 5, 25 and 100.',
  },
}

/** Who offers a minigame here: someone from this town, or someone who travels with you (Jo). */
const giverOf = (id: string, city: CityId) =>
  CHARACTERS.find((c) => c.minigame === id && (c.city === city || (TRAVELLING_GIVERS as readonly string[]).includes(c.id)))

type Stage = 'intro' | 'playing' | 'done'

/**
 * A minigame is only played as a job (owner decision 2026-11-04): one attempt at the
 * job you took from its giver. Hit the target and the job pays; miss and it is gone.
 * No practice and no replay.
 */
function Minigame({ id, job }: { id: MinigameId; job: Job }) {
  const router = useRouter()
  const city = useStoryStore((s) => CITY_BY_ID.get(s.city)!)
  const giver = giverOf(id, city.id)!
  const playMinigame = useStoryStore((s) => s.playMinigame)
  const [stage, setStage] = useState<Stage>('intro')
  const [result, setResult] = useState<{ score: number; paid: number; hit: boolean } | null>(null)
  const settled = useRef(false)
  const info = INFO[id]!
  const target = job.goal.kind === 'minigame' ? job.goal.score : 1
  const pay = Math.round(job.pay * city.minBet)
  const look = giver.id as PortraitLook

  const onFinish = useCallback(
    (score: number) => {
      if (settled.current) return
      settled.current = true
      const paid = playMinigame(giver.id, id, score)
      setResult({ score, paid, hit: score >= target })
      setStage('done')
    },
    [playMinigame, giver.id, id, target],
  )

  const Board = id === 'last-orders' ? LastOrdersBoard : id === 'chip-count' ? ChipCountBoard : ShuffleTrackerBoard

  return (
    <div className="st-screen flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
      <StoryHud back />
      <div className="st-room relative flex min-h-0 flex-1 flex-col px-3 pt-3 sm:px-4">
        <div className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col gap-3 pb-2">
          <div className="flex shrink-0 items-center gap-3">
            <div className="w-12 shrink-0 overflow-hidden rounded-md">
              {PORTRAIT_LOOKS.includes(look) && <Portrait look={look} size={48} />}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold leading-6 text-ink">{info.title}</h1>
              <p className="text-xs leading-4 text-dim">{info.rule}</p>
            </div>
          </div>
          {stage !== 'done' && (
            <p className="shrink-0 text-[13px] text-gold" data-testid="pay-note">
              {job.title}: score {Math.round(target * 100)}% or more for {money(pay)}. One go.
            </p>
          )}

          {stage === 'intro' && (
            <div className="flex flex-col items-start gap-3 st-card rounded-md p-4">
              <p className="text-[13px] text-soft">{info.intro}</p>
              <p className="text-[13px] text-dim">Miss the mark and the job is gone. Minigame jobs earn no standing.</p>
              <div className="flex gap-2">
                <Button size="lg" onClick={() => setStage('playing')}>Start</Button>
                <Button asChild size="lg" variant="ghost"><Link href="/story">Not yet</Link></Button>
              </div>
            </div>
          )}

          {stage === 'playing' && <Board onFinish={onFinish} />}

          {stage === 'done' && result && (
            <div className="flex flex-col gap-3 st-card rounded-md p-4" data-testid="result">
              <p className={`num text-2xl font-semibold ${result.hit ? 'text-ink' : 'text-loss'}`}>{Math.round(result.score * 100)}%</p>
              <p className="text-[13px] text-soft" data-testid="result-pay">
                {result.hit
                  ? `Job done. ${giver.name} pays you ${money(result.paid)}.`
                  : `Short of ${Math.round(target * 100)}%. The job is gone; ${giver.name} will have other work.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => router.push('/story')}>Back to {city.name}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MinigamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const hydrated = useHydrated()
  const started = useStoryStore((s) => s.started)
  const cityId = useStoryStore((s) => s.city)
  const giver = giverOf(id, cityId)
  const live = useStoryStore((s) => (giver ? s.minigameJobAt(giver.id) : null))
  // The job this visit plays, fixed on arrival: the attempt removes it from the save,
  // and the result must stay on screen.
  const [job, setJob] = useState<Job | null>(null)
  useEffect(() => {
    if (hydrated && !job && live) setJob(live)
  }, [hydrated, job, live])
  const ok = started && id in INFO && !!giver && (!!job || !!live)

  useEffect(() => {
    if (hydrated && !ok) router.replace('/story')
  }, [hydrated, ok, router])

  if (!hydrated || !ok || !job) return null
  return <Minigame key={id} id={id as MinigameId} job={job} />
}
