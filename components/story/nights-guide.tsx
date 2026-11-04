'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CITIES, type City } from '@/lib/story/cities'
import {
  BONUS_STEPS, BOSS_BUYIN_M, BOSS_PURSE_M, BOSS_REMATCH_NIGHTS, CAR_BETS, COMPS_CAP_M, COMPS_RATE, GAMES_PER_ROOM,
  JOB_LIMIT, JOB_OFFER_NIGHTS, JOB_STANDING, HUSTLE_PAY_M, HUSTLES_PER_NIGHT, DEBT_WARN_M, MARKER_M, MARKER_REPAY, MARKER_STANDING, MEAL_BETS, MEAL_M, MINIGAME_JOB_PAY_M,
  NIGHT_BETS, ROOM_BETS, SLEEP_COST_M, START_BETS, sleepCostM, TABLE_JOB_PAY_M, STANDING_BONUS, STANDING_MAX, VENUE_MAX_M, VENUE_REP,
} from '@/lib/story/economy'
import { gamesFor } from '@/lib/story/rotation'
import { GAME_BY_NAME } from '@/lib/game-catalog'
import { VENUE_NAMES } from '@/store/story-store'
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
export function NightsGuide({ city, night, seen, must, onReplay }: { city: City; night: number; seen: GameName[]; must: GameName[]; onReplay: (() => void) | null }) {
  const m = city.minBet
  const first = city.id === CITIES[0]!.id
  const pct = (r: number) => `${Math.round(r * 1000) / 10}%`
  const exBet = 2
  const exTurnover = NIGHT_BETS * exBet * m
  const exComps = Math.round(Math.min(COMPS_RATE[0] * exTurnover, COMPS_CAP_M[0] * m))
  const label = (g: GameName) => GAME_BY_NAME.get(g)?.label ?? g

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
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

      <Section title="Standing">
        <p>
          Standing is how a town sees you. It starts at {0} in every town you reach, and a town you go back to remembers what you left. {STANDING_MAX} is the most one will give you.
        </p>
        <p>
          It goes up {JOB_STANDING} for each table job you finish. Minigame jobs pay more but earn no standing. Borrowing from the town&apos;s lender takes {MARKER_STANDING} off, never below {0}; going broke on its own costs none. The boss pays the purse and clears the town; it does not raise standing.
        </p>
        <p>
          The dive is always open. The main floor wants standing {VENUE_REP[1]}; the high-roller room wants {VENUE_REP[2]}: no bet limit and the best comps, which is where you build the back-table money.
        </p>
        <p>
          Standing keeps paying once the rooms are open. Finish a night up at the tables and the house adds a bonus: a share of that night&apos;s table winnings (what the games paid, less what you staked), on top of comps.
        </p>
        <table className="w-full border-collapse text-left text-[12px] sm:text-[12.5px]">
          <thead>
            <tr className="text-dim">
              {Array.from({ length: STANDING_MAX + 1 }, (_, i) => (
                <th key={i} className="num py-1 pr-1.5 font-semibold">{i === 0 ? 'Standing' : i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-white/10">
              <td className="py-1 pr-1.5 text-dim">Gives</td>
              {Array.from({ length: STANDING_MAX }, (_, k) => {
                const i = k + 1
                const room = VENUE_REP.indexOf(i)
                return (
                  <td key={i} className={`num py-1 pr-1.5 ${BONUS_STEPS.includes(i) ? 'text-gold' : 'text-ink'}`}>
                    {room > 0 ? ROOM_SHORT[room] : `+${pct(STANDING_BONUS[i]!)}`}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
        <p className="text-dim">
          Standing {VENUE_REP[1]} and {VENUE_REP[2]} open rooms; {BONUS_STEPS.join(', ').replace(/, (\d+)$/, ' and $1')} raise the bonus. Example: a night up {money(40 * m)} at standing {STANDING_MAX} adds <span className="num text-gold">{money(Math.round(40 * m * STANDING_BONUS[STANDING_MAX]!))}</span>.
        </p>
      </Section>

      <Section title="Tonight's games">
        <p>Each room deals its own {GAMES_PER_ROOM} of {city.name}&apos;s games. Each night a room swaps a couple and keeps at least one.</p>
        <p className="text-dim">The dive keeps dealing any game an open job names, so the job can always be worked.</p>
        <ul className="flex flex-col gap-0.5">
          {([0, 1, 2] as const).map((v) => (
            <li key={v}>
              <span className="text-ink">{VENUE_NAMES[v]}:</span> {gamesFor(city, night, v, seen, must).map(label).join(', ') || 'none yet'}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Bets a night">
        <p>
          You get {CAR_BETS} bets after a night in the car, {ROOM_BETS} after a night in a room, across the games in your room. A new story starts with {START_BETS}. A double on the same round is not a new bet. Then the house closes your tab.
        </p>
      </Section>

      <Section title="Comps">
        <p>The house gives back a share of everything you bet that night, win or lose. It is not a bonus on wins. Better rooms give a bigger share, up to a cap, and it arrives when the night ends.</p>
        <p>
          Example at {VENUE_NAMES[0].toLowerCase()}: {NIGHT_BETS} bets of {exBet}× the minimum ({money(exBet * m)} each) is {money(exTurnover)} bet. At {pct(COMPS_RATE[0])} that is <span className="num text-gold">{money(exComps)}</span> back
          {COMPS_RATE[0] * exTurnover > COMPS_CAP_M[0] * m ? ` (capped at ${money(COMPS_CAP_M[0] * m)})` : `, well under the ${money(COMPS_CAP_M[0] * m)} cap`}.
        </p>
      </Section>

      <Section title="Hustles & jobs">
        <p>Hustles: {HUSTLES_PER_NIGHT} side goals on the board each night, {money(HUSTLE_PAY_M * m)} each. They pay when the night ends.</p>
        <p>
          Jobs: work people hand you, two kinds. A table job (a goal at the casino) pays {money(TABLE_JOB_PAY_M.min * m)} to {money(TABLE_JOB_PAY_M.max * m)} the moment it is done and earns {JOB_STANDING} standing, up to {STANDING_MAX}. A minigame job pays {money(MINIGAME_JOB_PAY_M.min * m)} to {money(MINIGAME_JOB_PAY_M.max * m)} and earns no standing.
        </p>
        <p>
          Each night one of each turns up, at two people, starting with your first night. Look for the briefcase over someone&apos;s head and talk to them. Say not now and the job waits with them for {JOB_OFFER_NIGHTS} nights, then goes to someone else. A job you took can be dropped from that person&apos;s card: no pay, and they can offer another.
        </p>
        <p>
          Each person gives one job at a time and has nothing new until it is done, and a town gives you at most {JOB_LIMIT} at once, taken or waiting. With one place left, it is a coin flip which kind comes. A town never gives you the same table job twice. Table jobs are how you win back standing lost to a bust.
        </p>
      </Section>

      <Section title="Minigames">
        <p>Minigames are only played as jobs. Take someone&apos;s minigame job and a Play button appears on them. You get one go: hit the score the job asks for and it pays; miss and the job is gone, with no pay. There is no practice.</p>
      </Section>

      <Section title="Ending the night">
        <p>
          You choose where to sleep every night, played or rested. The car is free and gives you {CAR_BETS} bets the next night. A room costs {SLEEP_COST_M.room[0]}× in the first town and {SLEEP_COST_M.room[1]}× after ({money(sleepCostM('room', first) * m)} here), and gives {ROOM_BETS}. Save money in the car and stack it up with minigame jobs, or pay for the room and play more. You can&apos;t take a room you can&apos;t pay for.
        </p>
      </Section>

      <Section title="Loans & going bust">
        <p>
          Each town has a lender (Pike, in Dustwater). Borrow {money(MARKER_M * m)} any night, repaid at {MARKER_REPAY}× (each loan in a town costs a little more), with half the profit of every win going to it until you are square. Every loan drops your standing in this town by {MARKER_STANDING}. Owe {DEBT_WARN_M}× the minimum or more and you will be offered a fresh start.
        </p>
        <p>
          Fall below the minimum bet ({money(m)}) and you are bust, but it costs no standing. Sleep in the car and work minigame jobs, which need no bets, or borrow. The story can&apos;t be lost.
        </p>
        <p>Marta&apos;s diner sells a hot plate for {money(MEAL_M * m)}: {MEAL_BETS} more bets tonight, once a night.</p>
      </Section>

      <Section title="The boss">
        <p>
          Each city has a boss at the back table. The buy-in is {money(BOSS_BUYIN_M * m)} ({BOSS_BUYIN_M}× the minimum) and a win pays a {money(BOSS_PURSE_M * m)} purse and opens the road out. Lose and the rival is back after {BOSS_REMATCH_NIGHTS} nights, with the same buy-in.
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
