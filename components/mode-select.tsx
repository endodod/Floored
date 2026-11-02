'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSurvivalStore } from '@/store/survival-store'
import { FLOOR_BET_LIMIT, MAX_FLOORS, STARTING_BANKROLL } from '@/lib/survival/balance'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_ENABLED, SURVIVAL_ENABLED, TABLES_ENABLED } from '@/lib/features'
import { useTablesStore } from '@/store/tables-store'
import { TABLE_GAMES } from '@/lib/tables/catalog'
import { TABLES_START_WALLET } from '@/lib/tables/stakes'
import { useLadderStore } from '@/store/ladder-store'
import { useChallengeStore } from '@/store/challenge-store'
import { PRESET_CHALLENGES } from '@/lib/challenges/presets'
import { CHALLENGE_START_BANKROLL } from '@/lib/challenges/types'
import { CHECKPOINT_EVERY, LADDER_LIVES, LADDER_RUNGS, START_POT, livesActive } from '@/lib/ladder/rules'
import { useFreeplayStore } from '@/store/freeplay-store'
import { GAMES } from '@/lib/game-catalog'
import { formatChips } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { SectionTitle, UnitTrack } from '@/components/ui/terminal'
import { ModeRow, ModeRowList } from '@/components/mode-row'
import { DailyChallengeRow, DailyLadderRow } from '@/components/daily/daily-rows'

