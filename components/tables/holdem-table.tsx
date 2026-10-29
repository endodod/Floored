'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { PlayingCard } from '@/components/games/playing-card'
import {
  GAME_DOCK_ACTIONS,
  GAME_DOCK_INNER,
  GAME_DOCK_PRIMARY_BTN,
  GAME_DOCK_RACK_BTN,
  GAME_DOCK_SECONDARY_BTN,
  GAME_DOCK_SETTLED_SLOT,
} from '@/components/game-dock-parts'
import type { MatchHistoryEntry } from '@/components/game-match-history'
import { evaluate, fullDeck, labelOf, sameCard, shuffled } from '@/games/holdem/evaluator'
import type { Card, HoldemActionKind, HoldemState, HoldemView } from '@/games/holdem/types'
import { seatBots } from '@/lib/bots/core'
import { BOT_STYLE_LABEL } from '@/lib/bots/roster'
import { TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import { holdemDef } from '@/lib/tables/defs'
import type { OpenTable } from '@/store/tables-store'
import { createRng } from '@/utils/rng'
import { formatChips } from '@/utils/format'
import { cn } from '@/lib/utils'
import { SeatPlate } from './seat'
import { TableShell, useSecondsLeft } from './table-shell'
import { useTableRunner } from './use-table-runner'

const TURN_MS = 30_000
const pause = (s: HoldemState) => (s.hand === 0 ? 500 : s.lastResult?.showdown ? 3400 : 1600)

const KIND_LABEL: Record<HoldemActionKind, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise to',
  'all-in': 'All in',
  'small-blind': 'Small blind',
  'big-blind': 'Big blind',
}

function actionText(view: HoldemView, seat: number): { text: string; tone: 'neutral' | 'gold' | 'dim' } | null {
  const s = view.seats[seat]!
  if (!s.lastAction) return null
  if (s.lastAction === 'fold') return { text: 'Fold', tone: 'dim' }
  if (s.lastAction === 'check') return { text: 'Check', tone: 'neutral' }
  if (s.lastAction === 'all-in') return { text: 'All in', tone: 'gold' }
  return { text: KIND_LABEL[s.lastAction], tone: 'neutral' }
}

function cardKey(c: Card) {
  return `${c.rank}${c.suit}`
}

/** Bet in front of a seat: a small chip and the figure. */
function BetChip({ amount }: { amount: number }) {
  if (amount <= 0) return null
  return (
    <span className="tb-bet g-pop inline-flex items-center gap-1">
      <span className="chip tb-chip" style={{ '--chip': '#1b1a1f', '--chip-ink': '#d9a441' } as CSSProperties} aria-hidden />
      <span className="num text-[11px] text-ink">{formatChips(amount)}</span>
    </span>
  )
}

