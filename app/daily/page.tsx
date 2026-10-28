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
  const [pending, setPending] = useState<GameName | null>(null)

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
  const started = usedBets > 0
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
          <p className="text-[13px] text-dim">
            New daily in <DailyCountdown className="num text-ink" />
          </p>
        }
      />

      {record ? (
        <DailyResults record={record} />
      ) : (
        <div className="flex flex-col gap-4">
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
          {!started && (
            <p className="max-w-[72ch] text-[13px] leading-5 text-soft">
              You get <span className="num text-ink">{formatChips(challenge.bankroll)}</span> for all three games and
              must place every bet, each at least <span className="num text-ink">{formatChips(challenge.minBet)}</span>.
              Split your bankroll to finish with as much as you can — drop below the min bet and today&apos;s challenge is
              failed.
            </p>
          )}
        </div>
      )}

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
                  <UnitTrack
                    total={bets}
                    done={bets - left}
                    label={`${bets - left} of ${bets} bets placed`}
                    className="max-w-[120px]"
                  />
                  <span className="mt-2 block text-xs text-dim">
                    <span className="num text-soft">{left}</span> of {bets} bet{bets === 1 ? '' : 's'} left
                  </span>
                </GameTile>
              </li>
            )
          })}
        </ul>
      </section>

      {(
        <section className="flex flex-col gap-4" aria-labelledby="daily-record">
          <SectionTitle suit={0} note="Kept in this browser">
            <span id="daily-record">Your record</span>
          </SectionTitle>
          <FigureStrip
            items={[
              { label: 'Dailies played', value: records.length },
              { label: 'Current streak', value: currentStreak(history, dailyDateKey()), unit: 'days' },
              { label: 'Best result', value: best > 0 ? formatMultiplier(best) : '—' },
            ]}
          />
        </section>
      )}
    </div>
  )
}
