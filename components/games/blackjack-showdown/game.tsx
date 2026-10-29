'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlayingCard } from '@/components/games/playing-card'
import { Button } from '@/components/ui/button'
import { decideBlackjack, BLACKJACK_BOTS } from '@/lib/bots/blackjack-showdown'
import { apply, legalActions, viewFor } from '@/games/blackjack-showdown/engine'
import { calculateHandValue } from '@/games/blackjack/engine'
import type { Action, Seat, ShowdownState } from '@/games/blackjack-showdown/types'
import { useTablesStore } from '@/store/tables-store'
import { formatChips } from '@/utils/format'

function Cards({ cards, hidden = false }: { cards: ShowdownState['dealer']; hidden?: boolean }) {
  const shownCards = hidden ? cards.slice(0, 1) : cards
  return <div className="flex justify-center gap-1.5">{shownCards.map((card, i) => <PlayingCard key={`${card.rank}${card.suit}${i}`} rank={card.rank} suit={card.suit} height="clamp(3.4rem, 10cqh, 5.5rem)" />)}{hidden && <PlayingCard variant="back" height="clamp(3.4rem, 10cqh, 5.5rem)" />}</div>
}

export function BlackjackShowdownGame() {
  const router = useRouter()
  const table = useTablesStore(s => s.table)
  const setTable = useTablesStore(s => s.setTable)
  const finish = useTablesStore(s => s.finish)
  const leave = useTablesStore(s => s.leave)
  const buyIn = useTablesStore(s => s.buyIn)
  const [bet, setBet] = useState(100)

  useEffect(() => {
    if (!table || table.phase === 'finished') { if (table?.phase === 'finished') finish(table); return }
    const seat = table.currentSeat
    if (seat === null || seat === 0) return
    const timer = window.setTimeout(() => {
      const profile = BLACKJACK_BOTS[seat - 1]!
      const action = table.phase === 'settled' ? { type: 'next-hand' as const } : decideBlackjack(viewFor(table, seat as Seat), seat as Seat, profile, Math.random)
      const next = apply(table, seat as Seat, action)
      if (next.phase === 'finished') finish(next)
      else setTable(next)
    }, 380)
    return () => window.clearTimeout(timer)
  }, [table, setTable, finish])

  if (!table) return <p className="p-8 text-dim">No table in progress. <Button variant="outline" onClick={() => router.push('/tables')}>Choose a buy-in</Button></p>
  const allowed = table.currentSeat === 0 ? legalActions(table, 0) : []
  const act = (action: Action) => {
    const next = apply(table, 0, action)
    if (next.phase === 'finished') finish(next)
    else setTable(next)
  }
  const ended = table.phase === 'finished'
  return <section className="board-fit felt-print flex min-h-[min(680px,calc(100vh-8rem))] flex-col rounded-3xl border border-[#70623f] bg-[#153b31] p-4 text-[#f5eedc] shadow-[inset_0_0_90px_rgba(0,0,0,.35)] sm:p-6" aria-label="Blackjack Showdown table">
    <header className="flex items-center justify-between gap-3 border-b border-white/15 pb-3 text-sm">
      <div><p className="font-medium">BLACKJACK SHOWDOWN</p><p className="text-xs text-white/65">Hand {Math.min(table.handNumber, 12)} of 12 · buy-in {formatChips(buyIn)} · winner takes all</p></div>
      <Button variant="ghost" onClick={() => { leave(); router.push('/tables') }}>Leave table</Button>
    </header>
    <div className="flex flex-1 flex-col justify-between gap-4 py-4">
      <div className="text-center"><p className="mb-2 text-xs uppercase tracking-[.2em] text-white/65">Dealer</p><Cards cards={table.dealer} hidden={table.phase === 'playing' && table.dealer.length > 1} /><p className="mt-2 text-sm">{table.phase === 'playing' ? 'Hole card face down' : table.dealer.length ? `Total ${calculateHandValue(table.dealer)}` : 'Shared shoe · 6 decks'}</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{table.players.map((player, i) => <article key={player.name} className={`rounded-xl border p-3 text-center ${table.currentSeat === i ? 'border-[#edc96d] bg-black/20' : 'border-white/15 bg-black/10'}`}>
        <div className="flex items-center justify-between text-sm"><strong>{player.name}</strong><span className="font-mono">{formatChips(player.chips)}</span></div>
        <p className="mt-1 text-xs text-white/60">{player.out ? 'Out' : table.phase === 'betting' && player.bet === 0 ? 'Choosing bet' : `Bet ${table.hiddenBets && table.phase === 'betting' && i !== 0 && player.bet ? 'Hidden' : formatChips(player.bet)}`}</p>
        <div className="mt-3 flex min-h-[4.5rem] justify-center gap-1"><Cards cards={player.hand} /></div>
        <p className="mt-2 min-h-4 text-xs text-[#edc96d]">{player.out ? 'Eliminated' : player.busted ? 'Bust' : player.blackjack ? 'Blackjack' : player.stood ? 'Stand' : table.currentSeat === i ? 'Your turn' : ''}</p>
      </article>)}</div>
      <div className="rounded-xl border border-white/15 bg-black/20 p-3 text-center"><p className="text-xs uppercase tracking-widest text-white/60">{table.message}</p><div className="mt-3 flex flex-wrap justify-center gap-2">
        {table.phase === 'betting' && table.currentSeat === 0 && <><label className="sr-only" htmlFor="showdown-bet">Bet amount</label><input id="showdown-bet" type="range" min="10" max={Math.floor(Math.min(500, table.players[0]!.chips) / 10) * 10} step="10" value={Math.min(bet, Math.floor(table.players[0]!.chips / 10) * 10)} onChange={e => setBet(Number(e.target.value))} /><span className="self-center font-mono">{formatChips(Math.min(bet, Math.floor(table.players[0]!.chips / 10) * 10))}</span><Button onClick={() => act({ type: 'bet', amount: Math.min(bet, Math.floor(table.players[0]!.chips / 10) * 10) })}>Place bet</Button></>}
        {table.phase === 'playing' && table.currentSeat === 0 && allowed.filter(a => a.type !== 'bet').map(a => <Button key={a.type} variant={a.type === 'stand' ? 'outline' : 'default'} onClick={() => act(a)}>{a.type === 'double' ? 'Double' : a.type === 'hit' ? 'Hit' : 'Stand'}</Button>)}
        {table.phase === 'settled' && table.currentSeat === 0 && <Button onClick={() => act({ type: 'next-hand' })}>Next hand</Button>}
        {ended && <Button onClick={() => { leave(); router.push('/tables') }}>{table.winner === 0 ? 'Collect prize' : 'Return to Tables'}</Button>}
      </div></div>
    </div>
  </section>
}
