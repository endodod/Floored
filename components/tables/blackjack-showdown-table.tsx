'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
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
import { calculateHandValue } from '@/games/blackjack/engine'
import type { ShowdownAction, ShowdownState, ShowdownView } from '@/games/blackjack-showdown/types'
import { seatBots } from '@/lib/bots/core'
import { BOT_STYLE_LABEL } from '@/lib/bots/roster'
import { TABLE_GAME_BY_NAME } from '@/lib/tables/catalog'
import { showdownDef } from '@/lib/tables/defs'
import type { OpenTable } from '@/store/tables-store'
import { createRng } from '@/utils/rng'
import { formatChips } from '@/utils/format'
import { cn } from '@/lib/utils'
import { SeatPlate } from './seat'
import { TableShell, useSecondsLeft } from './table-shell'
import { useTableRunner } from './use-table-runner'

const TURN_MS = 30_000
const pause = (s: ShowdownState) => (s.hand === 0 ? 500 : 3200)
const OUTCOME_LABEL = { blackjack: 'Blackjack', win: 'Win', push: 'Push', loss: 'Loss' } as const

function CardFace({ card, hidden = false, style }: { card: ShowdownView['dealer'][number]; hidden?: boolean; style?: CSSProperties }) {
  if (hidden || !card) return <PlayingCard variant="back" className="g-deal" style={style} />
  return <PlayingCard rank={card.rank} suit={card.suit} className="g-deal" style={style} />
}

function handValue(cards: ShowdownView['seats'][number]['cards']) {
  return calculateHandValue(cards)
}

