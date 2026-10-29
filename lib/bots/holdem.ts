import { legalActions, rankSeven } from '@/games/holdem/engine'
import type { Action, View } from '@/games/holdem/types'
import type { BotMind } from './core'
import type { BotProfile } from './core'
import { noiseFor } from './core'

export function decideHoldem(view:View,seat:number,mind:BotMind,profile:BotProfile,rng:()=>number):Action {
  const actions=legalActions({...view,deck:[]} as never,seat)
  const player=view.players[seat]!
  const ranks=player.hole.map(c=>c.rank)
  const pair=ranks.length===2&&ranks[0]===ranks[1]
  const high=ranks.some(r=>['A','K','Q','J'].includes(r))
  const strength=rankSeven([...player.hole,...view.board])[0]??0
  const confidence=Math.min(.96,.2+strength*.08+(pair ? .16 : 0)+(high ? .06 : 0)+profile.aggression*.1+mind.raisesSeen*.01)
  const noise=noiseFor(profile.tier)
  const check=actions.find(a=>a.type==='check')
  let best:Action
  if(check){const raise=actions.find(a=>a.type==='raise');best=raise&&rng()<confidence*profile.aggression?raise:check}
  else {
  const call=actions.find(a=>a.type==='call')
  const fold=actions.find(a=>a.type==='fold')
  const raise=actions.find(a=>a.type==='raise')
  if(raise&&rng()<confidence*profile.aggression)best=raise
  else best=call&&rng()<confidence*(1-profile.tightness*.12)?call:fold??{type:'fold'}
  }
  return rng()<noise ? actions[Math.floor(rng()*actions.length)]! : best!
}
