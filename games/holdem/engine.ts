import type { Action, Card, Player, State, View } from './types'

const suits: Card['suit'][] = ['♠','♥','♦','♣']
const ranks: Card['rank'][] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const rv = (r: Card['rank']) => ranks.indexOf(r) + 2
function shuffled(rng: () => number): Card[] {
  const d = suits.flatMap(suit => ranks.map(rank => ({suit,rank})))
  for(let i=d.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[d[i],d[j]]=[d[j]!,d[i]!]}
  return d
}
function nextLive(players: Player[], from: number, canAct = false): number|null {
  for(let step=1;step<=players.length;step++){const i=(from+step)%players.length;const p=players[i]!;if(!p.folded&&p.stack>0&&(!canAct||!p.allIn))return i}
  return null
}

export function createTable(names: string[] = ['You','Mara','Jax','Sage','Vale','Rook']): State {
  const players = names.slice(0,6).map(name=>({name,stack:1500,hole:[],folded:false,allIn:false,bet:0,committed:0,lastAction:''}))
  return {players,deck:[],board:[],button:players.length-1,currentSeat:null,street:'finished',handNumber:0,smallBlind:10,bigBlind:20,currentBet:0,minRaise:20,pot:0,message:'Sit & Go · 1,500 chips each',payouts:players.map(()=>0),acted:[],finishOrder:[]}
}

export function startHand(state: State, rng: () => number): State {
  if(state.street!=='finished'||state.players.filter(p=>p.stack>0).length<2)return state
  const handNumber=state.handNumber+1
  const schedule:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[[10,20],[15,30],[25,50],[50,100],[100,200]]
  const [smallBlind,bigBlind]=schedule[Math.min(Math.floor((handNumber-1)/10),schedule.length-1)]!
  const button=nextLive(state.players,state.button) ?? 0
  const players:Player[]=state.players.map(p=>({...p,hole:[],folded:p.stack===0,allIn:false,bet:0,committed:0,lastAction:''}))
  const deck=shuffled(rng)
  for(let n=0;n<2;n++)for(let step=1;step<=players.length;step++){const i=(button+step)%players.length;if(!players[i]!.folded)players[i]!.hole.push(deck.pop()!)}
  const sb=nextLive(players,button)!,bb=nextLive(players,sb)!
  const post=(i:number,amt:number)=>{const p=players[i]!;const v=Math.min(p.stack,amt);p.stack-=v;p.bet+=v;p.committed+=v;p.allIn=p.stack===0}
  post(sb,smallBlind);post(bb,bigBlind)
  const currentSeat=nextLive(players,bb,true)
  const partial:State={...state,players,deck,board:[],button,currentSeat,street:'preflop',handNumber,smallBlind,bigBlind,currentBet:Math.max(players[sb]!.bet,players[bb]!.bet),minRaise:bigBlind,pot:players.reduce((n,p)=>n+p.committed,0),message:`Blinds ${smallBlind}/${bigBlind}`,payouts:players.map(()=>0),acted:[],finishOrder:[...state.finishOrder]}
  return currentSeat===null?runout(partial):partial
}

export function viewFor(state:State,seat:number):View {
  const {deck,...pub}=state
  return {...pub,self:seat,players:state.players.map((p,i)=>({...p,hole:state.street==='finished'||i===seat||state.street==='showdown'?[...p.hole]:[]}))}
}

export function legalActions(state:State,seat:number):Action[] {
  if(state.currentSeat!==seat||state.street==='finished'||state.street==='showdown')return []
  const p=state.players[seat]!,toCall=state.currentBet-p.bet
  const actions:Action[]=[{type:'fold'}]
  if(toCall===0)actions.push({type:'check'});else actions.push({type:'call'})
  const maxTo=p.bet+p.stack
  if(maxTo>state.currentBet&&p.stack>0){
    const toCall=Math.max(0,state.currentBet-p.bet)
    const targets=[state.currentBet+Math.max(state.minRaise,state.bigBlind),state.currentBet+Math.max(state.bigBlind,Math.floor((state.pot+toCall)/2)),state.currentBet+Math.max(state.bigBlind,state.pot+toCall),maxTo]
    for(const target of [...new Set(targets)].map(n=>Math.min(maxTo,n)).filter(n=>n>state.currentBet))actions.push({type:'raise',to:target})
  }
  return actions
}

