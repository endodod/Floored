'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDailyStore, betsLeft } from '@/store/daily-store'
import { dailyDateKey, generateDailyChallenge, totalDailyBets } from '@/lib/daily/challenge'
import { bestMultiplier, currentStreak, formatMultiplier } from '@/lib/daily/share'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import { DailyCountdown } from '@/components/daily/countdown'
import { DailyResults } from '@/components/daily/daily-results'
import type { GameName } from '@/store/types'
import { FigureStrip, PageTitle, SectionTitle, UnitTrack, signed, toneOf } from '@/components/ui/terminal'
import { GameTile } from '@/components/game-tile'
import { PayoutCaption } from '@/components/game-payout'
import { ScreenSkeleton } from '@/components/screen-skeleton'
import { HowItWorks, ModeColumns, Rail, StartPanel } from '@/components/mode-intro'
import { ModeTutorial, useTutorial, type TutorialStep } from '@/components/mode-tutorial'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function DailyPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const syncToday = useDailyStore((s) => s.syncToday)
  const abandonOpenRound = useDailyStore((s) => s.abandonOpenRound)
  const date = useDailyStore((s) => s.date)
  const bankroll = useDailyStore((s) => s.bankroll)
  const progress = useDailyStore((s) => s.progress)
  const finished = useDailyStore((s) => s.finished)
  const history = useDailyStore((s) => s.history)
  const started = useDailyStore((s) => s.started)
  const startDay = useDailyStore((s) => s.startDay)
  const giveUp = useDailyStore((s) => s.giveUp)
  const [pending, setPending] = useState<GameName | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  // The intro screen lays the rules out, so the dialog only opens from "How to play".
  const tutorial = useTutorial('daily', { auto: false })

  useEffect(() => {
    syncToday()
    abandonOpenRound()
    // Switch to the new challenge if the page is left open past 00:00 UTC.
    const id = setInterval(syncToday, 1000)
    return () => clearInterval(id)
  }, [syncToday, abandonOpenRound])

  const challenge = useMemo(() => generateDailyChallenge(date ?? dailyDateKey()), [date])
  const record = date ? history[date] : undefined

  useEffect(() => {
    challenge.games.forEach(({ game }) => router.prefetch(`/daily/${game}`))
  }, [challenge, router])

  if (!hydrated || !date || date !== dailyDateKey()) return <ScreenSkeleton />

  const totalBets = totalDailyBets(challenge)
  const usedBets = challenge.games.reduce((sum, g) => sum + (progress[g.game]?.betsUsed ?? 0), 0)
  const steps = dailySteps(challenge.bankroll, challenge.minBet)
  // Intro until the player presses Play daily; the games once under way; the result once over.
  const playing = started && !record
  const net = bankroll - challenge.bankroll
  const records = Object.values(history)
  const best = bestMultiplier(history)

  function handlePick(game: GameName) {
    if (pending) return
    setPending(game)
    router.push(`/daily/${game}`)
  }

  const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      <PageTitle
        title={`Daily #${challenge.number}`}
        sub={`${dateLabel} · the same challenge for everyone, one attempt.`}
        aside={
          <>
            <p className="text-[13px] text-dim">
              New daily in <DailyCountdown className="num text-ink" />
            </p>
            {playing && (
              <>
                <Button variant="ghost" size="sm" onClick={() => tutorial.setOpen(true)}>
                  How to play
                </Button>
                <Button variant="destructive" onClick={() => setConfirmGiveUp(true)}>
                  Give up
                </Button>
              </>
            )}
          </>
        }
      />

      <ModeTutorial
        id="daily"
        title="Daily"
        intro="The same challenge for everyone, one attempt."
        steps={steps}
        open={tutorial.open}
        onOpenChange={tutorial.setOpen}
      />

      <Dialog open={confirmGiveUp} onOpenChange={setConfirmGiveUp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Give up today&apos;s daily?</DialogTitle>
            <DialogDescription>
              Your bankroll of <span className="num text-ink">{formatChips(bankroll)}</span> becomes today&apos;s
              result. The daily counts as not completed, so it ends your streak, and there is no replay until
              tomorrow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep playing</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmGiveUp(false)
                giveUp()
              }}
            >
              Give up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModeColumns
        rail={
          <>
            <Rail
              title="Today's bet slip"
              note={`${totalBets - usedBets} of ${totalBets} bets left`}
              footer={`Every bet must be at least ${formatChips(challenge.minBet)}.`}
            >
              <ul className="divide-y divide-rule">
                {challenge.games.map(({ game, bets }) => {
                  const p = progress[game]
                  const left = betsLeft(progress, game, bets)
                  const gameNet = p && p.betsUsed > 0 ? p.returned - p.wagered : null
                  const active = !record && !finished && left > 0
                  return (
                    <li key={game} className="flex flex-col gap-2 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`text-[13px] ${active ? 'text-ink' : 'text-soft'}`}>
                          {GAME_BY_NAME.get(game)?.label ?? game}
                        </span>
                        <span
                          className={`num text-xs ${
                            gameNet == null ? 'text-dim' : gameNet > 0 ? 'text-felt' : gameNet < 0 ? 'text-loss' : 'text-ink'
                          }`}
                        >
                          {gameNet == null ? '—' : signed(gameNet, formatChips)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <UnitTrack
                          total={bets}
                          done={bets - left}
                          label={`${bets - left} of ${bets} bets placed`}
                          className="max-w-[140px] flex-1"
                        />
                        <span className="text-xs text-dim">
                          <span className="num text-soft">{left}</span> left
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Rail>
            <Rail title="Your record" note="Kept in this browser" delay={240}>
              <dl className="divide-y divide-rule">
                {[
                  { label: 'Dailies played', value: records.length },
                  { label: 'Current streak', value: `${currentStreak(history, dailyDateKey())} days` },
                  { label: 'Best result', value: best > 0 ? formatMultiplier(best) : '—' },
                ].map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-[13px] text-dim">{r.label}</dt>
                    <dd className="num text-[13px] text-ink">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </Rail>
          </>
        }
      >
        {record ? (
          <DailyResults record={record} />
        ) : playing ? (
          <FigureStrip
            items={[
              {
                label: 'Bankroll',
                value: formatChips(bankroll),
                unit: `of ${formatChips(challenge.bankroll)}`,
                tone: bankroll < challenge.minBet * 3 ? 'gold' : undefined,
              },
              { label: 'Net', value: signed(net, formatChips), tone: toneOf(net) },
              { label: 'Bets left', value: totalBets - usedBets, unit: `/ ${totalBets}` },
              { label: 'Min bet', value: formatChips(challenge.minBet) },
            ]}
          />
        ) : (
          <StartPanel
            figures={[
              { label: 'Shared bankroll', value: formatChips(challenge.bankroll) },
              { label: 'Games', value: challenge.games.length },
              { label: 'Bets to place', value: totalBets },
              { label: 'Min bet', value: formatChips(challenge.minBet) },
            ]}
            action={
              <Button onClick={startDay} size="lg">
                Play daily
              </Button>
            }
            note="One attempt: once you start, the day only ends when every bet is placed, your bankroll drops below the min bet, or you give up."
          />
        )}

        {started || record ? (
          <section className="flex flex-col gap-4" aria-labelledby="daily-games">
            <SectionTitle suit={1} note={`${totalBets} bets across ${challenge.games.length} games, in any order`}>
              <span id="daily-games">Today&apos;s games</span>
            </SectionTitle>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {challenge.games.map(({ game, bets }, i) => {
                const entry = GAME_BY_NAME.get(game)
                if (!entry) return null
                const p = progress[game]
                const left = betsLeft(progress, game, bets)
                const playable = !finished && left > 0 && bankroll >= challenge.minBet
                const gameNet = p && p.betsUsed > 0 ? p.returned - p.wagered : null
                const isLoading = pending === game

                return (
                  <li key={game}>
                    <GameTile
                      index={i}
                      label={entry.label}
                      symbol={entry.symbol}
                      sub={entry.sub}
                      disabled={!playable || !!pending}
                      faded={!playable || (!!pending && !isLoading)}
                      loading={isLoading}
                      onClick={() => handlePick(game)}
                      meta={
                        gameNet != null ? (
                          <span className={`num ${gameNet > 0 ? 'text-felt' : gameNet < 0 ? 'text-loss' : 'text-soft'}`}>
                            {signed(gameNet, formatChips)}
                          </span>
                        ) : (
                          <PayoutCaption game={game} />
                        )
                      }
                      action={left === 0 ? 'Done' : finished ? 'Closed' : 'Play'}
                    >
                      <span className="block text-xs text-dim">
                        <span className="num text-soft">{left}</span> of {bets} bet{bets === 1 ? '' : 's'} left
                      </span>
                    </GameTile>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : (
          <>
            <section className="rise flex flex-col gap-3 [--d:180ms]" aria-labelledby="daily-preview">
              <SectionTitle suit={1} note="Play them in any order">
                <span id="daily-preview">Today&apos;s games</span>
              </SectionTitle>
              <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-3">
                {challenge.games.map(({ game, bets }) => (
                  <li key={game} className="flex flex-col gap-0.5 border-t border-rule py-3">
                    <span className="text-[14px] font-medium text-ink">{GAME_BY_NAME.get(game)?.label ?? game}</span>
                    <span className="flex items-baseline justify-between gap-3 text-xs text-dim">
                      <span>
                        <span className="num text-soft">{bets}</span> bet{bets === 1 ? '' : 's'}
                      </span>
                      <PayoutCaption game={game} className="text-xs text-dim" />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <HowItWorks steps={steps} delay={240} />
          </>
        )}
      </ModeColumns>
    </div>
  )
}

function dailySteps(bankroll: number, minBet: number): TutorialStep[] {
  return [
    {
      title: 'One shared bankroll',
      body: `Today everyone gets ${formatChips(bankroll)} for the whole challenge — the same amount, the same games.`,
    },
    {
      title: 'Three games, set bets',
      body: 'Each game has a fixed number of bets. Play them in any order and split your bankroll however you like.',
    },
    {
      title: 'Place every bet',
      body: `Every bet must be placed, each at least ${formatChips(minBet)}. Finish the day with as much as you can.`,
    },
    {
      title: 'Don’t go under',
      body: 'If your bankroll drops below the min bet before your last bet, today’s challenge is failed.',
    },
    {
      title: 'One attempt',
      body: 'There is no replay. Leaving a game mid-round forfeits that round’s stake, and the bet still counts.',
    },
    {
      title: 'Share the result',
      body: 'Your result is a spoiler-free grid to share. Streaks and your best day are kept in this browser.',
    },
  ]
}
