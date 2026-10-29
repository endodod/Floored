'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Die } from '@/components/games/die'
import {
  GAME_DOCK_ACTIONS,
  GAME_DOCK_INNER,
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_RACK_BTN,
  GAME_DOCK_SECONDARY_BTN,
  GAME_DOCK_SETTLED_SLOT,
} from '@/components/game-dock-parts'
import type { MatchHistoryEntry } from '@/components/game-match-history'
import { minCountFor } from '@/games/liars-dice/engine'
import type { LiarsBid, LiarsState } from '@/games/liars-dice/types'
import { seatBots } from '@/lib/bots/core'
import { BOT_STYLE_LABEL } from '@/lib/bots/roster'
import { TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import { liarsDef } from '@/lib/tables/defs'
import type { OpenTable } from '@/store/tables-store'
import { createRng } from '@/utils/rng'
import { cn } from '@/lib/utils'
import { SeatPlate } from './seat'
import { TableShell, useSecondsLeft } from './table-shell'
import { useTableRunner } from './use-table-runner'

const TURN_MS = 30_000
const pause = (s: LiarsState) => (s.round === 0 ? 500 : 3800)

const FACE_WORD = ['', '1s', '2s', '3s', '4s', '5s', '6s']
const bidText = (b: LiarsBid) => `${b.count} × ${FACE_WORD[b.face]}`

/** Whether a die counts for a bid on `face` (1s are wild for the other faces). */
const counts = (d: number, face: number) => d === face || (face !== 1 && d === 1)

/** A leather cup, mouth down, with one ivory dot per die under it. */
function Cup({ dice, lifted }: { dice: number; lifted: boolean }) {
  return (
    <div className={cn('ld-cup relative', lifted && 'ld-cup-up')} aria-label={`${dice} dice under the cup`}>
      <span className="ld-cup-dots flex justify-center gap-[3px]" aria-hidden>
        {Array.from({ length: dice }, (_, k) => (
          <span key={k} className="ld-dot" />
        ))}
      </span>
    </div>
  )
}

export function LiarsDiceTable({ table, onPlayAgain }: { table: OpenTable; onPlayAgain: () => void }) {
  const game = TABLE_GAME_BY_NAME.get('liars-dice')!
  const bots = useMemo(() => [null, ...seatBots(table.seats - 1, table.tier, createRng(table.seed ^ 0x51ed))], [table])
  const runner = useTableRunner(liarsDef, { seats: table.seats, human: 0, bots, seed: table.seed, turnMs: TURN_MS, pauseMs: pause })
  const { view: v, yourTurn, thinking } = runner
  const names = useMemo(() => ['You', ...bots.slice(1).map((b) => b!.profile.name)], [bots])
  const secs = useSecondsLeft(runner.deadline)
  const reveal = v.phase !== 'bidding' && v.lastReveal?.round === v.round ? v.lastReveal : null
  const roundLog = v.log.filter((e) => e.round === v.round && e.action.type === 'bid')

  // ── History: one entry per round ──
  const [history, setHistory] = useState<MatchHistoryEntry[]>([])
  useEffect(() => {
    const r = v.lastReveal
    if (!r) return
    setHistory((h) => {
      if (h[0]?.id === `r${r.round}`) return h
      const involved = r.bidder === 0 || r.caller === 0
      const youLost = r.loser === 0
      const entry: MatchHistoryEntry = {
        id: `r${r.round}`,
        at: new Date(),
        title: `Round ${r.round} · ${youLost ? 'you lose a die' : `${names[r.loser]} loses a die`}`,
        subtitle: `${names[r.caller]} called liar on ${names[r.bidder]}'s ${bidText(r.bid)}; there were ${r.actual}.`,
        tone: youLost ? 'loss' : involved ? 'win' : 'neutral',
      }
      return [entry, ...h].slice(0, 80)
    })
  }, [v.lastReveal, names])

  // ── Bid picker ──
  const favourite = useMemo(() => {
    let best = 2
    for (let f = 2; f <= 6; f++) if (v.dice.filter((d) => counts(d, f)).length > v.dice.filter((d) => counts(d, best)).length) best = f
    return best
  }, [v.dice])
  const [face, setFace] = useState(2)
  const [count, setCount] = useState(1)
  const minFor = (f: number) => minCountFor(v.bid, f)
  useEffect(() => {
    if (!yourTurn) return
    const f = v.bid && minCountFor(v.bid, v.bid.face) <= v.totalDice ? (minFor(favourite) <= v.totalDice ? favourite : v.bid.face) : favourite
    setFace(f)
    setCount(Math.max(1, minCountFor(v.bid, f)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourTurn, v.round, v.bid])
  const lowest = minFor(face)
  const faceOk = (f: number) => minFor(f) <= v.totalDice
  const pick = (f: number) => {
    setFace(f)
    setCount((c) => Math.min(v.totalDice, Math.max(c, minFor(f))))
  }
  const bidOk = yourTurn && v.canBid && count >= lowest && count <= v.totalDice

  // ── Status line ──
  const thinker = thinking ? names[thinking.seat] : null
  let message: string
  if (runner.place != null && !runner.over) message = 'You are out · the table plays on'
  else if (runner.over) message = 'Table over'
  else if (reveal) message = `${names[reveal.caller]} calls liar · ${reveal.actual} ${FACE_WORD[reveal.bid.face]} · ${names[reveal.loser]} loses a die`
  else if (yourTurn) message = v.bid ? `Your turn · raise ${bidText(v.bid)} or call liar` : 'Your turn · open the bidding'
  else if (thinker) message = `${thinker} is thinking…`
  else message = `Round ${Math.max(v.round, 1)} · ${v.totalDice} dice on the table`

  const seatEl = (i: number) => {
    const bot = bots[i]!
    const out = v.out[i]!
    const dice = reveal ? reveal.dice[i]! : []
    const last = [...roundLog].reverse().find((e) => e.seat === i)
    const status = out
      ? null
      : thinking?.seat === i
        ? { text: 'Thinking…', tone: 'dim' as const }
        : reveal && reveal.loser === i
          ? { text: '−1 die', tone: 'loss' as const }
          : reveal && reveal.caller === i
            ? { text: 'Liar!', tone: 'gold' as const }
            : last && last.action.type === 'bid'
              ? { text: bidText(last.action.bid), tone: 'neutral' as const }
              : null
    return (
      <div key={i} className="ld-seat flex min-w-0 flex-col items-center" style={{ gridArea: `s${i}` }}>
        <SeatPlate
          name={bot.profile.name}
          tag={BOT_STYLE_LABEL[bot.profile.style]}
          stack={null}
          stackLabel={out ? 'Out' : `${v.diceCounts[i]} ${v.diceCounts[i] === 1 ? 'die' : 'dice'}`}
          timer={thinking?.seat === i ? { ms: thinking.ms, key: `${v.round}-${v.log.length}` } : null}
          dim={out}
          win={!!reveal && reveal.loser !== i && (reveal.caller === i || reveal.bidder === i)}
          status={status?.text}
          statusTone={status?.tone}
        >
          {!out && (
            <div className="ld-under relative mt-0.5 flex h-[calc(var(--die-s)*1.15)] items-center justify-center">
              {reveal ? (
                <span className={cn('flex gap-[3px]', reveal.loser === i && 'g-shake')} style={{ '--die': 'var(--die-s)' } as CSSProperties}>
                  {dice.map((d, k) => (
                    <Die
                      key={k}
                      value={d}
                      tone={counts(d, reveal.bid.face) ? 'win' : 'neutral'}
                      className={cn('g-pop', !counts(d, reveal.bid.face) && 'ld-miss')}
                    />
                  ))}
                </span>
              ) : (
                <Cup dice={v.diceCounts[i]!} lifted={false} />
              )}
            </div>
          )}
        </SeatPlate>
      </div>
    )
  }

  const board = (
    <div className="ld-table" data-seats={table.seats}>
      <div aria-hidden className="hd-oval" />
      {Array.from({ length: table.seats - 1 }, (_, k) => seatEl(k + 1))}

      <div className="ld-centre flex min-w-0 flex-col items-center justify-center gap-1.5" style={{ gridArea: 'c' }}>
        <p className="ld-print felt-print text-center">1s are wild · Round {Math.max(v.round, 1)}</p>
        <div className="flex min-h-[var(--die-l)] items-center gap-2.5" aria-live="polite">
          {v.bid ? (
            <>
              <span key={`${v.round}-${v.bidder}-${v.bid.count}-${v.bid.face}`} className="num g-pop text-[clamp(1.5rem,7cqh,2.4rem)] font-semibold leading-none text-ink">
                {v.bid.count}
                <span className="mx-1 text-dim">×</span>
              </span>
              <span style={{ '--die': 'var(--die-l)' } as CSSProperties}>
                <Die value={v.bid.face} className="g-pop" />
              </span>
            </>
          ) : (
            <span className="text-[13px] text-dim">{reveal ? '' : 'No bid yet'}</span>
          )}
        </div>
        <p className="h-4 text-[12px] leading-4 text-soft">
          {reveal ? (
            <span className={reveal.actual >= reveal.bid.count ? 'text-felt' : 'text-loss'}>
              There {reveal.actual === 1 ? 'was' : 'were'} {reveal.actual} · {reveal.actual >= reveal.bid.count ? 'the bid holds' : 'short'}
            </span>
          ) : v.bidder != null ? (
            `${names[v.bidder]} ${v.bidder === 0 ? 'bid' : 'bids'}`
          ) : null}
        </p>
        <ol className="ld-trail flex h-5 max-w-full items-center gap-1.5 overflow-hidden text-[11px]" aria-label="Bids this round">
          {roundLog.slice(-6).map((e, k, arr) =>
            e.action.type === 'bid' ? (
              <li key={`${e.round}-${v.log.indexOf(e)}`} className={cn('num shrink-0 rounded-full border border-line px-2 leading-4', k === arr.length - 1 ? 'text-ink' : 'text-dim')}>
                {e.action.bid.count}×{e.action.bid.face}
                <span className="ml-1 text-dim">{e.seat === 0 ? 'you' : names[e.seat]}</span>
              </li>
            ) : null,
          )}
        </ol>
      </div>

      <div className="ld-you flex items-center justify-center gap-3" style={{ gridArea: 'y' }}>
        <SeatPlate
          name="You"
          you
          stack={null}
          stackLabel={v.out[0] ? 'Out' : `${v.diceCounts[0]} ${v.diceCounts[0] === 1 ? 'die' : 'dice'}`}
          timer={yourTurn ? { ms: TURN_MS, key: `${v.round}-${v.log.length}` } : null}
          dim={v.out[0]}
          status={reveal?.loser === 0 ? '−1 die' : undefined}
          statusTone="loss"
        />
        <div className={cn('flex gap-1.5', reveal?.loser === 0 && 'g-shake')} style={{ '--die': 'var(--die-you)' } as CSSProperties} aria-label="Your dice">
          {(reveal ? reveal.dice[0]! : v.dice).map((d, k) => {
            const hit = reveal ? counts(d, reveal.bid.face) : false
            return (
              <Die
                key={`${v.round}-${k}`}
                value={d}
                tone={hit ? 'win' : 'neutral'}
                className={cn(!reveal && 'g-pop', reveal && !hit && 'ld-miss')}
              />
            )
          })}
        </div>
      </div>
    </div>
  )

  const dock = (
    <div className={GAME_DOCK_INNER}>
      <div
        role="radiogroup"
        aria-label="Face"
        className={cn('flex min-h-12 shrink-0 items-center justify-center gap-1.5 sm:gap-2', !yourTurn && 'invisible pointer-events-none')}
        style={{ '--die': '2.1rem' } as CSSProperties}
      >
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={face === f}
            aria-label={FACE_WORD[f]}
            disabled={!faceOk(f)}
            onClick={() => pick(f)}
            className={cn('ld-face m-still g-lift rounded-[0.45rem] disabled:opacity-25', face === f && '-translate-y-1 ring-2 ring-gold ring-offset-2 ring-offset-ground')}
          >
            <Die value={f} />
          </button>
        ))}
      </div>
      <div className={GAME_DOCK_SETTLED_SLOT}>
        {yourTurn ? (
          <div className="flex items-center gap-2">
            <button type="button" className={GAME_DOCK_RACK_BTN + ' h-9 w-9 px-0 sm:h-9'} aria-label="Fewer dice" disabled={count <= lowest} onClick={() => setCount((c) => c - 1)}>
              −
            </button>
            <p className="num w-36 text-center text-[13px] text-soft">
              <span className="text-[17px] text-ink">{count}</span> × {FACE_WORD[face]}
              {secs != null && secs <= 10 && <span className="text-loss"> · {secs}s</span>}
            </p>
            <button type="button" className={GAME_DOCK_RACK_BTN + ' h-9 w-9 px-0 sm:h-9'} aria-label="More dice" disabled={count >= v.totalDice} onClick={() => setCount((c) => c + 1)}>
              +
            </button>
          </div>
        ) : (
          <p className="text-[13px] text-dim">
            {v.out[0] ? 'You are out' : thinker ? `${thinker} is thinking…` : reveal ? 'Next round coming up' : 'Waiting…'}
          </p>
        )}
      </div>
      <div className={GAME_DOCK_ACTIONS}>
        <div className="flex justify-center gap-2">
          <button type="button" className={GAME_DOCK_SECONDARY_BTN} disabled={!yourTurn || !v.canCallLiar} onClick={() => runner.act({ type: 'liar' })}>
            Liar!
          </button>
          <button
            type="button"
            className={GAME_DOCK_PRIMARY_BTN}
            disabled={!bidOk}
            onClick={() => runner.act({ type: 'bid', bid: { count, face } })}
          >
            Bid <span className="num ml-1">{count} × {FACE_WORD[face]}</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <TableShell
      game={game}
      table={table}
      names={names}
      standings={runner.standings}
      place={runner.place}
      over={runner.over}
      watching={runner.watching}
      onWatch={() => runner.setWatching(true)}
      onPlayAgain={onPlayAgain}
      message={message}
      history={history}
      board={board}
      dock={dock}
    />
  )
}

