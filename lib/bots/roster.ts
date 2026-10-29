import type { BotProfile, BotStyle } from './types'

/** The house regulars. Names are invented; each style plays visibly differently. */
export const BOT_STYLE_LABEL: Record<BotStyle, string> = {
  rock: 'Rock',
  maniac: 'Maniac',
  station: 'Calling station',
  regular: 'Regular',
  trickster: 'Trickster',
  nit: 'Nit',
}

export const BOT_STYLE_NOTE: Record<BotStyle, string> = {
  rock: 'Plays few hands, and plays them hard.',
  maniac: 'Raises anything, bluffs often.',
  station: 'Calls too much, rarely raises.',
  regular: 'Solid and balanced.',
  trickster: 'Loves a bluff and a big swing.',
  nit: 'Tight and careful, folds under pressure.',
}

const p = (
  id: string,
  name: string,
  style: BotStyle,
  tightness: number,
  aggression: number,
  bluff: number,
  risk: number,
  tiltProne: number,
): BotProfile => ({ id, name, style, tightness, aggression, bluff, risk, tiltProne })

export const BOT_ROSTER: BotProfile[] = [
  p('dusty', 'Dusty', 'rock', 0.85, 0.65, 0.05, 0.25, 0.2),
  p('mara', 'Mara', 'regular', 0.6, 0.6, 0.18, 0.5, 0.25),
  p('vic', 'Vic', 'maniac', 0.15, 0.9, 0.45, 0.85, 0.6),
  p('lou', 'Lou', 'station', 0.3, 0.2, 0.06, 0.55, 0.35),
  p('ivy', 'Ivy', 'trickster', 0.45, 0.7, 0.4, 0.7, 0.4),
  p('sal', 'Sal', 'nit', 0.9, 0.35, 0.03, 0.15, 0.15),
  p('nora', 'Nora', 'regular', 0.55, 0.55, 0.2, 0.45, 0.2),
  p('gus', 'Gus', 'station', 0.25, 0.3, 0.1, 0.6, 0.5),
  p('remy', 'Remy', 'maniac', 0.2, 0.85, 0.35, 0.9, 0.7),
  p('tess', 'Tess', 'rock', 0.8, 0.7, 0.1, 0.3, 0.15),
  p('otto', 'Otto', 'nit', 0.95, 0.25, 0.02, 0.1, 0.1),
  p('june', 'June', 'trickster', 0.5, 0.65, 0.33, 0.65, 0.3),
]
