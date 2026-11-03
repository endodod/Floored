'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSurvivalStore } from '@/store/survival-store'
import { FLOOR_BET_LIMIT, MAX_FLOORS, STARTING_BANKROLL } from '@/lib/survival/balance'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useHydrated } from '@/hooks/use-hydrated'
import { LADDER_ENABLED, STORY_ENABLED, SURVIVAL_ENABLED, TABLES_ENABLED } from '@/lib/features'
import { useTablesStore } from '@/store/tables-store'
import { TABLE_GAMES } from '@/lib/tables/catalog'
import { TABLES_START_WALLET } from '@/lib/tables/stakes'
import { useLadderStore } from '@/store/ladder-store'
import { useChallengeStore } from '@/store/challenge-store'
import { useStoryStore } from '@/store/story-store'
import { CITIES } from '@/lib/story/cities'
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

interface SimpleModeCardProps {
  name: string
  symbol: string
  /** What you do here, in a few words. */
  line: string
  figureLabel: string
  figure: ReactNode
  cta: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
  index: number
}

/** Simple view: one mode as a big app card — the symbol, the name, one figure, one button. The whole card is the tap target. */
function SimpleModeCard({ name, symbol, line, figureLabel, figure, cta, href, onClick, disabled, primary, index }: SimpleModeCardProps) {
  const body = (
    <>
      <span className="flex items-center gap-4">
        <span aria-hidden className="text-[40px] leading-none">{symbol}</span>
        <span className="min-w-0">
          <span className="block text-[24px] font-semibold leading-tight text-ink">{name}</span>
          <span className="mt-1 block text-[16px] leading-snug text-soft">{line}</span>
        </span>
      </span>
      <span className="flex items-baseline justify-between gap-3 border-t border-rule pt-3">
        <span className="text-[15px] text-dim">{figureLabel}</span>
        <span className="num text-[22px] text-ink">{figure}</span>
      </span>
      <span
        className={`flex h-14 items-center justify-center rounded-full text-[18px] font-semibold ${
          disabled
            ? 'border border-line bg-raised text-dim'
            : primary
              ? 'btn-glow border border-[rgba(217,164,65,0.45)] bg-[linear-gradient(180deg,#286746,#1b4d34)] text-[#fffaf0]'
              : 'border border-control text-ink group-hover:border-felt group-hover:bg-felt-tint'
        }`}
      >
        {cta}
      </span>
    </>
  )
  const cls =
    'rise group flex h-full flex-col gap-4 rounded-xl bg-surface p-5 text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] transition-colors hover:bg-[#17161c] active:scale-[0.99]'
  const style = { '--d': `${80 + index * 60}ms` } as CSSProperties
  return (
    <li>
      {href ? (
        <Link href={href} className={cls} style={style}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={`${cls} w-full disabled:opacity-60`} style={style}>
          {body}
        </button>
      )}
    </li>
  )
}

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
  const storyStarted = useStoryStore((s) => s.started)
  const storyCity = useStoryStore((s) => s.city)
  const storyMoney = useStoryStore((s) => s.money)
  const storyCleared = useStoryStore((s) => s.cleared.length)
  const storyLive = hydrated && storyStarted
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
      {/* ── Story: the campaign (toggle in lib/features.ts) ── */}
      {STORY_ENABLED && (
        <section id="story" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="story-title">
          <SectionTitle suit={3} note="A campaign across twelve cities">
            <span id="story-title">Story</span>
          </SectionTitle>
          <ModeRowList>
            <ModeRow
              index={0}
              name="The Circuit"
              symbol="🎲"
              description="Play nights at the tables, take work, and beat each city's boss to move on. Money, reputation and a rival one city ahead."
              track={<UnitTrack total={CITIES.length} done={storyLive ? storyCleared : 0} label={`${storyCleared} of ${CITIES.length} cities cleared`} />}
              trackCaption={storyLive ? `${CITIES.find((c) => c.id === storyCity)?.name} · ${storyCleared}/${CITIES.length} cleared` : `${CITIES.length} cities`}
              figureLabel="Money"
              figure={storyLive ? `$${formatChips(storyMoney)}` : '—'}
              action={
                <Button asChild className="w-full lg:w-auto">
                  <Link href="/story">{storyLive ? 'Continue' : 'Begin'}</Link>
                </Button>
              }
            />
          </ModeRowList>
        </section>
      )}
      {/* Simple view: every mode as a big card, one tap each. The grouped lists below stay for the full view. */}
      <ul className="hidden grid-cols-1 gap-4 simple:grid sm:grid-cols-2">
        <SimpleModeCard
          index={0}
          name="Challenges"
          symbol="🎯"
          line="Today’s daily and set challenges."
          figureLabel="Bankroll"
          figure={formatChips(challengeLive ? challengeLive.bankroll : CHALLENGE_START_BANKROLL)}
          cta={challengeLive ? 'Continue' : 'Pick a challenge'}
          href={challengeLive ? '/challenge' : '/challenges'}
          primary
        />
        {LADDER_ENABLED && (
          <SimpleModeCard
            index={1}
            name="Ladder"
            symbol="🪜"
            line="Win to climb. Lose and you drop."
            figureLabel="Pot"
            figure={formatChips(ladderClimbing ? ladderPot : START_POT)}
            cta={ladderClimbing ? 'Continue climb' : 'Climb'}
            href="/ladder"
          />
        )}
        <SimpleModeCard
          index={2}
          name="Freeplay"
          symbol="🎮"
          line="Any game. No rules."
          figureLabel="Balance"
          figure={hydrated ? formatChips(freeplayBankroll) : '—'}
          cta="Pick a game"
          href="/freeplay"
        />
        {TABLES_ENABLED && (
          <SimpleModeCard
            index={3}
            name="Tables"
            symbol="🃏"
            line="Play cards against bots."
            figureLabel="Wallet"
            figure={formatChips(hydrated ? tablesWallet : TABLES_START_WALLET)}
            cta="Choose a table"
            href="/tables"
          />
        )}
        <SimpleModeCard
          index={4}
          name="Community"
          symbol="🤝"
          line="Challenges made by players."
          figureLabel="Played"
          figure={communityPlayed}
          cta="Browse"
          href="/community"
        />
        {SURVIVAL_ENABLED && (
          <SimpleModeCard
            index={5}
            name="Survival"
            symbol="🛡️"
            line="Hit each floor’s target."
            figureLabel="Bankroll"
            figure={formatChips(survivalLive ? survivalBankroll : STARTING_BANKROLL)}
            cta={isMobile ? 'Desktop only' : survivalLive ? 'Continue run' : 'Start run'}
            onClick={handleSurvivalClick}
            disabled={isMobile}
          />
        )}
      </ul>

      {/* ── Compete: the real game modes ── */}
      <section id="compete" className="flex scroll-mt-24 flex-col gap-4 simple:hidden" aria-labelledby="compete-title">
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

      {/* ── Practise and play: Freeplay to train, Tables for fun ── */}
      <section id="play" className="flex scroll-mt-24 flex-col gap-4 simple:hidden" aria-labelledby="play-title">
        <SectionTitle suit={1} note={TABLES_ENABLED ? 'Train for every mode, or play just for fun' : 'Train for every mode'}>
          <span id="play-title">{TABLES_ENABLED ? 'Practise and play' : 'Practise'}</span>
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

          {/* ── Tables (toggle in lib/features.ts) ── */}
          {TABLES_ENABLED && (
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
          )}
        </ModeRowList>
      </section>
    </div>
  )
}
