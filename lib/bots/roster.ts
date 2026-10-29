import type { BotProfile, BotTier } from './core'

const styles = [
  { name:'Mara', tightness:.25, aggression:.25, bluffRate:.16, risk:.8 },
  { name:'Jax', tightness:.3, aggression:.9, bluffRate:.3, risk:.9 },
  { name:'Sage', tightness:.8, aggression:.65, bluffRate:.08, risk:.35 },
  { name:'Vale', tightness:.55, aggression:.5, bluffRate:.12, risk:.55 },
  { name:'Rook', tightness:.7, aggression:.3, bluffRate:.05, risk:.25 },
]
export function botRoster(tier:BotTier):BotProfile[]{return styles.map(p=>({...p,tier}))}
export function tierForBuyIn(buyIn:number):BotTier{return buyIn>=2000?'Shark':buyIn>=500?'Regular':'Rookie'}
