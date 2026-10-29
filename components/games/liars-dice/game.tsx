'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createRng } from '@/utils/rng'
import { apply, legalActions, nextRound, viewFor } from '@/games/liars-dice/engine'
import { decideLiarsDice } from '@/lib/bots/liars-dice'
import { freshBotMind, thinkDelay } from '@/lib/bots/core'
import type { Action, State } from '@/games/liars-dice/types'
import { useTablesStore } from '@/store/tables-store'
import { botRoster, tierForBuyIn } from '@/lib/bots/roster'

const names = ['You', 'Mara', 'Jax', 'Sage']
const faces = ['⚀','⚁','⚂','⚃','⚄','⚅']

export function LiarsDiceGame() {
  const state = useTablesStore(s=>s.liarsTable)
  const router=useRouter()
  const leave=useTablesStore(s=>s.leave)
  const setState = useTablesStore(s=>s.setLiarsTable)
  const activeGame = useTablesStore(s=>s.activeGame)
  const reserve = useTablesStore(s=>s.reserve)
  const buyIn = useTablesStore(s=>s.buyIn)
  const settleMini = useTablesStore(s=>s.settleMini)
  const [count, setCount] = useState(2)
  const [face, setFace] = useState<1|2|3|4|5|6>(2)
  const rng = useRef<() => number>(Math.random)
  const minds = useRef(names.map(() => freshBotMind()))
  useEffect(() => {
    if(state?.winner!==null&&state?.winner!==undefined){settleMini('liars-dice',state.winner===0?buyIn*4:0);return}
    if (!state || state.reveal || state.seat === 0 || state.winner !== null) return
    const view = viewFor(state, state.seat)
    const delay = thinkDelay(rng.current, Boolean(state.bid))
    const profile=botRoster(tierForBuyIn(buyIn))[state.seat-1]!
    const timer = window.setTimeout(() => setState(apply(state,state.seat,decideLiarsDice(view,minds.current[state.seat]!,profile,rng.current))), delay)
    return () => window.clearTimeout(timer)
  }, [state,buyIn,settleMini])

  const begin = () => { if(activeGame==='liars-dice'||!reserve('liars-dice',buyIn))return; rng.current = createRng(Date.now() >>> 0); minds.current = names.map(() => freshBotMind()) }
  const act = (action: Action) => { if (state) setState(apply(state, 0, action)) }
  const revealNext = () => { if (state) setState(nextRound(state, rng.current)) }
  if (!state) return <div className="mx-auto max-w-3xl py-12"><h1 className="text-3xl">Liar’s Dice</h1><p className="my-4 text-dim">Four players, five dice each. Bid on the total dice showing a face, or call Liar.</p><Button onClick={begin}>Sit at the table</Button></div>

  return <section className="board-fit mx-auto flex min-h-[min(680px,calc(100dvh-9rem))] w-full max-w-4xl flex-col rounded-3xl border border-[#70623f] bg-[#153b31] p-4 text-[#f5eedc] sm:p-6" aria-label="Liar's Dice table">
    <header className="flex items-center justify-between border-b border-white/15 pb-3"><h1 className="font-semibold tracking-wide">LIAR’S DICE</h1><div className="flex items-center gap-3"><span className="text-sm text-white/70">Four seats · five dice</span><Button variant="ghost" onClick={()=>{leave();router.push('/tables')}}>Forfeit buy-in</Button></div></header>
    <div className="grid flex-1 grid-cols-2 gap-3 py-5 sm:grid-cols-4">{names.map((name, i) => <article key={name} className={`rounded-xl border p-3 text-center ${state.seat === i && !state.reveal ? 'border-[#edc96d]' : 'border-white/15'}`}><p className="font-medium">{name}{state.winner === i ? ' · Winner' : ''}</p><p className="mt-1 text-xs text-white/65">{state.active[i] ? `${state.dice[i]!.length} dice` : 'Out'}</p><div className="mt-4 flex min-h-10 flex-wrap justify-center gap-1">{(state.reveal || i === 0 ? state.dice[i]! : []).map((die, n) => <span key={n} className="text-2xl" aria-label={`${die}`}>{faces[die - 1]}</span>)}{!state.reveal && i !== 0 && state.active[i] && <span className="text-white/50">● ● ● ● ●</span>}</div></article>)}</div>
    <div className="rounded-xl border border-white/15 bg-black/15 p-4">
      <p className="text-center text-sm text-white/75">{state.winner !== null ? `${names[state.winner]} wins the table.` : state.reveal ? `${names[state.seat]} called Liar · ${names[state.bid!.seat]} bid ${state.bid!.count} ${state.bid!.face}s` : state.bid ? `${names[state.bid.seat]} bid ${state.bid.count} ${state.bid.face}s` : 'First bid of the round'}</p>
      {state.reveal && state.winner === null && <div className="mt-3 text-center"><p className="text-sm">All cups are open. Matching dice are counted; the loser starts the next round.</p><Button className="mt-3" onClick={revealNext}>Roll next round</Button></div>}
      {!state.reveal && state.winner === null && state.seat === 0 && <div className="mt-4 flex flex-wrap items-center justify-center gap-2"><label>Bid <select className="rounded bg-[#102c24] p-2" value={count} onChange={e => setCount(Number(e.target.value))}>{Array.from({length:30},(_,i)=><option key={i+1}>{i+1}</option>)}</select> dice showing <select className="rounded bg-[#102c24] p-2" value={face} onChange={e => setFace(Number(e.target.value) as typeof face)}>{[1,2,3,4,5,6].map(f=><option key={f} value={f}>{f}</option>)}</select></label><Button disabled={!legalActions(state,0).some(a=>a.type==='bid'&&a.count===count&&a.face===face)} onClick={() => act({type:'bid',count,face})}>Place bid</Button>{state.bid && <Button variant="outline" onClick={() => act({type:'liar'})}>Call Liar</Button>}</div>}
      {!state.reveal && state.winner === null && state.seat !== 0 && <p className="mt-3 text-center text-sm text-[#edc96d]">{names[state.seat]} is thinking…</p>}
      {state.winner !== null && <div className="mt-3 text-center"><Button onClick={begin}>Play again</Button></div>}
    </div>
  </section>
}
