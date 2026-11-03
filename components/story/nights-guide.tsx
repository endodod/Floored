'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { City } from '@/lib/story/cities'
import {
  BOSS_BUYIN_M, BOSS_PURSE_M, BOSS_REMATCH_NIGHTS, CAR_BELOW_M, COMPS_CAP_M, COMPS_RATE, ERRAND_PAY_M, GAMES_PER_ROOM, HUSTLE_PAY_M,
  HUSTLES_PER_NIGHT, LODGING_M, MARKER_M, MARKER_REPAY, MINIGAME_MAX_M, NIGHT_BETS, VENUE_MAX_M,
} from '@/lib/story/economy'
import { gamesFor, pinnedErrandGames } from '@/lib/story/rotation'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { useStoryStore, VENUE_NAMES, VENUE_REP } from '@/store/story-store'
import { formatChips } from '@/utils/format'
import type { GameName } from '@/store/types'

const money = (n: number) => `$${formatChips(n)}`
const ROOM_SHORT = ['Dive', 'Main floor', 'High roller'] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="felt-print !text-[10.5px]">{title}</h3>
      <div className="flex flex-col gap-1.5 text-[13px] leading-5 text-soft">{children}</div>
    </section>
  )
}

/**
 * "How the nights work": the story rules on one card. Every number is read from
 * lib/story/economy.ts (and the store's room table) and shown in the current
 * city's dollars, so it can't drift from the game.
 */
export function NightsGuide({ city, night, seen, onReplay }: { city: City; night: number; seen: GameName[]; onReplay: (() => void) | null }) {
  const m = city.minBet
  const pct = (r: number) => `${Math.round(r * 1000) / 10}%`
  const exBet = 2
  const exTurnover = NIGHT_BETS * exBet * m
  const exComps = Math.round(Math.min(COMPS_RATE[0] * exTurnover, COMPS_CAP_M[0] * m))
  const label = (g: GameName) => GAME_BY_NAME.get(g)?.label ?? g
  const errands = useStoryStore((s) => s.openErrands())
  const pinned = pinnedErrandGames(errands)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <Section title="Standing">
        <p>Standing is how the town sees you, from 0 to 5. You start at 0 in every new town.</p>
        <p>Finish jobs won at the tables (streaks, nights up, big wins) to earn standing (+1 each). Minigames pay money only.</p>
        <p>The dive takes anyone (standing 0). The main floor asks for standing {VENUE_REP[1]}. The high-roller room asks for standing {VENUE_REP[2]}: no bet limit, best comps, and where you build the boss buy-in.</p>
        <p>Go bust and your standing drops by 1 (never below 0).</p>
      </Section>

      <Section title="Rooms">
        <p>A night is one room. Pick it, and stay until you call it a night.</p>
        <table className="w-full border-collapse text-left text-[12px] sm:text-[12.5px]">
          <thead>
            <tr className="text-dim">
              <th className="py-1 pr-1.5 font-semibold">Room</th>
              <th className="py-1 pr-1.5 font-semibold">Needs</th>
              <th className="py-1 pr-1.5 font-semibold">Bet limit</th>
              <th className="py-1 font-semibold">Comps</th>
            </tr>
          </thead>
          <tbody>
            {([0, 1, 2] as const).map((v) => (
              <tr key={v} className="border-t border-white/10">
                <td className="py-1 pr-1.5 text-ink">{ROOM_SHORT[v]}</td>
                <td className="py-1 pr-1.5">{VENUE_REP[v] === 0 ? 'Anyone' : `Standing ${VENUE_REP[v]}`}</td>
                <td className="num py-1 pr-1.5">{VENUE_MAX_M[v] == null ? 'No limit' : money(VENUE_MAX_M[v]! * m)}</td>
                <td className="num py-1">{pct(COMPS_RATE[v])} · max {money(COMPS_CAP_M[v] * m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-dim">Bet limits are {VENUE_MAX_M[0]}× and {VENUE_MAX_M[1]}× the minimum bet ({money(m)}).</p>
      </Section>

      <Section title="Tonight's games">
        <p>Each room deals its own {GAMES_PER_ROOM} of {city.name}&apos;s games. Each night a room swaps a couple and keeps at least one.</p>
        <ul className="flex flex-col gap-0.5">
          {([0, 1, 2] as const).map((v) => (
            <li key={v}>
              <span className="text-ink">{VENUE_NAMES[v]}:</span> {gamesFor(city, night, v, seen, pinned).map(label).join(', ') || 'none yet'}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`${NIGHT_BETS} bets`}>
        <p>You get {NIGHT_BETS} bets a night, across the games in your room. A double on the same round is not a new bet. Then the house closes your tab.</p>
      </Section>

      <Section title="Comps">
        <p>The house gives back a share of everything you bet that night, win or lose. It is not a bonus on wins. Better rooms give a bigger share, up to a cap, and it arrives when the night ends.</p>
        <p>
          Example at {VENUE_NAMES[0].toLowerCase()}: {NIGHT_BETS} bets of {exBet}× the minimum ({money(exBet * m)} each) is {money(exTurnover)} bet. At {pct(COMPS_RATE[0])} that is <span className="num text-gold">{money(exComps)}</span> back
          {COMPS_RATE[0] * exTurnover > COMPS_CAP_M[0] * m ? ` (capped at ${money(COMPS_CAP_M[0] * m)})` : `, well under the ${money(COMPS_CAP_M[0] * m)} cap`}.
        </p>
      </Section>

      <Section title="Hustles & errands">
        <p>Hustles: {HUSTLES_PER_NIGHT} side goals on the board each night, {money(HUSTLE_PAY_M * m)} each. They pay when the night ends.</p>
        <p>Errands: jobs people give you. Each pays {money(ERRAND_PAY_M * m)} the moment it is done.</p>
      </Section>

      <Section title="Minigames">
        <p>Each character with a minigame pays once a night, up to {money(MINIGAME_MAX_M * m)} at a perfect score. After that it is practice. They pay whether or not you played the casino.</p>
      </Section>

      <Section title="Ending the night">
        <p>
          A room is {money(LODGING_M * m)} a night. Under {money(CAR_BELOW_M * m)} you sleep in the car and it is free. You can rest without playing: the room still costs.
        </p>
      </Section>

      <Section title="Going bust & the Notary">
        <p>
          Fall below the minimum bet ({money(m)}) and you are bust: you lose a point of standing. The Notary will lend you a marker of {money(MARKER_M * m)}, repaid at {MARKER_REPAY}×. Half the profit from each win goes to it until it is square.
        </p>
      </Section>

      <Section title="The boss">
        <p>
          Each city has a boss at the back table. The buy-in is {money(BOSS_BUYIN_M * m)} ({BOSS_BUYIN_M}× the minimum) and a win pays a {money(BOSS_PURSE_M * m)} purse, opens the road out. Lose and the rival is back after {BOSS_REMATCH_NIGHTS} nights, with the same buy-in.
        </p>
      </Section>

      {onReplay && (
        <div className="pt-1">
          <Button size="sm" variant="secondary" onClick={onReplay}>Replay Jo&apos;s walkthrough</Button>
        </div>
      )}
    </div>
  )
}
