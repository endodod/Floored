'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FigureStrip, SectionTitle } from '@/components/ui/terminal'
import { DialogueBox } from '@/components/story/dialogue-box'
import { Portrait } from '@/components/story/portrait'
import { CITIES, CITY_BY_ID, type City } from '@/lib/story/cities'
import { CHARACTERS } from '@/lib/story/content/characters'
import { BOSS_BUYIN_M, NIGHT_BETS, VENUE_MAX_M } from '@/lib/story/economy'
import { hustlesFor } from '@/lib/story/hustles'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { useStoryStore, VENUE_NAMES, VENUE_REP, type VenueTier } from '@/store/story-store'
import { formatChips } from '@/utils/format'
import type { Character } from '@/lib/story/types'

const money = (n: number) => `$${formatChips(n)}`
const PANEL = 'flex flex-col gap-3 rounded-md bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)] sm:p-5'
const ROW = 'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-ground/60 p-3 shadow-[inset_0_0_0_1px_var(--line)]'
const ACTS = [1, 2, 3, 4] as const
/** The rival who sits at each city's boss table (the one character per city without a minigame). */
const bossOf = (city: City): Character | undefined =>
  CHARACTERS.find((c) => c.city === city.id && !c.minigame)
const isLook = (id: string): id is PortraitLook => (PORTRAIT_LOOKS as string[]).includes(id)

function Face({ id, size = 48 }: { id: string; size?: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-md" style={{ width: size }}>
      {isLook(id) ? <Portrait look={id} size={size} /> : null}
    </div>
  )
}