export function ModeSelect() {
  const router = useRouter()
  const runActive = useSurvivalStore((s) => s.runActive)
  const currentFloor = useSurvivalStore((s) => s.currentFloor)
  const survivalBankroll = useSurvivalStore((s) => s.bankroll)
  const quotaTarget = useSurvivalStore((s) => s.quotaTarget)
  const isMobile = useIsMobile()
  const hydrated = useHydrated()
  const ladderStatus = useLadderStore((s) => s.status)
  const ladderRung = useLadderStore((s) => s.rung)
  const ladderPot = useLadderStore((s) => s.pot)
  const ladderLives = useLadderStore((s) => s.lives)
  const ladderHasLives = useLadderStore((s) => livesActive(s.checkpointRung))
  const freeplayBankroll = useFreeplayStore((s) => s.bankroll)
  const challengeAttempt = useChallengeStore((s) => s.attempt)
  const challengeStats = useChallengeStore((s) => s.stats)
  const tablesWallet = useTablesStore((s) => s.wallet)
  const tablesPlayed = useTablesStore((s) => s.history.length)
  const ladderClimbing = hydrated && ladderStatus === 'climbing'
  const survivalLive = hydrated && runActive

  const challengeLive = hydrated && challengeAttempt && !challengeAttempt.finished ? challengeAttempt : null
  const presetsTried = hydrated
    ? PRESET_CHALLENGES.filter((c) => (challengeStats[`preset:${c.id}`]?.tries ?? 0) > 0).length
    : 0
  const communityPlayed = hydrated ? Object.values(challengeStats).filter((x) => x.source === 'community').length : 0

  function handleSurvivalClick() {
    if (isMobile) return
    // The survival screen shows its intro (and the Start run button) when no run is live.
    router.push('/survival')
  }

  return (
    <div className="flex flex-col gap-12">
      {/* ── Compete: the real game modes ── */}
      <section id="compete" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="compete-title">
        <SectionTitle suit={0} note="Scored runs, kept in your records">
          <span id="compete-title">Compete</span>
        </SectionTitle>
        <ModeRowList>
          <DailyChallengeRow index={0} />
          {LADDER_ENABLED && <DailyLadderRow index={1} />}

          {/* ── Challenges ── */}
          <ModeRow
            index={2}
            name="Challenges"
            symbol="🎯"
            description={`${PRESET_CHALLENGES.length} themed house challenges: a set of games, a set number of bets on each, ${formatChips(CHALLENGE_START_BANKROLL)} to start. Retry as often as you like.`}
            track={<UnitTrack total={PRESET_CHALLENGES.length} done={presetsTried} label={`${presetsTried} of ${PRESET_CHALLENGES.length} tried`} />}
            trackCaption={`${presetsTried}/${PRESET_CHALLENGES.length} tried`}
            figureLabel={challengeLive ? challengeLive.def.name : 'Starting bankroll'}
            figure={formatChips(challengeLive ? challengeLive.bankroll : CHALLENGE_START_BANKROLL)}
            action={
              <Button asChild className="w-full lg:w-auto">
                <Link href={challengeLive ? '/challenge' : '/challenges'}>{challengeLive ? 'Continue' : 'Browse'}</Link>
              </Button>
            }
          />

          {/* ── Ladder ── */}
          {LADDER_ENABLED && (
            <ModeRow
              index={3}
              name="Ladder"
              symbol="🪜"
              description="The endless ladder: go all-in rung after rung, as many runs as you like. Any profit climbs; lose and you fall to the last checkpoint."
              track={
                <UnitTrack
                  total={LADDER_RUNGS}
                  done={ladderClimbing ? ladderRung : 0}
                  current={ladderClimbing ? ladderRung : undefined}
                  checkpointEvery={CHECKPOINT_EVERY}
                  label={ladderClimbing ? `On rung ${ladderRung + 1} of ${LADDER_RUNGS}` : `${LADDER_RUNGS} rungs`}
                />
              }
              trackCaption={
                ladderClimbing
                  ? `Rung ${ladderRung + 1}/${LADDER_RUNGS} · ${ladderHasLives ? `${ladderLives} of ${LADDER_LIVES} lives` : 'no lives until checkpoint'}`
                  : `${LADDER_RUNGS} rungs · checkpoint every ${CHECKPOINT_EVERY}`
              }
              figureLabel={ladderClimbing ? 'Pot' : 'Starting pot'}
              figure={formatChips(ladderClimbing ? ladderPot : START_POT)}
              action={
                <Button asChild className="w-full lg:w-auto">
                  <Link href="/ladder">{ladderClimbing ? 'Continue climb' : 'Start climb'}</Link>
                </Button>
              }
            />
          )}

          {/* ── Community challenges ── */}
          <ModeRow
            index={4}
            name="Community"
            symbol="🤝"
            description="Challenges made by players. Try theirs, or sign in and publish your own for others to beat."
            track={<UnitTrack total={1} done={communityPlayed > 0 ? 1 : 0} label={`${communityPlayed} community challenges played`} />}
            trackCaption={`${communityPlayed} played`}
            figureLabel="Starting bankroll"
            figure={formatChips(CHALLENGE_START_BANKROLL)}
            action={
              <Button asChild className="w-full lg:w-auto">
                <Link href="/community">Browse</Link>
              </Button>
            }
          />

          {/* ── Survival (toggle in lib/features.ts) ── */}
          {SURVIVAL_ENABLED && (
            <ModeRow
              index={5}
              name="Survival"
              symbol="🛡️"
              description={`Reach each floor's bankroll quota within ${FLOOR_BET_LIMIT} bets or the run ends. Sparks from each floor buy upgrades.`}
              track={
                <UnitTrack
                  total={MAX_FLOORS}
                  done={survivalLive ? currentFloor - 1 : 0}
                  current={survivalLive ? Math.min(currentFloor, MAX_FLOORS) - 1 : undefined}
                  label={survivalLive ? `On floor ${currentFloor} of ${MAX_FLOORS}` : `${MAX_FLOORS} floors`}
                />
              }
              trackCaption={
                survivalLive
                  ? `Floor ${currentFloor}/${MAX_FLOORS} · ${FLOOR_BET_LIMIT} bets a floor`
                  : `${MAX_FLOORS} floors · ${FLOOR_BET_LIMIT} bets a floor`
              }
              figureLabel={survivalLive ? 'Bankroll' : 'Starting bankroll'}
              figure={formatChips(survivalLive ? survivalBankroll : STARTING_BANKROLL)}
              figureSub={survivalLive ? `quota ${formatChips(quotaTarget)}` : undefined}
              action={
                <Button
                  className="w-full lg:w-auto"
                  onClick={handleSurvivalClick}
                  onMouseEnter={() => !isMobile && router.prefetch('/survival')}
                  disabled={isMobile}
                >
                  {isMobile ? 'Desktop only' : survivalLive ? 'Continue run' : 'Start run'}
                </Button>
              }
            />
          )}
        </ModeRowList>
      </section>

      {/* ── Practise ── */}
      <section id="practise" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="practise-title">
        <SectionTitle suit={1} note="Train for every mode">
          <span id="practise-title">Practise</span>
        </SectionTitle>
        <ModeRowList>
          {/* ── Freeplay ── */}
          <ModeRow
            index={6}
            name="Freeplay"
            symbol="🎮"
            description={`All ${GAMES.length} games with a balance you can reset. Learn a game here before you take it into a challenge or up the ladder.`}
            track={<UnitTrack total={GAMES.length} done={GAMES.length} label={`${GAMES.length} games open`} />}
            trackCaption={`${GAMES.length} games open`}
            figureLabel="Balance"
            figure={hydrated ? formatChips(freeplayBankroll) : '—'}
            action={
              <Button asChild className="w-full lg:w-auto">
                <Link href="/freeplay">Open lobby</Link>
              </Button>
            }
          />
        </ModeRowList>
      </section>

      {/* ── Just for fun (Tables; toggle in lib/features.ts) ── */}
      {TABLES_ENABLED && (
        <section id="fun" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="fun-title">
          <SectionTitle suit={2} note="Other ways to play, on their own wallet">
            <span id="fun-title">Just for fun</span>
          </SectionTitle>
          <ModeRowList>
            <ModeRow
              index={7}
              name="Tables"
              symbol="🃏"
              description="Hold'em, Liar's Dice and Blackjack Showdown against bots. Buy into a tournament for its prize pool, or bring chips to a cash table."
              track={<UnitTrack total={TABLE_GAMES.length} done={TABLE_GAMES.length} label={`${TABLE_GAMES.length} table games`} />}
              trackCaption={`${TABLE_GAMES.length} games · ${hydrated ? tablesPlayed : 0} tables played`}
              figureLabel="Wallet"
              figure={formatChips(hydrated ? tablesWallet : TABLES_START_WALLET)}
              action={
                <Button asChild className="w-full lg:w-auto">
                  <Link href="/tables">Choose a table</Link>
                </Button>
              }
            />
          </ModeRowList>
        </section>
      )}
    </div>
  )
}
