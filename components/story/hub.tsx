'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowRight, Car, Ellipsis, HandCoins, Lightbulb, CircleX, Lock, Map as MapIcon, MessageCircle, Moon, Play, NotebookPen, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SUITS } from '@/components/ui/terminal'
import { ActionSheet, SheetNote } from '@/components/story/action-sheet'
import { CircuitMap } from '@/components/story/circuit-map'
import { CityScene, PersonSpot, PlaceSpot, type SceneSpot } from '@/components/story/city-scene'
import { DialogueBox } from '@/components/story/dialogue-box'
import { HudButton, StandingStars, StoryHud } from '@/components/story/hud'
import { NightCard } from '@/components/story/night-card'
import { NightsGuide } from '@/components/story/nights-guide'
import { NewsSlips, Notebook } from '@/components/story/notebook'
import { Portrait } from '@/components/story/portrait'
import type { SceneArtState } from '@/components/story/scene-art'
import { TitleScreen } from '@/components/story/title-screen'
import { CITIES, CITY_BY_ID, type City } from '@/lib/story/cities'
import { CHARACTERS } from '@/lib/story/content/characters'
import { SCENES } from '@/lib/story/content'
import { BOSS_BUYIN_M, COMPS_CAP_M, COMPS_RATE, HUSTLE_PAY_M, JOB_OFFER_NIGHTS, MARKER_M, MARKER_REPAY, MARKER_REPAY_STEP, MARKER_STANDING, MEAL_BETS, MEAL_M, NIGHT_BETS, SLEEP_BETS, type SleepPlace, VENUE_MAX_M, VENUE_REP } from '@/lib/story/economy'
import { hustlesFor } from '@/lib/story/hustles'
import { gamesFor } from '@/lib/story/rotation'
import { TRAVELLING_GIVERS, jobKindName, jobReward } from '@/lib/story/jobs'
import { joTips } from '@/lib/story/tips'
import { PaperRow, ServiceButton, ServicePopup } from '@/components/story/service-card'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import { sceneConfigFor } from '@/lib/story/scene-theme'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { useStoryStore, VENUE_NAMES, type NightSummary, type VenueTier } from '@/store/story-store'
import { formatChips } from '@/utils/format'
import type { Character } from '@/lib/story/types'

const money = (n: number) => `$${formatChips(n)}`
/** The rival who sits at each city's boss table (the one character per city without a minigame). */
const bossOf = (city: City): Character | undefined =>
  CHARACTERS.find((c) => c.city === city.id && !c.minigame)
const isLook = (id: string): id is PortraitLook => (PORTRAIT_LOOKS as string[]).includes(id)

const VENUE_SPOTS = ['dive', 'main', 'high'] as const
const VENUE_SHORT = ['The dive', 'Main floor', 'High rollers'] as const
/** Door hit areas in the casino's own units (see scene-art). */
const DOOR_SIZE: [number, number][] = [[70, 106], [170, 124], [112, 88]]
const MINIGAME_TITLES: Record<string, string> = { 'last-orders': 'Last Orders', 'shuffle-tracker': 'Shuffle Tracker', 'chip-count': 'Chip Count' }

type Sheet =
  | { kind: 'venue'; v: VenueTier }
  | { kind: 'person'; id: string }
  | { kind: 'boss' }
  | { kind: 'rest' }
  | { kind: 'road' }
  | { kind: 'guide' }

function Face({ id }: { id: string }) {
  return isLook(id) ? <Portrait look={id} className="block w-full [&_svg]:h-auto [&_svg]:w-full" /> : null
}

/** Buttons in a sheet, laid out in a row that wraps. */
function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>
}

