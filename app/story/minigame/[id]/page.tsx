'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { StoryHud } from '@/components/story/hud'
import { Portrait } from '@/components/story/portrait'
import { LastOrdersBoard } from '@/components/story/minigames/last-orders'
import { ShuffleTrackerBoard } from '@/components/story/minigames/shuffle-tracker'
import { useHydrated } from '@/hooks/use-hydrated'
import { CITY_BY_ID } from '@/lib/story/cities'
import { CHARACTERS } from '@/lib/story/content/characters'
import { MINIGAME_MAX_M } from '@/lib/story/economy'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import type { MinigameId } from '@/lib/story/types'
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
}

type Stage = 'intro' | 'playing' | 'done'

function Minigame({ id }: { id: MinigameId }) {
  const router = useRouter()
  const city = useStoryStore((s) => CITY_BY_ID.get(s.city)!)
  const giver = CHARACTERS.find((c) => c.minigame === id && c.city === city.id)!
  const paidTonight = useStoryStore((s) => s.minigameNight[giver.id] === s.night)
  const playMinigame = useStoryStore((s) => s.playMinigame)
  const [stage, setStage] = useState<Stage>('intro')
  const [run, setRun] = useState(0)
  // Whether this run pays is fixed when it starts, before the store marks the night as paid.
  const [payable, setPayable] = useState(!paidTonight)
  const [result, setResult] = useState<{ score: number; paid: number; payable: boolean } | null>(null)
  const settled = useRef<number | null>(null)
  const info = INFO[id]!
  const maxPay = Math.round(MINIGAME_MAX_M * city.minBet)
  const look = giver.id as PortraitLook

  const begin = () => {
    setPayable(!paidTonight)
    setResult(null)
    setRun((r) => r + 1)
    setStage('playing')
  }

  const onFinish = useCallback(
    (score: number) => {
      if (settled.current === run) return
      settled.current = run
      const paid = playMinigame(giver.id, id, score)
      setResult({ score, paid, payable })
      setStage('done')
    },
    [run, playMinigame, giver.id, id, payable],
  )

  const showPay = stage === 'intro' ? !paidTonight : payable
  const Board = id === 'last-orders' ? LastOrdersBoard : ShuffleTrackerBoard

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
          {stage !== 'done' && <p className={`shrink-0 text-[13px] ${showPay ? 'text-gold' : 'text-dim'}`} data-testid="pay-note">
            {showPay
              ? stage === 'intro'
                ? `Pays up to ${money(maxPay)} — only your first game each night pays; after that it's practice.`
                : `Pays up to ${money(maxPay)} tonight`
              : `Practice — ${giver.name} already paid you tonight. Come back tomorrow night for another paid shift.`}
          </p>}

          {stage === 'intro' && (
            <div className="flex flex-col items-start gap-3 st-card rounded-md p-4">
              <p className="text-[13px] text-soft">{info.intro}</p>
              <div className="flex gap-2">
                <Button size="lg" onClick={begin}>Start</Button>
                <Button asChild size="lg" variant="ghost"><Link href="/story">Back to {city.name}</Link></Button>
              </div>
            </div>
          )}

          {stage === 'playing' && <Board key={run} onFinish={onFinish} />}

          {stage === 'done' && result && (
            <div className="flex flex-col gap-3 st-card rounded-md p-4" data-testid="result">
              <p className="num text-2xl font-semibold text-ink">{Math.round(result.score * 100)}%</p>
              <p className="text-[13px] text-soft" data-testid="result-pay">
                {result.payable ? `You earned ${money(result.paid)}.` : `Practice round: no pay. ${giver.name} already paid you tonight, so come back tomorrow night for another paid shift. Jobs still count.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={begin}>Play again</Button>
                <Button variant="outline" onClick={() => router.push('/story')}>Back to {city.name}</Button>
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
  const ok = started && id in INFO && CHARACTERS.some((c) => c.minigame === id && c.city === cityId)

  useEffect(() => {
    if (hydrated && !ok) router.replace('/story')
  }, [hydrated, ok, router])

  if (!hydrated || !ok) return null
  return <Minigame key={id} id={id as MinigameId} />
}