export function apply(state:State,seat:number,action:Action):State {
  if(!legalActions(state,seat).some(a=>a.type===action.type&&(!('to'in a)||'to'in action&&a.to===action.to)))throw new Error('Illegal action')
  const players=state.players.map(p=>({...p,hole:[...p.hole]})),p=players[seat]!
  let currentBet=state.currentBet,minRaise=state.minRaise,acted=[...state.acted],message=''
  if(action.type==='fold'){p.folded=true;p.lastAction='Fold';acted.push(seat);message=`${p.name} folds`}
  if(action.type==='check'){p.lastAction='Check';acted.push(seat);message=`${p.name} checks`}
  if(action.type==='call'){const v=Math.min(p.stack,currentBet-p.bet);p.stack-=v;p.bet+=v;p.committed+=v;p.allIn=p.stack===0;p.lastAction=p.allIn?'All in':'Call';acted.push(seat);message=`${p.name} ${p.lastAction.toLowerCase()}`}
  if(action.type==='raise'){const target=Math.min(action.to,p.bet+p.stack),increment=target-currentBet;const v=target-p.bet;p.stack-=v;p.bet+=v;p.committed+=v;p.allIn=p.stack===0;minRaise=Math.max(minRaise,increment);currentBet=target;p.lastAction=p.allIn?'All in':`Raise ${target}`;acted=[seat];message=`${p.name} raises to ${target}`}
  const pot=players.reduce((n,x)=>n+x.committed,0)
  if(players.filter(x=>!x.folded).length===1)return awardUncontested({...state,players,pot,currentBet,minRaise,acted,message})
  const canAct=players.map((x,i)=>({x,i})).filter(({x})=>!x.folded&&!x.allIn)
  let pending: {x:Player;i:number}|undefined
  for(let step=1;step<=players.length;step++){const i=(seat+step)%players.length,x=players[i]!;if(!x.folded&&!x.allIn&&(!acted.includes(i)||x.bet<currentBet)){pending={x,i};break}}
  if(pending)return {...state,players,pot,currentBet,minRaise,acted,currentSeat:pending.i,message}
  if(canAct.some(({x})=>x.bet<currentBet))return {...state,players,pot,currentBet,minRaise,acted,currentSeat:nextLive(players,seat,true),message}
  return advance({...state,players,pot,currentBet,minRaise,acted,message})
}

function advance(s:State):State {
  if(s.street==='river')return showdown(s)
  const deck=[...s.deck],board=[...s.board]
  if(s.street==='preflop'){deck.pop();board.push(deck.pop()!,deck.pop()!,deck.pop()!)}
  else {deck.pop();board.push(deck.pop()!)}
  const street=s.street==='preflop'?'flop':s.street==='flop'?'turn':'river'
  const players=s.players.map(p=>({...p,bet:0}))
  const eligible=players.filter(p=>!p.folded&&!p.allIn)
  if(eligible.length<2)return runout({...s,deck,board,players,street,currentBet:0,acted:[]})
  return {...s,deck,board,players,street,currentBet:0,acted:[],currentSeat:nextLive(players,s.button,true),message:`${street[0]!.toUpperCase()+street.slice(1)} dealt`}
}