export function StoryHub() {
  const s = useStoryStore()
  // Tonight's job offer, if the town has room and none was made yet (a save from
  // before version 6 gets its first one here). Safe to call on every visit.
  const started = s.started
  useEffect(() => {
    if (!started) return
    // A minigame left mid-game is a miss (its one attempt was used), then tonight's offers.
    useStoryStore.getState().forfeitStartedMinigames()
    useStoryStore.getState().offerTonight()
  }, [started])
  const router = useRouter()
  const [confirmNew, setConfirmNew] = useState(false)
  const [sheet, setSheet] = useState<{ which: Sheet; anchor: { x: number; y: number } } | null>(null)
  const [jobsOpen, setJobsOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [receipt, setReceipt] = useState<NightSummary | null>(null)
  /** A person's service card (Marta's diner, Pike's loan, Jo's tip) open over the street. */
  const [service, setService] = useState<{ kind: 'meal' | 'loan' | 'tips'; who: string } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const city = CITY_BY_ID.get(s.city)!
  const m = city.minBet
  const sceneOn = !!s.scene

  if (!s.started) {
    return <TitleScreen onStart={() => { s.newStory(); s.playQueued() }} />
  }

  const night = s.tonight
  const stakeNote = (v: VenueTier) => {
    const max = VENUE_MAX_M[v]
    return max == null ? 'No table limit' : `Bets up to ${money(max * m)}`
  }
  const taken = s.openJobs()
  const offers = s.jobs.filter((j) => j.city === s.city && j.status === 'offered')
  const hustles = hustlesFor(s.city, s.night)
  const boss = bossOf(city)
  // The town's people, then those who travel with you and give jobs everywhere (Jo).
  const people = [...CHARACTERS.filter((c) => c.city === s.city && c !== boss), ...CHARACTERS.filter((c) => (TRAVELLING_GIVERS as readonly string[]).includes(c.id))]
  const cleared = s.cleared.includes(s.city)
  const nextCity = CITIES[CITIES.findIndex((c) => c.id === s.city) + 1]
  const gamesIn = (v: number) => gamesFor(city, s.night, v, s.seenGames, s.openJobGames())
  const broke = s.money < m && !night
  const lenderId = s.lenderHere()
  const lender = lenderId ? CHARACTERS.find((c) => c.id === lenderId) ?? null : null
  // Jo's read on the games in the room you're in tonight (the dive's before you sit down).
  const tips = joTips(gamesIn(night ? night.venue : 0), s.city, s.night)
  const hasTips = (c: Character) => (TRAVELLING_GIVERS as readonly string[]).includes(c.id) && tips.length > 0
  // Tonight's bets come from where you slept (8 after the car, 12 after a room).
  const nightBets = night ? (night.limit ?? NIGHT_BETS) : s.nextBets + (s.ateTonight() ? MEAL_BETS : 0)
  const betsLeft = night ? Math.max(0, nightBets - night.bets) : 0
  // The car's light is off when you slept in it last night.
  const sleptInCar = !!s.lastNight?.car
  const config = sceneConfigFor(s.city, city.name)
  const roomName = config.motelName === 'MOTEL' ? 'Your room' : `Room 5 at the ${config.motelName[0]}${config.motelName.slice(1).toLowerCase()}`
  const roomShort = config.motelName === 'MOTEL' ? 'Your room' : 'Room 5'

  const talk = (character: string) => {
    if (s.canTalk(character)) {
      setSheet(null)
      s.talkTo(character)
    }
  }
  const bossIntro = s.sceneFor({ on: 'boss-intro' })
  const endNight = (place: SleepPlace) => {
    const summary = s.endNight(place)
    setSheet(null)
    setReceipt(summary)
  }
  // The receipt first, then whatever the night queued (a bust scene).
  const nextNight = () => {
    setReceipt(null)
    useStoryStore.getState().playQueued()
  }

  const anchorOf = (el: Element | null) => {
    const stage = stageRef.current?.getBoundingClientRect()
    const r = el?.getBoundingClientRect()
    if (!stage || !r) return { x: 0.5, y: 0.5 }
    return { x: (r.left + r.width / 2 - stage.left) / stage.width, y: (r.top + r.height / 2 - stage.top) / stage.height }
  }
  const open = (which: Sheet) => (e: MouseEvent<HTMLElement>) => setSheet({ which, anchor: anchorOf(e.currentTarget) })
  /** Opens a sheet from the bottom bar, anchored to its hotspot on the street. */
  const openAt = (which: Sheet, spot: string) => () =>
    setSheet({ which, anchor: anchorOf(stageRef.current?.querySelector(`[data-spot="${spot}"]`) ?? null) })
  const isOpen = (k: Sheet['kind'], id?: string | number) =>
    !!sheet && sheet.which.kind === k && (id == null || ('v' in sheet.which ? sheet.which.v === id : 'id' in sheet.which ? sheet.which.id === id : true))

  // ── The street ──
  const art: SceneArtState = {
    locked: [!s.venueOpen(0), !s.venueOpen(1), !s.venueOpen(2)],
    tonight: night ? night.venue : null,
    boss: !boss ? 'none' : cleared ? 'beaten' : s.bossBackOn != null ? 'away' : 'waiting',
    roadOpen: cleared && !!nextCity,
    nextCity: nextCity?.name ?? null,
    car: sleptInCar,
    night: s.night,
  }
  const restSpot = 'rest'
  const sleepNote = (place: SleepPlace) => {
    const cost = s.sleepCost(place)
    return `${cost ? money(cost) : 'Free'} · ${SLEEP_BETS[place]} bets`
  }
  const spots: SceneSpot[] = [
    // The room: the whole motel, listed first so the people standing on it stay on top.
    {
      spot: 'rest',
      node: (
        <PlaceSpot
          title={roomShort}
          sub={sleepNote('room')}
          icon={<Moon className="h-2.5 w-2.5" aria-hidden />}
          active={isOpen('rest')}
          size={[472, 222]}
          plateBelow={false}
          plateInsideTall
          label={`${night ? 'End the night' : 'Rest'}: ${roomName}, ${sleepNote('room')} next night`}
          onOpen={open({ kind: 'rest' })}
        />
      ),
    },
    ...([0, 1, 2] as VenueTier[]).map((v): SceneSpot => {
      const unlocked = s.venueOpen(v)
      const here = night?.venue === v
      return {
        spot: VENUE_SPOTS[v],
        raise: here,
        node: (
          <PlaceSpot
            title={VENUE_SHORT[v]}
            sub={!unlocked ? `Standing ${VENUE_REP[v]} needed` : here ? `Tonight · ${betsLeft} bets` : undefined}
            icon={!unlocked ? <Lock className="h-2.5 w-2.5" aria-hidden /> : undefined}
            locked={!unlocked}
            lit={here}
            active={isOpen('venue', v)}
            size={DOOR_SIZE[v]!}
            plateBelow={v !== 2}
            label={`${VENUE_NAMES[v]}: ${!unlocked ? `locked, needs standing ${VENUE_REP[v]}` : here ? `tonight, ${betsLeft} bets left` : stakeNote(v)}`}
            onOpen={open({ kind: 'venue', v })}
          />
        ),
      }
    }),
    ...people.map((c, i): SceneSpot => {
      // A job offer (its own marker), something new to say, or their minigame job to play.
      const job = s.jobAt(c.id)
      const offer = job?.status === 'offered'
      const canTalk = s.canTalk(c.id)
      const playable = !!s.minigameJobAt(c.id)
      return {
        spot: config.spots[c.id] ? c.id : `p${i}`,
        node: (
          <PersonSpot
            id={c.id}
            name={c.name}
            badge={offer ? 'job' : canTalk ? 'talk' : playable ? 'play' : null}
            active={isOpen('person', c.id)}
            label={`${c.name}${offer ? `, has a ${jobKindName(job)} for you` : canTalk ? ', has something to say' : ''}${playable ? ', their minigame job is yours to play' : ''}`}
            onOpen={open({ kind: 'person', id: c.id })}
          />
        ),
      }
    }),
    ...(boss
      ? [
          {
            spot: config.spots[boss.id] ? boss.id : 'boss',
            node: (
              <PersonSpot
                id={boss.id}
                name={boss.name}
                sub={cleared ? 'Beaten' : s.bossBackOn != null ? `Back night ${s.bossBackOn + 1}` : 'The boss'}
                muted={cleared || s.bossBackOn != null}
                active={isOpen('boss')}
                label={`${boss.name}, the boss${cleared ? ', beaten' : s.bossBackOn != null ? `, back on night ${s.bossBackOn + 1}` : ''}`}
                onOpen={open({ kind: 'boss' })}
              />
            ),
          },
        ]
      : []),
    // The car, the other place to sleep (both end the night).
    {
      spot: 'car',
      node: (
        <PlaceSpot
          title="The car"
          sub={sleepNote('car')}
          icon={<Car className="h-2.5 w-2.5" aria-hidden />}
          active={isOpen('rest')}
          size={[170, 64]}
          label={`${night ? 'End the night' : 'Rest'}: the car, ${sleepNote('car')} next night`}
          onOpen={open({ kind: 'rest' })}
        />
      ),
    },
    ...(nextCity
      ? [
          {
            spot: 'road',
            node: (
              <PlaceSpot
                title={cleared ? 'Road out' : 'Road out'}
                sub={cleared ? `To ${nextCity.name}` : 'Closed'}
                icon={cleared ? <ArrowRight className="h-2.5 w-2.5" aria-hidden /> : <Lock className="h-2.5 w-2.5" aria-hidden />}
                locked={!cleared}
                lit={cleared && !night}
                active={isOpen('road')}
                size={[150, 92]}
                label={cleared ? `The road out, to ${nextCity.name}` : 'The road out, opens when the city is cleared'}
                onOpen={open({ kind: 'road' })}
              />
            ),
          },
        ]
      : []),
  ]

  // ── The sheet for the open hotspot ──
  const sheetBody = (() => {
    if (!sheet) return null
    const w = sheet.which
    const close = () => setSheet(null)
    if (w.kind === 'venue') {
      const v = w.v
      const unlocked = s.venueOpen(v)
      const here = night?.venue === v
      let body: ReactNode
      if (!unlocked) {
        body = (
          <>
            <div className="flex items-center gap-2">
              <StandingStars standing={s.rep()} city={city.name} />
              <SheetNote tone="soft">
                Needs standing {VENUE_REP[v]}. Finish a job.
              </SheetNote>
            </div>
            <SheetNote>You have standing {s.rep()} in {city.name}. The door stays chained until your name is good enough here.</SheetNote>
          </>
        )
      } else if (here) {
        body = (
          <>
            <ul className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2.5 overflow-y-auto sm:gap-3">
              {gamesIn(v).map((g, i) => {
                const entry = GAME_BY_NAME.get(g)
                return (
                  <li key={g} className="flex">
                    <Link
                      href={`/story/${g}`}
                      className="tile st-game-tile flex min-h-[150px] w-full flex-col items-center gap-1 rounded-lg px-3 pb-3 pt-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold sm:min-h-[164px] sm:gap-1.5"
                    >
                      {/* The game's picture sits in its own band above the name, just off centre. */}
                      <span aria-hidden className="flex min-h-[84px] w-full flex-1 items-center justify-center pl-4 sm:min-h-[92px] sm:pl-0 sm:pr-4">
                        <span className="tile-suit tile-suit-vivid !relative !right-auto !top-auto !text-[72px] sm:!text-[84px]">{entry?.symbol ?? SUITS[i % 4]}</span>
                      </span>
                      <span className="text-[15px] font-semibold leading-5 text-ink sm:text-[17px]">{entry?.label ?? g}</span>
                      <span className="text-[11.5px] leading-4 text-dim sm:text-[12.5px]">{entry?.sub}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <SheetNote>
              Money now <span className="num text-gold">{money(s.money)}</span>. {stakeNote(v)}. <span className="num text-ink">{betsLeft}</span> of {nightBets} bets left.
            </SheetNote>
          </>
        )
      } else if (night) {
        body = <SheetNote tone="soft">You&apos;re at {VENUE_NAMES[night.venue].toLowerCase()} tonight. One room a night.</SheetNote>
      } else if (broke) {
        body = (
          <>
            <SheetNote tone="loss">You can&apos;t cover the minimum bet ({money(m)}). Rest, work a minigame job{lender ? `, or borrow from ${lender.name}` : ''}.</SheetNote>
            <Actions>
              {lender && <Button size="sm" variant="secondary" onClick={openAt({ kind: 'person', id: lender.id }, lender.id)}>See {lender.name}</Button>}
            </Actions>
          </>
        )
      } else {
        body = (
          <>
            <SheetNote tone="soft">
              {nightBets} bets across tonight&apos;s games. {stakeNote(v)}. Comps {Math.round(COMPS_RATE[v] * 1000) / 10}% back, up to {money(COMPS_CAP_M[v] * m)}.
            </SheetNote>
            <SheetNote tone="gold">
              Once you sit down, this is your room for the night. No switching until you call it a night.
            </SheetNote>
            {/* One row whatever the names: the sheet is wide enough on desktop, and on
                phones each game stacks its symbol over its name. */}
            <ul className="grid grid-cols-4 gap-1.5" aria-label="Tonight's games">
              {gamesIn(v).map((g) => (
                <li
                  key={g}
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg bg-black/30 px-1.5 py-1.5 text-center text-[11.5px] leading-[14px] text-soft shadow-[inset_0_0_0_1px_rgba(217,164,65,0.25)] lg:flex-row lg:gap-1.5 lg:rounded-full lg:px-2.5 lg:py-1 lg:text-[12px] lg:whitespace-nowrap"
                >
                  <span aria-hidden className="text-[14px] leading-none">{GAME_BY_NAME.get(g)?.symbol}</span>
                  {GAME_BY_NAME.get(g)?.label ?? g}
                </li>
              ))}
            </ul>
            <Actions>
              <Button onClick={() => s.startNight(v)}>Start the night</Button>
            </Actions>
          </>
        )
      }
      // Before the night: wide enough for tonight's four games in one row.
      return { title: VENUE_NAMES[v], kicker: unlocked ? (here ? 'Tonight' : stakeNote(v)) : 'Locked', art: undefined, body, close, size: here ? ('lg' as const) : undefined, className: here ? undefined : 'lg:w-[620px]' }
    }
    if (w.kind === 'person') {
      const c = CHARACTERS.find((x) => x.id === w.id)
      if (!c) return null
      const canTalk = s.canTalk(c.id)
      const job = s.jobAt(c.id)
      const playable = !!s.minigameJobAt(c.id)
      return {
        title: c.name,
        kicker: c.minigame ? `${MINIGAME_TITLES[c.minigame] ?? 'Minigame'} · played as a job` : undefined,
        art: <Face id={c.id} />,
        body: (
          <>
            {job?.status === 'offered' && (
              <SheetNote tone="gold">
                {c.name} has a {jobKindName(job)} for you. Talk to hear it.{' '}
                {s.night - job.night >= JOB_OFFER_NIGHTS - 1 ? 'Last night to take it.' : `It goes to someone else after ${JOB_OFFER_NIGHTS} nights.`}
              </SheetNote>
            )}
            {job?.status === 'open' && (
              <div className="rounded-md bg-black/25 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(217,164,65,0.2)]">
                <p className="felt-print !text-[9.5px]">Your {jobKindName(job)} · {jobReward(job, m)}</p>
                <p className="text-[13px] font-semibold text-ink">{job.title}</p>
                <p className="text-[12px] leading-[17px] text-dim">{job.task}</p>
              </div>
            )}
            {/* Talk and what they offer: a brass button each (the services open a paper card). */}
            <div className="flex flex-wrap gap-2" role="group" aria-label={`What ${c.name} offers`}>
              <ServiceButton
                icon={<MessageCircle aria-hidden />}
                label={canTalk ? 'Talk' : 'No news'}
                dot={canTalk}
                disabled={!canTalk}
                onClick={() => talk(c.id)}
              />
              {hasTips(c) && <ServiceButton icon={<Lightbulb aria-hidden />} label="A tip" onClick={() => { setSheet(null); setService({ kind: 'tips', who: c.id }) }} />}
              {c.sells === 'meal' && <ServiceButton icon={<UtensilsCrossed aria-hidden />} label="Diner" dot={!s.ateTonight()} onClick={() => { setSheet(null); setService({ kind: 'meal', who: c.id }) }} />}
              {c.lends && <ServiceButton icon={<HandCoins aria-hidden />} label="Loan" onClick={() => { setSheet(null); setService({ kind: 'loan', who: c.id }) }} />}
              {playable && c.minigame && (
                <ServiceButton icon={<Play aria-hidden className="translate-x-[1px] fill-current" />} label="Play" dot onClick={() => router.push(`/story/minigame/${c.minigame}`)} />
              )}
              {job?.status === 'open' && <ServiceButton icon={<CircleX aria-hidden />} label="Drop job" onClick={() => s.dropJob(job.id)} />}
            </div>

            {job?.status === 'open' && <p className="text-[11.5px] leading-4 text-dim">Dropping a job pays nothing and frees {c.name} to offer another.</p>}
          </>
        ),
        close,
      }
    }
    if (w.kind === 'boss' && boss) {
      const buyIn = BOSS_BUYIN_M * m
      const canSit = s.bossAvailable() && s.money >= buyIn
      return {
        title: boss.name,
        kicker: 'The boss',
        art: <Face id={boss.id} />,
        body: (
          <>
            <SheetNote tone="soft">
              {cleared ? 'Beaten. Your seat on the circuit is earned.' : s.bossBackOn != null ? `Gone for now. Back on night ${s.bossBackOn + 1}.` : 'Waiting at the back table.'}
            </SheetNote>
            {!cleared && (
              <dl className="grid grid-cols-2 gap-2">
                <div className="plaque rounded-md px-3 py-1.5">
                  <dt className="felt-print !text-[9.5px]">Buy-in</dt>
                  <dd className="num text-[15px] font-semibold text-ink">{money(buyIn)}</dd>
                </div>
              </dl>
            )}
            {!cleared && !canSit && s.bossBackOn == null && (
              <SheetNote tone="loss">{night ? 'Not while a night is on.' : `You need ${money(buyIn)} to sit down.`}</SheetNote>
            )}
            <Actions>
              <Button size="sm" variant="outline" disabled={!bossIntro} onClick={() => { if (bossIntro) { setSheet(null); s.startScene(bossIntro) } }}>Talk</Button>
              <Button size="sm" disabled={!canSit} onClick={() => { if (s.enterBoss()) router.push('/story/boss') }}>
                Sit down
              </Button>
            </Actions>
          </>
        ),
        close,
      }
    }
    if (w.kind === 'guide') {
      const tutorial = SCENES.find((sc) => sc.trigger.on === 'tutorial' && sc.city === s.city)
      return {
        title: 'How the nights work',
        kicker: city.name,
        art: undefined,
        body: (
          <NightsGuide
            city={city}
            night={s.night}
            seen={s.seenGames}
            must={s.openJobGames()}
            onReplay={tutorial ? () => { setSheet(null); s.startScene(tutorial.id) } : null}
          />
        ),
        close,
        size: 'lg' as const,
      }
    }
    if (w.kind === 'rest') {
      return {
        title: 'Where to sleep',
        kicker: night ? 'End the night' : 'Rest',
        art: undefined,
        body: (
          <>
            <SheetNote tone="soft">
              {night ? 'Settles comps and hustles, then you sleep.' : 'Skip the night. You still sleep somewhere, and the board changes.'} Where you sleep sets tomorrow&apos;s bets.
            </SheetNote>
            <div className="grid grid-cols-2 gap-2">
              {(['car', 'room'] as const).map((place) => {
                const cost = s.sleepCost(place)
                const short = place === 'room' && s.money < cost
                return (
                  <button
                    key={place}
                    type="button"
                    disabled={short}
                    onClick={() => endNight(place)}
                    data-sleep={place}
                    className="flex flex-col items-start gap-0.5 rounded-md bg-black/25 px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_rgba(217,164,65,0.25)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(217,164,65,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-40"
                  >
                    {/* The title takes the spare height, so price and bets line up across both cards. */}
                    <span className="flex flex-1 items-start gap-1.5 text-[13.5px] font-semibold leading-[18px] text-ink">
                      {place === 'car' ? <Car className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <Moon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
                      {place === 'car' ? 'The car' : roomName}
                    </span>
                    <span className="num text-[13px] text-gold">{cost ? money(cost) : 'Free'}</span>
                    <span className="text-[12px] leading-4 text-dim">
                      {SLEEP_BETS[place]} bets tomorrow{short ? ` · you need ${money(cost)}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        ),
        close,
      }
    }
    if (w.kind === 'road') {
      return {
        title: nextCity ? nextCity.name : 'The end of the road',
        kicker: 'The road out',
        art: undefined,
        body: (
          <>
            {cleared && nextCity ? (
              <>
                <SheetNote tone="soft">
                  {nextCity.feel[0]!.toUpperCase() + nextCity.feel.slice(1)}. Minimum bet there {money(nextCity.minBet)}.
                </SheetNote>
                {night && <SheetNote tone="loss">Finish the night first.</SheetNote>}
                <Actions>
                  <Button disabled={!!night} onClick={() => { if (s.travelNext()) { setSheet(null); s.playQueued() } }}>
                    Travel to {nextCity.name}
                  </Button>
                </Actions>
              </>
            ) : (
              <SheetNote tone="soft">
                {boss ? `Beat ${boss.name} to earn your seat on the circuit. Then the road opens.` : `${city.name}'s people and boss are still being written. The road ends here for now.`}
              </SheetNote>
            )}
            <Actions>
              <Button size="sm" variant="ghost" onClick={() => { setSheet(null); setMapOpen(true) }}>
                <MapIcon className="h-3.5 w-3.5" aria-hidden /> Open the map
              </Button>
            </Actions>
          </>
        ),
        close,
      }
    }
    return null
  })()

  // ── The bottom bar: where you are tonight and the next thing to do ──
  const rail = (() => {
    if (night)
      return {
        text: (
          <>
            <span className="text-ink">{VENUE_NAMES[night.venue]}</span> · <span className="num text-ink">{betsLeft}</span> of {nightBets} bets left
            <span className="hidden sm:inline"> · {stakeNote(night.venue)}</span>
          </>
        ),
        kicker: 'Tonight',
        actions: (
          <>
            <Button size="sm" variant="secondary" onClick={openAt({ kind: 'venue', v: night.venue }, VENUE_SPOTS[night.venue])}>Tables</Button>
            <Button size="sm" onClick={openAt({ kind: 'rest' }, restSpot)}>End the night</Button>
          </>
        ),
      }
    if (broke)
      return {
        text: <span className="text-loss">You can&apos;t cover the {money(m)} minimum bet.</span>,
        kicker: 'Broke',
        actions: (
          <>
            {lender && <Button size="sm" variant="secondary" onClick={openAt({ kind: 'person', id: lender.id }, lender.id)}>{lender.name}</Button>}
            <Button size="sm" variant="outline" onClick={openAt({ kind: 'rest' }, restSpot)}>Rest</Button>
          </>
        ),
      }
    if (cleared && nextCity)
      return {
        text: <>{city.name} is behind you. The road is open.</>,
        kicker: `Night ${s.night + 1}`,
        actions: (
          <>
            <Button size="sm" onClick={openAt({ kind: 'road' }, 'road')}>Hit the road</Button>
            <Button size="sm" variant="outline" onClick={openAt({ kind: 'rest' }, restSpot)}>Rest</Button>
          </>
        ),
      }
    return {
      text: <>Pick a door to start the night.<span className="hidden sm:inline"> {nightBets} bets, min bet {money(m)}.</span></>,
      kicker: `Night ${s.night + 1}`,
      actions: <Button size="sm" variant="outline" onClick={openAt({ kind: 'rest' }, restSpot)}>Rest</Button>,
    }
  })()

  const overlayOn = sceneOn || !!receipt || mapOpen
  const jobsBadge = taken.length + offers.length

  return (
    <div className="st-screen relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg [@media(max-height:500px)]:min-h-[30rem] [@media(max-height:500px)]:shrink-0">
      <StoryHud
        actions={
          <>
            <HudButton icon={<NotebookPen />} label="Jobs" badge={jobsBadge} active={jobsOpen} disabled={sceneOn} onClick={() => { setSheet(null); setJobsOpen((o) => !o) }} />
            <HudButton icon={<MapIcon />} label="Map" active={mapOpen} disabled={sceneOn} onClick={() => { setSheet(null); setJobsOpen(false); setMapOpen(true) }} />
            <HudButton icon={<Ellipsis />} label="Menu" active={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
          </>
        }
      />

      <div ref={stageRef} className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <CityScene config={config} state={art} spots={spots} dim={overlayOn} />
          {!overlayOn && <NewsSlips news={s.news} onDismiss={s.dismissNews} />}
          {!boss && !overlayOn && (
            <p className="st-slip absolute left-2 top-2 z-20 max-w-[260px] px-3 py-2 text-[12px] leading-[17px] text-[#2a2420] sm:left-3 sm:top-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f2633]">Coming soon · </span>
              {city.name}&apos;s people and boss are still being written. You can play nights here; the road ends for now.
            </p>
          )}
        </div>

        <div className={`st-rail relative z-10 flex min-h-[56px] shrink-0 items-center gap-3 px-3 py-2 sm:px-4 [&>*]:transition-opacity ${overlayOn ? "[&>*]:invisible [&>*]:opacity-0" : ""}`} aria-hidden={overlayOn || undefined}>
          <div className="min-w-0 flex-1">
            <p className="felt-print !text-[9.5px] leading-3">{rail.kicker}</p>
            <p className="text-[12.5px] leading-[17px] text-soft sm:text-[13px]">{rail.text}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">{rail.actions}</div>
        </div>

        {sheet && sheetBody && !overlayOn && (
          <ActionSheet anchor={sheet.anchor} title={sheetBody.title} kicker={sheetBody.kicker} art={sheetBody.art} size={'size' in sheetBody ? sheetBody.size : undefined} className={'className' in sheetBody ? sheetBody.className : undefined} onClose={sheetBody.close}>
            {sheetBody.body}
          </ActionSheet>
        )}

        {jobsOpen && !overlayOn && (
          <Notebook
            minBet={m}
            hustles={hustles.map((h) => ({ id: h.id, text: h.text, met: !!night && h.met(night.rounds) }))}
            jobs={taken}
            offers={offers}
            hustlePay={HUSTLE_PAY_M * m}
            nightOn={!!night}
            lastNet={!night && s.lastNight ? s.lastNight.net : null}
            onLastNight={() => { setJobsOpen(false); setReceipt(s.lastNight) }}
            onClose={() => setJobsOpen(false)}
          />
        )}

        {sceneOn && (
          <div className="st-vn-dim absolute inset-0 z-40" role="region" aria-label="Scene">
            <DialogueBox />
          </div>
        )}

        {receipt && !sceneOn && <NightCard summary={receipt} cityName={city.name} onNext={nextNight} />}
        {service && !sceneOn && (() => {
          const who = CHARACTERS.find((x) => x.id === service.who)
          const close = () => setService(null)
          if (!who) return null
          if (service.kind === 'meal') {
            const price = MEAL_M * m
            const ate = s.ateTonight()
            return (
              <ServicePopup
                kind="menu"
                kicker={`${config.barName === 'DINER' ? `The ${config.motelName[0]}${config.motelName.slice(1).toLowerCase()} diner` : 'The diner'} · ${who.name}`}
                title="Tonight's plate"
                onClose={close}
                footer={
                  <Button size="lg" disabled={ate || s.money < price} onClick={() => { if (s.buyMeal()) close() }}>
                    {ate ? 'Already ate tonight' : `Order · ${money(price)}`}
                  </Button>
                }
              >
                <PaperRow label="Hot plate & coffee" value={money(price)} />
                <PaperRow label="Bets tonight" value={`+${MEAL_BETS}`} tone="good" />
                <p className="mt-2 text-center font-mono text-[11px] text-[#6f6354]">One plate a night. Eat before or during the night.</p>
              </ServicePopup>
            )
          }
          if (service.kind === 'loan') {
            const lent = MARKER_M * m
            const rate = MARKER_REPAY + MARKER_REPAY_STEP * s.markersHere
            return (
              <ServicePopup
                kind="iou"
                kicker={`${who.name} · street rates`}
                title="I.O.U."
                onClose={close}
                footer={<Button size="lg" onClick={() => { if (s.takeMarker()) close() }}>Sign · take {money(lent)}</Button>}
              >
                <PaperRow label="You get" value={money(lent)} tone="good" />
                <PaperRow label="You pay back" value={`${money(Math.round(lent * rate))} (${rate}×)`} />
                <PaperRow label="From every win" value="half the profit" />
                <PaperRow label={`Standing in ${city.name}`} value={`−${MARKER_STANDING}`} tone="bad" />
                {s.owed > 0 && (
                  <>
                    <div aria-hidden className="my-2 border-t border-dashed border-[#2a2420]/40" />
                    <PaperRow label="You owe now" value={money(s.owed)} tone="bad" />
                  </>
                )}
              </ServicePopup>
            )
          }
          return (
            <ServicePopup kind="note" kicker={`${who.name}'s notebook`} title="Tonight's read" onClose={close}>
              {tips.map((t) => (
                <p key={t} className="text-[14px] italic leading-6 text-[#2a2420]">&ldquo;{t}&rdquo;</p>
              ))}
              <p className="mt-1 text-right text-[12px] italic text-[#6f6354]">— {who.name}</p>
            </ServicePopup>
          )
        })()}
      </div>

      {mapOpen && <CircuitMap current={s.city} cleared={s.cleared} visited={s.visited} onClose={() => setMapOpen(false)} />}

      {menuOpen && (
        <>
          <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 z-[55] cursor-default" onClick={() => setMenuOpen(false)} />
          <div className="st-sheet absolute right-2 top-[54px] z-[60] flex w-52 flex-col gap-1 rounded-md p-1.5" role="menu" aria-label="Story menu" onKeyDown={(e) => { if (e.key === 'Escape') setMenuOpen(false) }}>
            <Button
              role="menuitem"
              autoFocus
              variant="ghost"
              size="sm"
              className="justify-start rounded-md"
              disabled={sceneOn}
              onClick={() => { setMenuOpen(false); setConfirmNew(true) }}
            >
              New story
            </Button>
            <Button
              role="menuitem"
              variant="ghost"
              size="sm"
              className="justify-start rounded-md"
              disabled={sceneOn}
              onClick={() => { setMenuOpen(false); setSheet({ which: { kind: 'guide' }, anchor: { x: 0.9, y: 0.1 } }) }}
            >
              How the nights work
            </Button>
          </div>
        </>
      )}

      <Dialog open={s.debtWarning() && !s.scene} onOpenChange={(o) => { if (!o) s.dismissDebtWarning() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You owe {money(s.owed)}</DialogTitle>
            <DialogDescription>
              That&apos;s a lot of debt: half of every win goes to it, and climbing out can take a long time. You can keep playing, or start the story over if you&apos;d rather not grind it back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => s.dismissDebtWarning()}>Keep playing</Button>
            <Button variant="destructive" onClick={() => { s.dismissDebtWarning(); setConfirmNew(true) }}>Start over</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new story?</DialogTitle>
            <DialogDescription>This erases your current story save: money, standing in every town, cities cleared. It can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setConfirmNew(false)}>Keep playing</Button>
            <Button variant="destructive" onClick={() => { setConfirmNew(false); setSheet(null); setReceipt(null); s.newStory(); s.playQueued() }}>Erase and restart</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
