'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlayingCard } from '@/components/games/playing-card'
import { createRng } from '@/utils/rng'
import { apply, createTable, legalActions, nextHand, startHand, viewFor } from '@/games/holdem/engine'
import { decideHoldem } from '@/lib/bots/holdem'
import { freshBotMind, thinkDelay } from '@/lib/bots/core'
import type { Action } from '@/games/holdem/types'
import { useTablesStore } from '@/store/tables-store'
import { botRoster, tierForBuyIn } from '@/lib/bots/roster'

export function HoldemGame() {
  const router=useRouter()
  const rng=useRef<()=>number>(Math.random)
  const minds=useRef(Array.from({length:6},()=>freshBotMind()))
  const table=useTablesStore(s=>s.holdemTable)
  const setTable=useTablesStore(s=>s.setHoldemTable)
  const reserve=useTablesStore(s=>s.reserve)
  const leave=useTablesStore(s=>s.leave)
  const buyIn=useTablesStore(s=>s.buyIn),settleMini=useTablesStore(s=>s.settleMini)
  useEffect(()=>{if(!table||table.street!=='finished'||table.players.filter(p=>p.stack>0).length>1)return;const place=[...table.finishOrder].reverse().indexOf(0),pool=buyIn*6,payout=place===0?Math.floor(pool*.65):place===1?Math.floor(pool*.35):0;settleMini('holdem',payout)},[table,buyIn,settleMini])
  useEffect(()=>{
    if(!table)return
    const seat=table.currentSeat
    if(seat===null||seat===0||table.street==='finished'||table.street==='showdown')return
    const view=viewFor(table,seat),delay=thinkDelay(rng.current,table.pot>table.bigBlind*8)
    const profile=botRoster(tierForBuyIn(buyIn))[seat-1]!
    const timer=window.setTimeout(()=>setTable(apply(table,seat,decideHoldem(view,seat,minds.current[seat]!,profile,rng.current))),delay)
    return()=>window.clearTimeout(timer)
  },[table,setTable,buyIn])
  if(!table)return <div className="mx-auto max-w-3xl py-12"><h1 className="text-3xl">Texas Hold’em</h1><p className="my-4 text-dim">Join from the Tables lobby to start a buy-in Sit & Go.</p><Button onClick={()=>{rng.current=createRng(Date.now()>>>0);if(reserve('holdem',buyIn))setTable(startHand(createTable(),rng.current))}}>Join table · {buyIn}</Button></div>
  const allowed=table.currentSeat===0?legalActions(table,0):[]
  const act=(a:Action)=>setTable(apply(table,0,a))
  const view=viewFor(table,0)
  const finished=table.players.filter(p=>p.stack>0).length<=1
  const card=(c:typeof table.board[number],i:number)=><PlayingCard key={`${c.rank}${c.suit}${i}`} rank={c.rank} suit={c.suit} height="4.5rem" />
  return <section className="board-fit mx-auto flex min-h-[min(700px,calc(100dvh-9rem))] w-full max-w-5xl flex-col rounded-3xl border border-[#70623f] bg-[#153b31] p-4 text-[#f5eedc] sm:p-6" aria-label="Texas Hold'em table">
    <header className="flex items-center justify-between border-b border-white/15 pb-3"><div><h1 className="font-semibold tracking-wide">TEXAS HOLD’EM</h1><p className="text-xs text-white/65">Sit & Go · hand {table.handNumber} · blinds {table.smallBlind}/{table.bigBlind}</p></div><div className="flex items-center gap-3"><p className="text-sm">Pot {table.pot}</p><Button variant="ghost" onClick={()=>{leave();router.push('/tables')}}>Forfeit buy-in</Button></div></header>
    <div className="flex flex-1 flex-col justify-between gap-4 py-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{table.players.map((p,i)=><article key={p.name} className={`rounded-xl border p-3 text-center ${table.currentSeat===i?'border-[#edc96d]':'border-white/15'}`}><p className="text-sm font-medium">{p.name}{i===table.button?' · BTN':''}</p><p className="font-mono text-xs text-white/70">Stack {p.stack} · bet {p.bet}</p><p className="text-xs text-[#edc96d]">{p.folded?'Folded':p.allIn?'All in':p.lastAction}</p><div className="mt-2 flex justify-center gap-1">{(table.street==='finished'?[]:i===0||table.street==='showdown'?view.players[i]!.hole:[]).map(card)}{table.street!=='finished'&&table.street!=='showdown'&&i!==0&&p.hole.map((_,n)=><PlayingCard key={n} variant="back" height="4.5rem" />)}</div></article>)}</div>
      <div className="text-center"><p className="mb-2 text-xs uppercase tracking-widest text-white/60">{table.street}</p><div className="flex min-h-[5rem] justify-center gap-2">{table.board.map(card)}</div><p className="mt-2 text-sm">{table.message}</p></div>
      <div className="rounded-xl border border-white/15 bg-black/15 p-4 text-center">{table.street==='finished'?<div><p>{table.message}</p>{!finished&&<Button className="mt-3" onClick={()=>setTable(nextHand(table,rng.current))}>Next hand</Button>}{finished&&<Button className="ml-2 mt-3" variant="outline" onClick={()=>{minds.current=Array.from({length:6},()=>freshBotMind());setTable(null);}}>Back to table lobby</Button>}</div>:table.street==='showdown'?<Button onClick={()=>setTable(nextHand(table,rng.current))}>Continue tournament</Button>:table.currentSeat===0?<div className="flex flex-wrap justify-center gap-2">{allowed.map((a,i)=><Button key={`${a.type}-${i}`} variant={a.type==='fold'?'outline':'default'} onClick={()=>act(a)}>{a.type==='raise'?`Raise to ${a.to}`:a.type[0]!.toUpperCase()+a.type.slice(1)}</Button>)}</div>:<p className="text-sm text-[#edc96d]">{table.players[table.currentSeat??0]?.name} is thinking…</p>}</div>
    </div>
  </section>
}