export function ShowdownTable({ table, onPlayAgain }: { table: OpenTable; onPlayAgain: () => void }) {
  const game = TABLE_GAME_BY_NAME.get('blackjack-showdown')!
  const bots = useMemo(() => [null, ...seatBots(table.seats - 1, table.tier, createRng(table.seed ^ 0x51ed))], [table])
  const runner = useTableRunner(showdownDef, { seats: table.seats, human: 0, bots, seed: table.seed, turnMs: TURN_MS, pauseMs: pause })
  const { view: v, yourTurn, thinking } = runner
  const names = useMemo(() => ['You', ...bots.slice(1).map((b) => b!.profile.name)], [bots])
  const secs = useSecondsLeft(runner.deadline)
  const me = v.seats[0]!
  const [bet, setBet] = useState(100)
  const currentResult = v.phase === 'handOver' || v.phase === 'over'

  const [history, setHistory] = useState<MatchHistoryEntry[]>([])
  useEffect(() => {
    if (!currentResult || v.hand === 0) return
    setHistory((items) => {
      if (items[0]?.id === `b${v.hand}`) return items
      const net = me.net
      const outcome = me.outcome
      const entry: MatchHistoryEntry = {
        id: `b${v.hand}`,
        at: new Date(),
        title: `Hand ${v.hand} · ${net > 0 ? '+' : net < 0 ? '−' : ''}${formatChips(Math.abs(net))}`,
        subtitle: outcome ? `${OUTCOME_LABEL[outcome]} · bet ${formatChips(me.bet ?? 0)}` : 'Hand complete',
        tone: net > 0 ? 'win' : net < 0 ? 'loss' : 'neutral',
      }
      return [entry, ...items].slice(0, 40)
    })
  }, [currentResult, v.hand, me.net, me.outcome, me.bet])

  const thinker = thinking ? names[thinking.seat] : null
  let message: string
  if (runner.place != null && !runner.over) message = 'You are out · the table plays on'
  else if (runner.over) message = 'Table over'
  else if (yourTurn && v.phase === 'betting') message = `Your turn · bet ${formatChips(v.legal?.bet?.min ?? v.config.minBet)}–${formatChips(v.legal?.bet?.max ?? v.config.maxBet)}`
  else if (yourTurn) message = 'Your turn · hit, stand, or double'
  else if (thinker) message = `${thinker} is thinking…`
  else if (currentResult && v.hand > 0) message = `Hand ${v.hand} result · ${me.outcome ? OUTCOME_LABEL[me.outcome] : ''}`
  else message = `Hand ${Math.max(1, v.hand)} of ${v.config.hands}`

  const seatEl = (i: number) => {
    const s = v.seats[i]!
    const bot = bots[i]!
    const concealedBet = v.secretBets && i !== 0 && s.hasBet
    const active = v.toAct === i && (v.phase === 'betting' || v.phase === 'playing')
    const won = s.outcome === 'win' || s.outcome === 'blackjack'
    return (
      <div key={i} className="hd-seat flex min-w-0 flex-col items-center" style={{ gridArea: `s${i}` }}>
        <SeatPlate
          name={bot.profile.name}
          tag={BOT_STYLE_LABEL[bot.profile.style]}
          stack={s.out ? null : s.stack}
          stackLabel={s.out ? 'Out' : undefined}
          timer={thinking?.seat === i ? { ms: thinking.ms, key: `${v.hand}-${v.log.length}` } : null}
          dim={s.out}
          win={won && currentResult}
          status={s.out ? 'Eliminated' : s.outcome && currentResult ? `${OUTCOME_LABEL[s.outcome]} · ${s.net > 0 ? '+' : s.net < 0 ? '−' : ''}${formatChips(Math.abs(s.net))}` : active ? 'Acting' : undefined}
          statusTone={s.outcome === 'loss' ? 'loss' : won ? 'win' : active ? 'gold' : 'neutral'}
        >
          <div className="mt-0.5 flex h-[var(--seat-card-h)] items-center gap-1.5">
            {s.cards.map((card, k) => <PlayingCard key={`${v.hand}-${i}-${k}`} rank={card.rank} suit={card.suit} className="g-deal" style={{ '--i': k } as CSSProperties} />)}
            {s.cards.length === 0 && !s.out && [0, 1].map((k) => <PlayingCard key={`slot-${i}-${k}`} variant="slot" />)}
            {s.cards.length > 0 && <span className="num ml-1 text-[11px] text-soft">{handValue(s.cards)}</span>}
          </div>
          <span className="num h-4 text-[10px] leading-4 text-dim">{concealedBet ? 'Bet hidden' : s.bet != null && s.bet > 0 ? `Bet ${formatChips(s.bet)}` : ''}</span>
        </SeatPlate>
      </div>
    )
  }

  const dealerValue = v.dealer.every((card) => card !== null) ? calculateHandValue(v.dealer.filter((card): card is NonNullable<typeof card> => card !== null)) : null
  const board = (
    <div className="hd-table bj-table" data-seats={table.seats}>
      <div aria-hidden className="hd-oval" />
      {Array.from({ length: table.seats - 1 }, (_, k) => seatEl(k + 1))}
      <div className="hd-centre flex min-w-0 flex-col items-center justify-center gap-1.5" style={{ gridArea: 'c' }}>
        <p className="hd-print felt-print text-center">Dealer · shared shoe · Hand {Math.max(1, v.hand)} / {v.config.hands}</p>
        <div className="flex items-center gap-[clamp(0.2rem,0.8cqw,0.4rem)]" aria-label="Dealer cards">
          {v.dealer.map((card, k) => <CardFace key={`${v.hand}-d${k}`} card={card} style={{ '--i': k } as CSSProperties} />)}
          {v.dealer.length === 0 && [0, 1].map((k) => <PlayingCard key={`dealer-slot-${k}`} variant="slot" />)}
        </div>
        <p className="num h-5 text-[12px] text-soft">{dealerValue != null ? `Dealer ${dealerValue}` : v.phase === 'playing' ? 'Hole card face down' : 'Dealer'}</p>
      </div>
      <div className="hd-you flex items-center justify-center gap-3" style={{ gridArea: 'y' }}>
        <SeatPlate
          name="You"
          you
          stackCaption="Bankroll"
          stack={me.out ? null : me.stack}
          stackLabel={me.out ? 'Out' : undefined}
          timer={yourTurn ? { ms: TURN_MS, key: `${v.hand}-${v.log.length}` } : null}
          dim={me.out}
          win={(me.outcome === 'win' || me.outcome === 'blackjack') && currentResult}
          status={me.outcome && currentResult ? `${OUTCOME_LABEL[me.outcome]} · ${me.net > 0 ? '+' : me.net < 0 ? '−' : ''}${formatChips(Math.abs(me.net))}` : undefined}
          statusTone={me.outcome === 'loss' ? 'loss' : me.outcome === 'win' || me.outcome === 'blackjack' ? 'win' : 'neutral'}
        />
        <div className="hd-hole flex gap-1" style={{ '--card-h': 'var(--you-card-h)' } as CSSProperties} aria-label="Your cards">
          {me.cards.map((card, k) => <PlayingCard key={`${v.hand}-you-${k}`} rank={card.rank} suit={card.suit} className="g-deal" style={{ '--i': k } as CSSProperties} />)}
          {me.cards.length === 0 && [0, 1].map((k) => <PlayingCard key={`you-slot-${k}`} variant="slot" />)}
        </div>
        {me.cards.length > 0 && <span className="num hd-made w-10 text-[12px] text-soft">{handValue(me.cards)}</span>}
      </div>
    </div>
  )

  const betMax = v.legal?.bet?.max ?? 0
  const betMin = v.legal?.bet?.min ?? 0
  const betValue = Math.max(betMin, Math.min(betMax, Math.round(bet / 10) * 10))
  const dock = (
    <div className={GAME_DOCK_INNER}>
      <div className={cn('flex min-h-12 items-center justify-center gap-2', !(yourTurn && v.phase === 'betting') && 'invisible pointer-events-none')}>
        <button type="button" className={GAME_DOCK_RACK_BTN} disabled={!betMin} onClick={() => setBet(betMin)}>Min</button>
        <input className="hd-slider h-11 w-28 sm:w-44" type="range" aria-label="Bet amount" min={betMin || 0} max={Math.max(betMax, betMin)} step={10} value={betValue} onChange={(e) => setBet(Number(e.target.value))} />
        <button type="button" className={GAME_DOCK_RACK_BTN} disabled={!betMax} onClick={() => setBet(betMax)}>Max</button>
      </div>
      <div className={GAME_DOCK_SETTLED_SLOT}>
        <p className="num text-[13px] text-soft" aria-live="polite">
          {yourTurn && v.phase === 'betting' ? <>Bet <span className="text-ink">{formatChips(betValue)}</span>{secs != null && secs <= 10 && <span className="text-loss"> · {secs}s</span>}</> :
            yourTurn ? <>Your hand <span className="text-ink">{handValue(me.cards)}</span>{secs != null && secs <= 10 && <span className="text-loss"> · {secs}s</span>}</> :
              me.out ? 'You are out' : thinker ? `${thinker} is thinking…` : currentResult ? 'Next hand coming up' : 'Waiting…'}
        </p>
      </div>
      <div className={GAME_DOCK_ACTIONS}>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={GAME_DOCK_PRIMARY_BTN} disabled={!yourTurn || v.phase !== 'betting'} onClick={() => runner.act({ type: 'bet', amount: betValue })}>
            Bet <span className="num ml-1">{formatChips(betValue)}</span>
          </button>
          <button type="button" className={GAME_DOCK_SECONDARY_BTN} disabled={!yourTurn || v.phase !== 'playing'} onClick={() => runner.act({ type: 'hit' })}>Hit</button>
          <button type="button" className={GAME_DOCK_SECONDARY_BTN} disabled={!yourTurn || v.phase !== 'playing'} onClick={() => runner.act({ type: 'stand' })}>Stand</button>
          <button type="button" className={GAME_DOCK_RACK_BTN} disabled={!yourTurn || v.phase !== 'playing' || !v.legal?.canDouble} onClick={() => runner.act({ type: 'double' } as ShowdownAction)}>Double</button>
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