/** The twelve cities by act, in a box that scrolls sideways on its own. */
function CircuitMap({ current, cleared }: { current: string; cleared: string[] }) {
  const idx = CITIES.findIndex((c) => c.id === current)
  return (
    <div className="overflow-x-auto rounded-md bg-surface p-3 shadow-[inset_0_0_0_1px_var(--line)]" tabIndex={0} aria-label="The circuit, twelve cities">
      <ol className="flex w-max gap-4">
        {ACTS.map((act) => (
          <li key={act} className="flex flex-col gap-1.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-dim">Act {act}</p>
            <ol className="flex gap-1.5">
              {CITIES.map((c, i) =>
                c.act !== act ? null : (
                  <li
                    key={c.id}
                    aria-current={c.id === current ? 'step' : undefined}
                    className={`flex w-[88px] flex-col rounded-md px-2 py-1.5 text-[12px] leading-4 shadow-[inset_0_0_0_1px_var(--line)] ${
                      c.id === current
                        ? 'bg-felt-tint text-ink shadow-[inset_0_0_0_1px_var(--felt)]'
                        : i < idx || cleared.includes(c.id)
                          ? 'text-soft'
                          : 'text-dim opacity-60'
                    }`}
                  >
                    <span className="font-semibold">{c.name}</span>
                    <span className="num text-[11px]">
                      {cleared.includes(c.id) ? 'Cleared' : c.id === current ? 'You are here' : i < idx ? 'Passed' : `${money(c.minBet)} min`}
                    </span>
                  </li>
                ),
              )}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function StoryHub() {
  const s = useStoryStore()
  const [confirmNew, setConfirmNew] = useState(false)
  const city = CITY_BY_ID.get(s.city)!
  const m = city.minBet
  const sceneOn = !!s.scene

  if (!s.started) {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 pb-12">
        <h1 className="text-2xl font-semibold text-ink">The Circuit</h1>
        <div className={PANEL}>
          <p className="text-[15px] leading-relaxed text-soft">
            Your grandfather left you a seat at a club that no longer exists. Twelve cities, one circuit, and a rival who is always a city ahead.
            Play nights at the tables, take work where you find it, and win each city&apos;s boss to move on. Play money only.
          </p>
          <div>
            <Button size="lg" onClick={() => { s.newStory(); s.playQueued() }}>Start the story</Button>
          </div>
        </div>
      </div>
    )
  }

  const night = s.tonight
  const stakeNote = (v: VenueTier) => {
    const max = VENUE_MAX_M[v]
    return max == null ? 'No table limit' : `Bets up to ${money(max * m)}`
  }
  const errands = s.openErrands()
  const hustles = hustlesFor(s.city, s.night)
  const people = CHARACTERS.filter((c) => c.city === s.city && c !== bossOf(city))
  const boss = bossOf(city)
  const cleared = s.cleared.includes(s.city)
  const fare = s.fareToNext()
  const nextCity = CITIES[CITIES.findIndex((c) => c.id === s.city) + 1]
  const games = city.games === 'all-seen' ? s.seenGames : city.games
  const broke = s.money < m && !night
  const summary = !night ? s.lastNight : null

  const talk = (character: string) => {
    const id = s.sceneFor({ on: 'talk', character })
    if (id) s.startScene(id)
  }
  const bossIntro = s.sceneFor({ on: 'boss-intro' })
  const endNight = () => {
    s.endNight()
    useStoryStore.getState().playQueued()
  }

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-6 pb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">{city.name}</h1>
        <p className="text-[13px] text-dim">{city.feel}</p>
      </div>

      <FigureStrip
        items={[
          { label: 'Night', value: s.night + 1, sub: `${city.name} night ${s.cityNight + 1}` },
          { label: 'Money', value: money(s.money), tone: s.money < m ? 'loss' : 'gold', sub: `Min bet ${money(m)}` },
          { label: 'Owed', value: money(s.owed), tone: s.owed > 0 ? 'loss' : 'dim', sub: s.owed > 0 ? 'Half of each win repays it' : 'No marker' },
          { label: 'Reputation', value: s.rep, unit: '/ 5' },
        ]}
      />

      <CircuitMap current={s.city} cleared={s.cleared} />

      {sceneOn && (
        <div className="flex flex-col gap-2" role="region" aria-label="Scene">
          <DialogueBox />
        </div>
      )}

      {!sceneOn && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            {/* Play a night */}
            <section className={PANEL} aria-labelledby="play-h">
              <SectionTitle suit={0} note={night ? `${night.bets}/${NIGHT_BETS} bets used` : `${NIGHT_BETS} bets a night`}>
                <span id="play-h">{night ? `Tonight: ${VENUE_NAMES[night.venue]}` : 'Play a night'}</span>
              </SectionTitle>
              {night ? (
                <>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {games.map((g) => (
                      <li key={g}>
                        <Button asChild variant="outline" className="w-full justify-start">
                          <Link href={`/story/${g}`}>{GAME_BY_NAME.get(g)?.label ?? g}</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-dim">Money now {money(s.money)}. {stakeNote(night.venue)}.</p>
                </>
              ) : broke ? (
                <p className="text-[13px] text-soft">You can&apos;t cover the minimum bet ({money(m)}). Rest, or see the Notary.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {([0, 1, 2] as VenueTier[]).map((v) => {
                    const open = s.venueOpen(v)
                    return (
                      <li key={v} className={ROW}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-ink">{VENUE_NAMES[v]}</p>
                          <p className="text-xs text-dim">{open ? stakeNote(v) : `Needs reputation ${VENUE_REP[v]} (you have ${s.rep})`}</p>
                        </div>
                        <Button size="sm" disabled={!open} onClick={() => s.startNight(v)}>{open ? 'Start the night' : 'Locked'}</Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* People */}
            <section className={PANEL} aria-labelledby="people-h">
              <SectionTitle suit={1}><span id="people-h">People</span></SectionTitle>
              <ul className="flex flex-col gap-2">
                {people.map((c) => (
                  <li key={c.id} className={ROW}>
                    <Face id={c.id} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-ink">{c.name}</p>
                      {c.minigame && (
                        <p className="text-xs text-dim">{s.minigamePaidTonight(c.id) ? 'Paid tonight' : 'Minigame pays once a night'}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={!s.sceneFor({ on: 'talk', character: c.id })} onClick={() => talk(c.id)}>Talk</Button>
                      {c.minigame && <Button size="sm" variant="secondary" disabled>Soon</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Boss */}
            {boss && (
              <section className={PANEL} aria-labelledby="boss-h">
                <SectionTitle suit={3} note={`Buy-in ${money(BOSS_BUYIN_M * m)}`}><span id="boss-h">The boss</span></SectionTitle>
                <div className={ROW}>
                  <Face id={boss.id} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{boss.name}</p>
                    <p className="text-xs text-dim">
                      {cleared ? 'Beaten' : s.bossBackOn != null ? `Back on night ${s.bossBackOn + 1}` : 'Waiting at the table'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={!bossIntro} onClick={() => bossIntro && s.startScene(bossIntro)}>Talk</Button>
                    <Button size="sm" variant="secondary" disabled>Soon</Button>
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            {/* Jobs */}
            <section className={PANEL} aria-labelledby="jobs-h">
              <SectionTitle suit={2} note="Hustles pay when the night ends"><span id="jobs-h">Jobs</span></SectionTitle>
              <ul className="flex flex-col gap-2">
                {hustles.map((h) => {
                  const met = !!night && h.met(night.rounds)
                  return (
                    <li key={h.id} className={ROW}>
                      <span aria-hidden className={`text-sm ${met ? 'text-felt' : 'text-dim'}`}>{met ? '✓' : '○'}</span>
                      <p className="min-w-0 flex-1 text-[13px] text-soft">{h.text}</p>
                    </li>
                  )
                })}
                {errands.map((e) => (
                  <li key={e.id} className={ROW}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink">{e.title}</p>
                      <p className="text-xs text-dim">{e.task}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* The Notary */}
            {broke && (
              <section className={PANEL} aria-labelledby="notary-h">
                <SectionTitle suit={3}><span id="notary-h">The Notary</span></SectionTitle>
                <div className={ROW}>
                  <Face id="notary" />
                  <p className="min-w-0 flex-1 text-[13px] text-soft">
                    A marker puts chips in your hand. Half of every win goes to the Notary until it is paid, and each one costs more.
                  </p>
                  <Button size="sm" onClick={() => s.takeMarker()}>Take a marker</Button>
                </div>
              </section>
            )}

            {/* Night's end / rest / travel */}
            <section className={PANEL} aria-labelledby="end-h">
              <SectionTitle suit={0}><span id="end-h">{night ? 'End the night' : 'Rest'}</span></SectionTitle>
              <p className="text-[13px] text-soft">
                {night ? 'Settles comps, hustles and your room.' : 'Skip the night. Your room still costs, and the board changes.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant={night ? 'default' : 'secondary'} onClick={endNight}>{night ? 'End the night' : 'Rest until tomorrow'}</Button>
                {cleared && nextCity && fare != null && !night && (
                  <Button variant="outline" disabled={s.money < fare} onClick={() => { if (s.travelNext()) s.playQueued() }}>
                    Travel to {nextCity.name} · {money(fare)}
                  </Button>
                )}
              </div>
            </section>

            {summary && (
              <section className={PANEL} aria-labelledby="sum-h">
                <SectionTitle suit={2} note={`Night ${summary.night}`}><span id="sum-h">Last night</span></SectionTitle>
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[13px]">
                  {summary.played && (<><dt className="text-dim">Comps</dt><dd className="num text-right text-ink">+{money(summary.comps)}</dd></>)}
                  {summary.hustles.map((h) => (
                    <div key={h.text} className="contents">
                      <dt className="text-dim">{h.text}</dt>
                      <dd className="num text-right text-ink">{h.paid ? `+${money(h.paid)}` : 'missed'}</dd>
                    </div>
                  ))}
                  <dt className="text-dim">{summary.car ? 'Slept in the car' : 'Lodging'}</dt>
                  <dd className="num text-right text-ink">{summary.car ? '$0' : `-${money(summary.lodging)}`}</dd>
                  <dt className="font-semibold text-soft">Net</dt>
                  <dd className={`num text-right font-semibold ${summary.net < 0 ? 'text-loss' : 'text-felt'}`}>{summary.net < 0 ? '-' : '+'}{money(Math.abs(summary.net))}</dd>
                </dl>
                {summary.bust && <p className="text-[13px] text-loss">Bust: you lost a point of reputation.</p>}
              </section>
            )}
          </div>
        </div>
      )}

      {s.news.length > 0 && (
        <section className={PANEL} aria-label="News">
          <ul className="flex flex-col gap-1.5">
            {s.news.map((n) => (
              <li key={n.id} className="flex items-start gap-2 text-[13px] text-soft">
                <span className="min-w-0 flex-1">{n.text}</span>
                <button type="button" onClick={() => s.dismissNews(n.id)} className="shrink-0 text-xs text-dim hover:text-ink" aria-label="Dismiss">✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <Button variant="ghost" size="sm" disabled={sceneOn} onClick={() => setConfirmNew(true)}>New story</Button>
      </div>
      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new story?</DialogTitle>
            <DialogDescription>This erases your current story save: money, reputation, cities cleared. It can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setConfirmNew(false)}>Keep playing</Button>
            <Button variant="destructive" onClick={() => { setConfirmNew(false); s.newStory(); s.playQueued() }}>Erase and restart</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
