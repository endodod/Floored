'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowRight, Car, Ellipsis, Lock, Map as MapIcon, Moon, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SUITS } from '@/components/ui/terminal'
import { ActionSheet, SheetNote } from '@/components/story/action-sheet'
import { CircuitMap } from '@/components/story/circuit-map'
import { CityScene, PersonSpot, PlaceSpot, type SceneSpot } from '@/components/story/city-scene'
import { DialogueBox } from '@/components/story/dialogue-box'
import { HudButton, RepStars, StoryHud } from '@/components/story/hud'
import { NightCard } from '@/components/story/night-card'
import { NewsSlips, Notebook } from '@/components/story/notebook'
import { Portrait } from '@/components/story/portrait'
import type { SceneArtState } from '@/components/story/scene-art'
import { TitleScreen } from '@/components/story/title-screen'
import { CITIES, CITY_BY_ID, type City } from '@/lib/story/cities'
import { CHARACTERS } from '@/lib/story/content/characters'
import { BOSS_BUYIN_M, BOSS_PURSE_M, CAR_BELOW_M, HUSTLE_PAY_M, LODGING_M, MINIGAME_MAX_M, NIGHT_BETS, VENUE_MAX_M } from '@/lib/story/economy'
import { hustlesFor } from '@/lib/story/hustles'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import { sceneConfigFor } from '@/lib/story/scene-theme'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { useStoryStore, VENUE_NAMES, VENUE_REP, type NightSummary, type VenueTier } from '@/store/story-store'
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
const DOOR_SIZE: [number, number][] = [[70, 106], [170, 124], [68, 84]]
const MINIGAME_TITLES: Record<string, string> = { 'last-orders': 'Last Orders', 'shuffle-tracker': 'Shuffle Tracker' }

type Sheet =
  | { kind: 'venue'; v: VenueTier }
  | { kind: 'person'; id: string }
  | { kind: 'boss' }
  | { kind: 'rest' }
  | { kind: 'road' }
  | { kind: 'notary' }

function Face({ id }: { id: string }) {
  return isLook(id) ? <Portrait look={id} className="block w-full [&_svg]:h-auto [&_svg]:w-full" /> : null
}

/** Buttons in a sheet, laid out in a row that wraps. */
function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>
}