export function HoldemTable({ table, onPlayAgain }: { table: OpenTable; onPlayAgain: () => void }) {
  const game = TABLE_GAME_BY_NAME.get('holdem')!
  const bots = useMemo(() => [null, ...seatBots(table.seats - 1, table.tier, createRng(table.seed ^ 0x51ed))], [table])
  const runner = useTableRunner(holdemDef, { seats: table.seats, human: 0, bots, seed: table.seed, turnMs: TURN_MS, pauseMs: pause })
  const { view: v, yourTurn, thinking } = runner
  const names = useMemo(() => ['You', ...bots.slice(1).map((b) => b!.profile.name)], [bots])
  const me = v.seats[0]!
  const legal = v.legal
  const secs = useSecondsLeft(runner.deadline)
  const result = v.phase !== 'betting' && v.lastResult?.hand === v.hand ? v.lastResult : null
  const equity = useMemo(() => {
    if (!me.hole || me.hole.length !== 2 || me.folded || me.out) return null
    const opponents = v.seats.filter((s, i) => i !== 0 && !s.out && !s.folded).length
    if (!opponents) return null
    const known = [...me.hole, ...v.board]
    const remaining = fullDeck().filter((card) => !known.some((seen) => sameCard(card, seen)))
    const seedText = known.map((card) => `${card.rank}${card.suit}`).join('') + `${v.hand}:${opponents}`
    const seed = [...seedText].reduce((n, char) => (Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0), 2166136261)
    const rng = createRng(seed)
    const trials = 500
    let share = 0
    for (let trial = 0; trial < trials; trial++) {
      const cards = shuffled(remaining, rng)
      let cursor = 0
      const otherHands = Array.from({ length: opponents }, () => [cards[cursor++]!, cards[cursor++]!])
      const board = [...v.board]
      while (board.length < 5) board.push(cards[cursor++]!)
      const heroScore = evaluate([...me.hole, ...board])
      const scores = [heroScore, ...otherHands.map((hand) => evaluate([...hand, ...board]))]
      const best = Math.max(...scores)
      const winners = scores.filter((score) => score === best).length
      if (heroScore === best) share += 1 / winners
    }
    return Math.round((share / trials) * 100)
  }, [me.hole, me.folded, me.out, v.seats, v.board, v.hand])

  // ── History: one entry per hand you were dealt into ──
  const [history, setHistory] = useState<MatchHistoryEntry[]>([])
  useEffect(() => {
    const r = v.lastResult
    if (!r || v.phase === 'betting' || (r.net[0] === 0 && me.out && !r.busted.includes(0))) return
    setHistory((h) => {
      if (h[0]?.id === `h${r.hand}`) return h
      const net = r.net[0] ?? 0
      const won = r.pots.some((p) => p.winners.includes(0))
      const lostTo = r.pots[0]?.winners.filter((w) => w !== 0).map((w) => names[w]).join(' & ')
      const subtitle = won
        ? r.showdown
          ? `Won with ${r.labels[0]}`
          : 'Everyone folded'
        : v.seats[0]!.folded || !r.shown[0]
          ? 'Folded'
          : `Lost to ${lostTo}${r.pots[0]?.label ? ` (${r.pots[0].label})` : ''}`
      const entry: MatchHistoryEntry = {
        id: `h${r.hand}`,
        at: new Date(),
        title: `Hand ${r.hand} · ${net > 0 ? '+' : net < 0 ? '−' : ''}${formatChips(Math.abs(net))}`,
        subtitle,
        tone: net > 0 ? 'win' : net < 0 ? 'loss' : 'neutral',
      }
      return [entry, ...h].slice(0, 80)
    })
  }, [v.lastResult, v.phase, v.seats, me.out, names])

  // ── Raise sizing ──
  const [raiseTo, setRaiseTo] = useState(0)
  const minTo = legal?.minRaiseTo ?? 0
  const maxTo = legal?.maxRaiseTo ?? 0
  useEffect(() => {
    if (yourTurn && legal?.minRaiseTo != null) setRaiseTo(legal.minRaiseTo)
  }, [yourTurn, legal?.minRaiseTo])
  const potAfterCall = v.pot + (legal?.toCall ?? 0)
  const clampTo = (n: number) => Math.round(Math.min(maxTo, Math.max(minTo, n)))
  const canRaise = yourTurn && legal?.minRaiseTo != null
  const isBet = v.currentBet === 0

  // ── Status line ──
  const thinker = thinking ? names[thinking.seat] : null
  let message: string
  if (runner.place != null && !runner.over) message = 'You are out · the table plays on'
  else if (runner.over) message = 'Table over'
  else if (yourTurn) message = legal?.canCheck ? 'Your turn · check or bet' : `Your turn · ${formatChips(legal?.toCall ?? 0)} to call`
  else if (thinker) message = `${thinker} is thinking…`
  else if (result) {
    const w = result.pots[0]?.winners ?? []
    message = `${w.map((i) => names[i]).join(' & ')} ${w.length > 1 ? 'split' : 'win' + (w[0] === 0 ? '' : 's')} ${formatChips(result.pots.reduce((s, p) => s + p.amount, 0))}${result.pots[0]?.label ? ` · ${result.pots[0].label}` : ''}`
  } else message = `Blinds ${formatChips(v.smallBlind)}/${formatChips(v.bigBlind)}`

  // New board cards deal in one after another (a run-out shows flop, turn and river in turn).
  const boardSeen = useRef({ hand: 0, len: 0 })
  const firstNew = boardSeen.current.hand === v.hand ? boardSeen.current.len : 0
  useEffect(() => {
    boardSeen.current = { hand: v.hand, len: v.board.length }
  }, [v.hand, v.board.length])

  const madeHand = me.hole && me.hole.length === 2 && v.board.length >= 3 && !me.folded ? labelOf(evaluate([...me.hole, ...v.board])) : null
  const sidePots = result ? result.pots.length - 1 : 0

  const seatEl = (i: number) => {
    const s = v.seats[i]!
    const bot = bots[i]!
    const act = actionText(v, i)
    const won = result?.pots.some((p) => p.winners.includes(i))
    const net = result?.net[i] ?? 0
    const status = s.out
      ? null
      : thinking?.seat === i
        ? { text: 'Thinking…', tone: 'dim' as const }
        : result && won
          ? { text: `+${formatChips(net > 0 ? net : 0)}${result.labels[i] ? ` · ${result.labels[i]}` : ''}`, tone: 'win' as const }
          : result && result.shown[i] && result.labels[i]
            ? { text: result.labels[i]!, tone: 'neutral' as const }
            : act
    return (
      <div key={i} className="hd-seat flex min-w-0 flex-col items-center" style={{ gridArea: `s${i}` }}>
        <SeatPlate
          name={bot.profile.name}
          tag={BOT_STYLE_LABEL[bot.profile.style]}
          stack={s.out ? null : s.stack}
          stackLabel={s.out ? 'Out' : undefined}
          timer={thinking?.seat === i ? { ms: thinking.ms, key: `${v.hand}-${v.log.length}` } : null}
          dealer={v.button === i && !s.out}
          dim={s.out || (s.folded && !result)}
          win={!!won}
        >
          <div className="hd-line mt-0.5 flex h-[var(--seat-card-h)] items-center gap-1.5">
            {!s.out && (
              <span className="flex gap-0.5" style={{ '--card-h': 'var(--seat-card-h)' } as CSSProperties}>
                {s.hole
                  ? s.hole.map((c, k) => <PlayingCard key={`${v.hand}-${k}`} rank={c.rank} suit={c.suit} className="g-flip" style={{ '--i': k } as CSSProperties} />)
                  : !s.folded && v.hand > 0
                    ? [0, 1].map((k) => <PlayingCard key={`${v.hand}-b${k}`} variant="back" className="g-deal" style={{ '--i': k + i } as CSSProperties} />)
                    : null}
              </span>
            )}
            <span className="flex min-w-0 flex-col items-start">
              {status && (
                <span
                  className={cn(
                    'num truncate text-[11px] leading-4',
                    status.tone === 'win' && 'text-felt',
                    status.tone === 'gold' && 'text-gold',
                    status.tone === 'dim' && 'text-dim',
                    status.tone === 'neutral' && 'text-soft',
                  )}
                >
                  {status.text}
                </span>
              )}
              {!result && <BetChip amount={s.bet} />}
            </span>
          </div>
        </SeatPlate>
      </div>
    )
  }

  const board = (
    <div className="hd-table" data-seats={table.seats}>
      <div aria-hidden className="hd-oval" />
      {Array.from({ length: table.seats - 1 }, (_, k) => seatEl(k + 1))}

      <div className="hd-centre flex min-w-0 flex-col items-center justify-center gap-1.5" style={{ gridArea: 'c' }}>
        <p className="hd-print felt-print text-center">
          Hand {Math.max(v.hand, 1)} · Blinds {formatChips(v.smallBlind)}/{formatChips(v.bigBlind)}
        </p>
        <div className="flex items-center gap-[clamp(0.2rem,0.8cqw,0.4rem)]" aria-label="Board">
          {Array.from({ length: 5 }, (_, k) => {
            const c = v.board[k]
            return c ? (
              <PlayingCard
                key={`${v.hand}-${cardKey(c)}`}
                rank={c.rank}
                suit={c.suit}
                className="g-deal"
                style={{ '--i': Math.max(0, k - firstNew) } as CSSProperties}
              />
            ) : (
              <PlayingCard key={`slot-${k}`} variant="slot" />
            )
          })}
        </div>
        <p className="num flex h-5 items-center gap-1.5 text-[13px] text-ink" aria-live="polite">
          {v.pot > 0 && !result && (
            <>
              <span className="chip tb-chip" style={{ '--chip': '#b83a50', '--chip-ink': '#f4f1ea' } as CSSProperties} aria-hidden />
              Pot {formatChips(v.pot)}
            </>
          )}
          {result && (
            <span className="g-pop text-gold">
              {formatChips(result.pots.reduce((s, p) => s + p.amount, 0))}
              {sidePots > 0 && <span className="ml-1 text-dim">· {sidePots + 1} pots</span>}
            </span>
          )}
        </p>
      </div>

      <div className="hd-you flex items-center justify-center gap-3" style={{ gridArea: 'y' }}>
        <SeatPlate
          name="You"
          you
          stackCaption="Bankroll"
          stack={me.out ? null : me.stack}
          stackLabel={me.out ? 'Out' : undefined}
          timer={yourTurn ? { ms: TURN_MS, key: `${v.hand}-${v.log.length}` } : null}
          dealer={v.button === 0 && !me.out}
          win={!!result?.pots.some((p) => p.winners.includes(0))}
          status={
            result?.pots.some((p) => p.winners.includes(0)) ? (
              <span className="text-felt">+{formatChips(Math.max(0, result.net[0] ?? 0))}</span>
            ) : (
              actionText(v, 0)?.text
            )
          }
        >
          {!result && <BetChip amount={me.bet} />}
        </SeatPlate>
        <div className={cn('hd-hole flex gap-1', me.folded && !me.out && 'g-dim')} style={{ '--card-h': 'var(--you-card-h)' } as CSSProperties}>
          {me.hole && me.hole.length === 2
            ? me.hole.map((c, k) => (
                <PlayingCard key={`${v.hand}-${cardKey(c)}`} rank={c.rank} suit={c.suit} className={cn('g-deal', result?.pots.some((p) => p.winners.includes(0)) && 'g-win')} style={{ '--i': k } as CSSProperties} />
              ))
            : [0, 1].map((k) => <PlayingCard key={`ys${k}`} variant="slot" />)}
        </div>
        <div className="hd-made flex w-24 flex-col gap-1 text-[11px] leading-4 text-soft">
          <span>{madeHand}</span>
          {equity != null && <span className="w-full" aria-label={`Estimated chance to win or split: ${equity} percent`}>
            <span className="flex justify-between"><span>Win odds</span><span className="num text-ink">{equity}%</span></span>
            <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-black/30"><span className="block h-full rounded-full bg-felt" style={{ width: `${equity}%` }} /></span>
          </span>}
        </div>
      </div>
    </div>
  )

  const dock = (
    <div className={GAME_DOCK_INNER}>
      <div className={cn('flex min-h-12 shrink-0 flex-wrap items-center justify-center gap-1.5 sm:gap-2', !canRaise && 'invisible pointer-events-none')}>
        {!isBet && (
          <button type="button" className={GAME_DOCK_RACK_BTN} onClick={() => setRaiseTo(minTo)}>
            Min
          </button>
        )}
        <button type="button" className={GAME_DOCK_RACK_BTN} onClick={() => setRaiseTo(clampTo(v.currentBet + potAfterCall / 2))}>
          ½ pot
        </button>
        <button type="button" className={GAME_DOCK_RACK_BTN} onClick={() => setRaiseTo(clampTo(v.currentBet + potAfterCall))}>
          Pot
        </button>
        <button
          type="button"
          className={`${GAME_DOCK_RACK_BTN} border-gold text-gold hover:border-gold hover:bg-gold-tint`}
          onClick={() => setRaiseTo(maxTo)}
        >
          All in
        </button>
        <input
          type="range"
          aria-label={isBet ? 'Bet amount' : 'Raise to'}
          className="hd-slider h-11 w-32 sm:w-44"
          min={minTo}
          max={Math.max(maxTo, minTo)}
          step={Math.max(1, Math.round(v.bigBlind / 2))}
          value={Math.min(Math.max(raiseTo, minTo), Math.max(maxTo, minTo))}
          onChange={(e) => setRaiseTo(clampTo(Number(e.target.value)))}
        />
      </div>
      <div className={GAME_DOCK_SETTLED_SLOT}>
        <p className="num text-[13px] text-soft" aria-live="polite">
          {yourTurn ? (
            <>
              {legal?.canCheck ? 'Nothing to call' : <>To call <span className="text-ink">{formatChips(legal?.toCall ?? 0)}</span></>}
              {' · '}Pot <span className="text-ink">{formatChips(v.pot)}</span>
              {secs != null && secs <= 10 && <span className="text-loss"> · {secs}s</span>}
            </>
          ) : me.out ? (
            'You are out'
          ) : (
            <span className="text-dim">{thinker ? `${thinker} is thinking…` : result ? 'Next hand coming up' : 'Waiting…'}</span>
          )}
        </p>
      </div>
      <div className={GAME_DOCK_ACTIONS}>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className={`${GAME_DOCK_SECONDARY_BTN} min-w-[4.75rem] px-4`}
            disabled={!yourTurn}
            onClick={() => runner.act({ type: 'fold' })}
          >
            Fold
          </button>
          <button
            type="button"
            className={`${GAME_DOCK_SECONDARY_BTN} min-w-[6.5rem] px-4`}
            disabled={!yourTurn}
            onClick={() => runner.act(legal?.canCheck ? { type: 'check' } : { type: 'call' })}
          >
            {legal?.canCheck || !yourTurn ? 'Check' : <>Call <span className="num ml-1">{formatChips(legal?.toCall ?? 0)}</span></>}
          </button>
          <button
            type="button"
            className={`${GAME_DOCK_PRIMARY_BTN} min-w-[8.5rem] px-5`}
            disabled={!canRaise}
            onClick={() => runner.act({ type: 'raise', to: clampTo(raiseTo) })}
          >
            {raiseTo >= maxTo && canRaise ? 'All in' : isBet ? 'Bet' : 'Raise to'}
            {canRaise && <span className="num ml-1">{formatChips(clampTo(raiseTo))}</span>}
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