function runout(s:State):State {
  let {deck,board}=s
  deck=[...deck];board=[...board]
  while(board.length<5){deck.pop();board.push(deck.pop()!)}
  return showdown({...s,deck,board,street:'showdown',currentSeat:null})
}
function awardUncontested(s:State):State {
  const w=s.players.findIndex(p=>!p.folded),players=s.players.map((p,i)=>({...p,stack:p.stack+(i===w?s.pot:0),committed:0,bet:0}))
  return finishHand({...s,players,pot:0,message:`${players[w]!.name} wins uncontested`})
}
function showdown(s:State):State {
  const players=s.players.map(p=>({...p})),payouts=Array(players.length).fill(0)
  const levels=[...new Set(players.map(p=>p.committed).filter(n=>n>0))].sort((a,b)=>a-b);let prior=0
  for(const level of levels){const contributors=players.filter(p=>p.committed>=level),amount=(level-prior)*contributors.length,eligible=contributors.map((p,i)=>players.indexOf(p)).filter(i=>!players[i]!.folded);prior=level;if(!eligible.length)continue
    const best=eligible.map(i=>({i,score:rankSeven([...players[i]!.hole,...s.board])})).sort((a,b)=>compareScore(b.score,a.score))[0]!.score
    const winners=eligible.filter(i=>compareScore(rankSeven([...players[i]!.hole,...s.board]),best)===0).sort((a,b)=>(a-s.button+players.length)%players.length-(b-s.button+players.length)%players.length)
    const share=Math.floor(amount/winners.length),remainder=amount-share*winners.length
    for(let wi=0;wi<winners.length;wi++)payouts[winners[wi]!]!+=share+(wi<remainder?1:0)
  }
  for(let i=0;i<players.length;i++)players[i]!.stack+=payouts[i]!
  return finishHand({...s,players,payouts,pot:0,message:'Showdown · pot awarded'})
}
function finishHand(s:State):State {
  const alive=s.players.filter(p=>p.stack>0),finished=alive.length<=1
  const busted=s.players.map((p,i)=>({p,i})).filter(({p,i})=>p.stack===0&&!s.finishOrder.includes(i)).sort((a,b)=>a.p.committed-b.p.committed).map(x=>x.i)
  const finishOrder=[...s.finishOrder,...busted,...(finished&&alive.length===1?[s.players.indexOf(alive[0]!)]:[])]
  return {...s,players:s.players.map(p=>({...p,bet:0,committed:0,folded:false,allIn:false,lastAction:p.stack===0?'Busted':p.lastAction})),street:'finished',currentSeat:null,handNumber:s.handNumber,pot:0,finishOrder,message:finished?`${alive[0]?.name??'No player'} wins the Sit & Go`:`${s.message} · next hand`,acted:[]}
}

const combinations=(cards:Card[],n=5):Card[][]=>cards.length===n?[cards]:cards.length<n?[]:cards.flatMap((c,i)=>combinations(cards.slice(i+1),n-1).map(rest=>[c,...rest]))
function scoreFive(cards:Card[]):number[]{const vals=cards.map(c=>rv(c.rank)).sort((a,b)=>b-a),counts=new Map<number,number>();for(const v of vals)counts.set(v,(counts.get(v)??0)+1);const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),flush=cards.every(c=>c.suit===cards[0]!.suit),unique=[...new Set(vals)],straight=unique.length===5&&((unique[0]! - unique[4]!) === 4||unique.join(',')==='14,5,4,3,2'),high=unique.join(',')==='14,5,4,3,2'?5:unique[0]!
 if(flush&&straight)return [8,high];if(groups[0]![1]===4)return [7,groups[0]![0],groups[1]![0]];if(groups[0]![1]===3&&groups[1]![1]===2)return [6,groups[0]![0],groups[1]![0]];if(flush)return [5,...vals];if(straight)return [4,high];if(groups[0]![1]===3)return [3,groups[0]![0],...groups.slice(1).map(x=>x[0])];if(groups[0]![1]===2&&groups[1]![1]===2)return [2,Math.max(groups[0]![0],groups[1]![0]),Math.min(groups[0]![0],groups[1]![0]),groups[2]![0]];if(groups[0]![1]===2)return [1,groups[0]![0],...groups.slice(1).map(x=>x[0])];return [0,...vals]}
export function rankSeven(cards:Card[]):number[]{return combinations(cards).map(scoreFive).sort(compareScore).at(-1)??[0]}
function compareScore(a:number[],b:number[]):number{for(let i=0;i<Math.max(a.length,b.length);i++){const d=(a[i]??0)-(b[i]??0);if(d)return d}return 0}
export function nextHand(state:State,rng:()=>number):State {return startHand(state,rng)}
export const pokerRules={startingStack:1500,prizeSplit:[0.65,0.35] as const,seatCount:6}