export function StoryHub() {
  const s = useStoryStore()
  const router = useRouter()
  const [confirmNew, setConfirmNew] = useState(false)
  const [sheet, setSheet] = useState<{ which: Sheet; anchor: { x: number; y: number } } | null>(null)
  const [jobsOpen, setJobsOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [receipt, setReceipt] = useState<NightSummary | null>(null)
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
  const errands = s.openErrands()
  const hustles = hustlesFor(s.city, s.night)
  const boss = bossOf(city)
  const people = CHARACTERS.filter((c) => c.city === s.city && c !== boss)
  const cleared = s.cleared.includes(s.city)
  const fare = s.fareToNext()
  const nextCity = CITIES[CITIES.findIndex((c) => c.id === s.city) + 1]
  const games = city.games === 'all-seen' ? s.seenGames : city.games
  const broke = s.money < m && !night
  const betsLeft = night ? Math.max(0, NIGHT_BETS - night.bets) : 0
  const inCar = s.money < CAR_BELOW_M * m
  const config = sceneConfigFor(s.city, city.name)
  const roomName = config.motelName === 'MOTEL' ? 'Your room' : `Room 5 at the ${config.motelName[0]}${config.motelName.slice(1).toLowerCase()}`

  const talk = (character: string) => {
    const id = s.sceneFor({ on: 'talk', character })
    if (id) {
      setSheet(null)
      s.startScene(id)
    }
  }
  const bossIntro = s.sceneFor({ on: 'boss-intro' })
  const endNight = () => {
    const summary = s.endNight()
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
    car: inCar,
  }
  const restSpot = inCar ? 'car' : 'rest'
  const spots: SceneSpot[] = [
    ...([0, 1, 2] as VenueTier[]).map((v): SceneSpot => {
      const unlocked = s.venueOpen(v)
      const here = night?.venue === v
      return {
        spot: VENUE_SPOTS[v],
        raise: here,
        node: (
          <PlaceSpot
            title={VENUE_SHORT[v]}
            sub={!unlocked ? `Rep ${VENUE_REP[v]} needed` : here ? `Tonight · ${betsLeft} bets` : undefined}
            icon={!unlocked ? <Lock className="h-2.5 w-2.5" aria-hidden /> : undefined}
            locked={!unlocked}
            lit={here}
            active={isOpen('venue', v)}
            size={DOOR_SIZE[v]!}
            plateBelow={v !== 2}
            label={`${VENUE_NAMES[v]}: ${!unlocked ? `locked, needs reputation ${VENUE_REP[v]}` : here ? `tonight, ${betsLeft} bets left` : stakeNote(v)}`}
            onOpen={open({ kind: 'venue', v })}
          />
        ),
      }
    }),
    ...people.map((c, i): SceneSpot => {
      const canTalk = !!s.sceneFor({ on: 'talk', character: c.id })
      const paid = !!c.minigame && s.minigamePaidTonight(c.id)
      return {
        spot: config.spots[c.id] ? c.id : `p${i}`,
        node: (
          <PersonSpot
            id={c.id}
            name={c.name}
            badge={canTalk ? 'talk' : paid ? 'done' : null}
            active={isOpen('person', c.id)}
            label={`${c.name}${canTalk ? ', has something to say' : ''}${paid ? ', paid tonight' : ''}`}
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
    ...(broke
      ? [
          {
            spot: 'notary',
            raise: true,
            node: <PersonSpot id="notary" name="The Notary" sub="Lends" active={isOpen('notary')} label="The Notary, lends to anyone" onOpen={open({ kind: 'notary' })} />,
          },
        ]
      : []),
    {
      spot: restSpot,
      node: (
        <PlaceSpot
          title={night ? 'End night' : 'Rest'}
          sub={inCar ? 'The car' : 'Room 5'}
          icon={inCar ? <Car className="h-2.5 w-2.5" aria-hidden /> : <Moon className="h-2.5 w-2.5" aria-hidden />}
          active={isOpen('rest')}
          size={inCar ? [170, 64] : [40, 80]}
          label={night ? 'End the night' : inCar ? 'Rest in the car' : 'Rest in your room'}
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
              <RepStars rep={s.rep} />
              <SheetNote tone="soft">
                Needs reputation {VENUE_REP[v]} (you have {s.rep})
              </SheetNote>
            </div>
            <SheetNote>The door stays chained until your name is good enough in {city.name}.</SheetNote>
          </>
        )
      } else if (here) {
        body = (
          <>
            <ul className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2.5 overflow-y-auto sm:gap-3">
              {games.map((g, i) => {
                const entry = GAME_BY_NAME.get(g)
                return (
                  <li key={g} className="flex">
                    <Link
                      href={`/story/${g}`}
                      className="tile st-game-tile flex min-h-[132px] w-full flex-col items-center justify-center gap-1 rounded-lg px-3 py-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold sm:min-h-[150px] sm:gap-1.5"
                    >
                      <span aria-hidden className="tile-suit !right-[-6px] !top-[-14px] !text-[88px]">{SUITS[i % 4]}</span>
                      <span aria-hidden className="flex h-12 items-center justify-center text-[44px] leading-none sm:h-14 sm:text-[52px]">{entry?.symbol}</span>
                      <span className="text-[15px] font-semibold leading-5 text-ink sm:text-[17px]">{entry?.label ?? g}</span>
                      <span className="text-[11.5px] leading-4 text-dim sm:text-[12.5px]">{entry?.sub}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <SheetNote>
              Money now <span className="num text-gold">{money(s.money)}</span>. {stakeNote(v)}. <span className="num text-ink">{betsLeft}</span> of {NIGHT_BETS} bets left.
            </SheetNote>
          </>
        )
      } else if (night) {
        body = <SheetNote tone="soft">You&apos;re at {VENUE_NAMES[night.venue].toLowerCase()} tonight. One room a night.</SheetNote>
      } else if (broke) {
        body = (
          <>
            <SheetNote tone="loss">You can&apos;t cover the minimum bet ({money(m)}). Rest, or see the Notary.</SheetNote>
            <Actions>
              <Button size="sm" variant="secondary" onClick={openAt({ kind: 'notary' }, 'notary')}>See the Notary</Button>
            </Actions>
          </>
        )
      } else {
        body = (
          <>
            <SheetNote tone="soft">
              {NIGHT_BETS} bets across tonight&apos;s games. {stakeNote(v)}.
            </SheetNote>
            <SheetNote tone="gold">
              Once you sit down, this is your room for the night. No switching until you call it a night.
            </SheetNote>
            <ul className="flex flex-wrap gap-1.5" aria-label="Tonight's games">
              {games.map((g) => (
                <li key={g} className="flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[12px] text-soft shadow-[inset_0_0_0_1px_rgba(217,164,65,0.25)]">
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
      return { title: VENUE_NAMES[v], kicker: unlocked ? (here ? 'Tonight' : stakeNote(v)) : 'Locked', art: undefined, body, close, size: here ? ('lg' as const) : undefined }
    }
    if (w.kind === 'person') {
      const c = CHARACTERS.find((x) => x.id === w.id)
      if (!c) return null
      const canTalk = !!s.sceneFor({ on: 'talk', character: c.id })
      const paid = !!c.minigame && s.minigamePaidTonight(c.id)
      const theirs = errands.filter((e) => e.giver === c.id)
      return {
        title: c.name,
        kicker: c.minigame ? `${MINIGAME_TITLES[c.minigame] ?? 'Minigame'} · ${paid ? 'paid tonight' : `pays up to ${money(MINIGAME_MAX_M * m)}`}` : undefined,
        art: <Face id={c.id} />,
        body: (
          <>
            {c.minigame && <SheetNote>{paid ? 'Already paid tonight. Play again for practice; errands still count.' : 'Pays once a night, by how well you do.'}</SheetNote>}
            {theirs.map((e) => (
              <div key={e.id} className="rounded-md bg-black/25 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(217,164,65,0.2)]">
                <p className="felt-print !text-[9.5px]">Errand</p>
                <p className="text-[13px] font-semibold text-ink">{e.title}</p>
                <p className="text-[12px] leading-[17px] text-dim">{e.task}</p>
              </div>
            ))}
            <Actions>
              <Button size="sm" variant="outline" disabled={!canTalk} onClick={() => talk(c.id)}>{canTalk ? 'Talk' : 'Nothing new to say'}</Button>
              {c.minigame && (
                <Button asChild size="sm" variant={paid ? 'secondary' : 'default'}>
                  <Link href={`/story/minigame/${c.minigame}`}>{paid ? 'Practice' : 'Play'}</Link>
                </Button>
              )}
            </Actions>
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
                <div className="plaque rounded-md px-3 py-1.5">
                  <dt className="felt-print !text-[9.5px]">Purse</dt>
                  <dd className="num text-[15px] font-semibold text-gold">{money(BOSS_PURSE_M * m)}</dd>
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
    if (w.kind === 'notary') {
      return {
        title: 'The Notary',
        kicker: 'Lends to anyone',
        art: <Face id="notary" />,
        body: (
          <>
            <SheetNote tone="soft">A marker puts chips in your hand. Half of every win goes to the Notary until it is paid, and each one costs more.</SheetNote>
            <Actions>
              <Button size="sm" disabled={!broke} onClick={() => { if (s.takeMarker()) setSheet(null) }}>Take a marker</Button>
            </Actions>
          </>
        ),
        close,
      }
    }
    if (w.kind === 'rest') {
      return {
        title: inCar ? 'The car' : roomName,
        kicker: night ? 'End the night' : 'Rest',
        art: undefined,
        body: (
          <>
            <SheetNote tone="soft">{night ? 'Settles comps, hustles and your room.' : 'Skip the night. Your room still costs, and the board changes.'}</SheetNote>
            <SheetNote>
              A room is {money(LODGING_M * m)} a night. Under {money(CAR_BELOW_M * m)} you sleep in the car for free.
            </SheetNote>
            <Actions>
              <Button variant={night ? 'default' : 'secondary'} onClick={endNight}>{night ? 'End the night' : 'Rest until tomorrow'}</Button>
            </Actions>
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
            {cleared && nextCity && fare != null ? (
              <>
                <SheetNote tone="soft">
                  {nextCity.feel[0]!.toUpperCase() + nextCity.feel.slice(1)}. Minimum bet there {money(nextCity.minBet)}.
                </SheetNote>
                {night && <SheetNote tone="loss">Finish the night first.</SheetNote>}
                {!night && s.money < fare && <SheetNote tone="loss">The fare is {money(fare)}.</SheetNote>}
                <Actions>
                  <Button disabled={!!night || s.money < fare} onClick={() => { if (s.travelNext()) { setSheet(null); s.playQueued() } }}>
                    Travel to {nextCity.name} · {money(fare)}
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
            <span className="text-ink">{VENUE_NAMES[night.venue]}</span> · <span className="num text-ink">{betsLeft}</span> of {NIGHT_BETS} bets left
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
            <Button size="sm" variant="secondary" onClick={openAt({ kind: 'notary' }, 'notary')}>The Notary</Button>
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
      text: <>Pick a door to start the night.<span className="hidden sm:inline"> {NIGHT_BETS} bets, min bet {money(m)}.</span></>,
      kicker: `Night ${s.night + 1}`,
      actions: <Button size="sm" variant="outline" onClick={openAt({ kind: 'rest' }, restSpot)}>Rest</Button>,
    }
  })()

  const overlayOn = sceneOn || !!receipt || mapOpen
  const jobsBadge = errands.length

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
          <ActionSheet anchor={sheet.anchor} title={sheetBody.title} kicker={sheetBody.kicker} art={sheetBody.art} size={'size' in sheetBody ? sheetBody.size : undefined} onClose={sheetBody.close}>
            {sheetBody.body}
          </ActionSheet>
        )}

        {jobsOpen && !overlayOn && (
          <Notebook
            hustles={hustles.map((h) => ({ id: h.id, text: h.text, met: !!night && h.met(night.rounds) }))}
            errands={errands}
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
      </div>

      {mapOpen && <CircuitMap current={s.city} cleared={s.cleared} visited={s.visited} onClose={() => setMapOpen(false)} />}

      {menuOpen && (
        <>
          <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 z-[55] cursor-default" onClick={() => setMenuOpen(false)} />
          <div className="st-sheet absolute right-2 top-[54px] z-[60] flex w-48 flex-col gap-1 rounded-md p-1.5" role="menu" aria-label="Story menu" onKeyDown={(e) => { if (e.key === 'Escape') setMenuOpen(false) }}>
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
          </div>
        </>
      )}

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new story?</DialogTitle>
            <DialogDescription>This erases your current story save: money, reputation, cities cleared. It can&apos;t be undone.</DialogDescription>
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
