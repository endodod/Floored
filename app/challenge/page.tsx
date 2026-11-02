'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { challengeBetsLeft, useChallengeStore } from '@/store/challenge-store'
import { CHALLENGE_START_BANKROLL, totalChallengeBets } from '@/lib/challenges/types'
import { formatMultiplier } from '@/lib/daily/share'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { useHydrated } from '@/hooks/use-hydrated'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'
import { FigureStrip, PageTitle, SectionTitle, UnitTrack, signed, toneOf } from '@/components/ui/terminal'
import { GameTile } from '@/components/game-tile'
import { PayoutCaption } from '@/components/game-payout'
import { ScreenSkeleton } from '@/components/screen-skeleton'
import { ModeColumns, Rail } from '@/components/mode-intro'
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

/** The challenge being played: its games and bet slip, then its result. */
export default function ChallengeHubPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const attempt = useChallengeStore((s) => s.attempt)
  const stats = useChallengeStore((s) => (s.attempt ? s.stats[s.attempt.key] : undefined))
  const abandonOpenRound = useChallengeStore((s) => s.abandonOpenRound)
  const giveUp = useChallengeStore((s) => s.giveUp)
  const start = useChallengeStore((s) => s.start)
  const dismiss = useChallengeStore((s) => s.dismiss)
  const [pending, setPending] = useState<GameName | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)

  useEffect(() => {
    abandonOpenRound()
  }, [abandonOpenRound])

  const listHref = attempt?.source === 'community' ? '/community' : '/challenges'

  useEffect(() => {
    if (hydrated && !attempt) router.replace('/challenges')
  }, [hydrated, attempt, router])

  useEffect(() => {
    attempt?.def.games.forEach(({ game }) => router.prefetch(`/challenge/${game}`))
  }, [attempt?.def, router])

  if (!hydrated || !attempt) return <ScreenSkeleton />

  const { def, bankroll, progress, finished, endReason } = attempt
  const totalBets = totalChallengeBets(def)
  const usedBets = def.games.reduce((sum, g) => sum + Math.min(g.bets, progress[g.game]?.betsUsed ?? 0), 0)
  const net = bankroll - CHALLENGE_START_BANKROLL

  function handlePick(game: GameName) {
    if (pending) return
    setPending(game)
    router.push(`/challenge/${game}`)
  }

  function handleRetry() {
    if (!attempt) return
    start(attempt.source, attempt.def)
  }

  function handleBack() {
    dismiss()
    router.push(listHref)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8 pb-12">
      <PageTitle
        title={def.name}
        sub={
          <>
            <span className="text-gold">{def.theme}</span>
            {def.author ? ` · by ${def.author}` : ' · House challenge'}
            {def.description ? ` · ${def.description}` : ''}
          </>
        }
        aside={
          finished ? (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              ← All challenges
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={listHref}>← All challenges</Link>
              </Button>
              <Button variant="destructive" onClick={() => setConfirmGiveUp(true)}>
                Give up
              </Button>
            </>
          )
        }
      />

      <Dialog open={confirmGiveUp} onOpenChange={setConfirmGiveUp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Give up this attempt?</DialogTitle>
            <DialogDescription>
              The attempt ends with <span className="num text-ink">{formatChips(bankroll)}</span>. It counts as a try but
              not as a best — only attempts with every bet placed do. You can start again right away.
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
              title="Bet slip"
              note={`${totalBets - usedBets} of ${totalBets} bets left`}
              footer={`Every bet must be at least ${formatChips(def.minBet)}.`}
            >
              <ul className="divide-y divide-rule">
                {def.games.map(({ game, bets }) => {
                  const p = progress[game]
                  const left = challengeBetsLeft(attempt, game)
                  const gameNet = p && p.betsUsed > 0 ? p.returned - p.wagered : null
                  return (
                    <li key={game} className="flex flex-col gap-2 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`text-[13px] ${!finished && left > 0 ? 'text-ink' : 'text-soft'}`}>
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
            <Rail title="Your record" note="This challenge" delay={240}>
              <dl className="divide-y divide-rule">
                {[
                  { label: 'Tries', value: stats?.tries ?? 0 },
                  { label: 'Completed', value: stats?.completions ?? 0 },
                  { label: 'Best bankroll', value: stats?.best != null ? formatChips(stats.best) : '—' },
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
        {finished ? (
          <section className="rise flex flex-col gap-5 rounded-md bg-surface p-5 sm:p-6" aria-labelledby="challenge-result">
            <div>
              <h2
                id="challenge-result"
                className={`text-[13px] ${endReason === 'failed' ? 'text-loss' : 'text-dim'}`}
              >
                {endReason === 'gave-up' ? 'Gave up' : endReason === 'failed' ? 'Challenge failed' : 'Challenge complete'}
              </h2>
              <p className="mt-1 flex items-baseline gap-3">
                <span
                  className={`num text-[32px] leading-tight ${
                    endReason === 'failed' ? 'glow-loss text-loss' : net > 0 ? 'glow-felt text-felt' : 'text-ink'
                  }`}
                >
                  {formatChips(bankroll)}
                </span>
                {endReason === 'complete' && (
                  <span className={`num text-lg ${net >= 0 ? 'text-felt' : 'text-loss'}`}>
                    {formatMultiplier(bankroll / CHALLENGE_START_BANKROLL)}
                  </span>
                )}
              </p>
              <p className="mt-2 text-[13px] leading-5 text-soft">
                {endReason === 'complete'
                  ? stats?.best === bankroll && bankroll > 0
                    ? 'Every bet placed. That is your best on this challenge.'
                    : `Every bet placed. Your best is ${stats?.best != null ? formatChips(stats.best) : '—'}.`
                  : endReason === 'failed'
                    ? `Your bankroll fell below the ${formatChips(def.minBet)} min bet with bets left.`
                    : 'Only attempts with every bet placed count towards your best.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRetry}>Try again</Button>
              <Button variant="outline" onClick={handleBack}>
                All challenges
              </Button>
            </div>
          </section>
        ) : (
          <FigureStrip
            items={[
              {
                label: 'Bankroll',
                value: formatChips(bankroll),
                unit: `of ${formatChips(CHALLENGE_START_BANKROLL)}`,
                tone: bankroll < def.minBet * 3 ? 'gold' : undefined,
              },
              { label: 'Net', value: signed(net, formatChips), tone: toneOf(net) },
              { label: 'Bets left', value: totalBets - usedBets, unit: `/ ${totalBets}` },
              { label: 'Min bet', value: formatChips(def.minBet) },
            ]}
          />
        )}

        <section className="flex flex-col gap-4" aria-labelledby="challenge-games">
          <SectionTitle suit={1} note={`${totalBets} bets across ${def.games.length} games, in any order`}>
            <span id="challenge-games">Games</span>
          </SectionTitle>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {def.games.map(({ game, bets }, i) => {
              const entry = GAME_BY_NAME.get(game)
              if (!entry) return null
              const p = progress[game]
              const left = challengeBetsLeft(attempt, game)
              const playable = !finished && left > 0 && bankroll >= def.minBet
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
      </ModeColumns>
    </div>
  )
}
