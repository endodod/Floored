import type { BotProfile, BotStyle } from './types'

/**
 * The house regulars. Names are invented; each style plays visibly differently.
 * Style labels and notes are for dev tools and the simulation report only: never
 * render a bot's style or skill at a table or in the lobby, it hands the player
 * a read they should earn from play.
 */
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
  p('bea', 'Bea', 'regular', 0.48, 0.48, 0.14, 0.35, 0.12),
  p('cal', 'Cal', 'station', 0.18, 0.22, 0.04, 0.72, 0.58),
  p('cleo', 'Cleo', 'trickster', 0.38, 0.78, 0.52, 0.62, 0.48),
  p('dean', 'Dean', 'rock', 0.92, 0.58, 0.02, 0.18, 0.1),
  p('elle', 'Elle', 'nit', 0.76, 0.42, 0.08, 0.22, 0.08),
  p('frankie', 'Frankie', 'maniac', 0.28, 0.94, 0.48, 0.92, 0.74),
  p('gray', 'Gray', 'regular', 0.66, 0.72, 0.28, 0.48, 0.32),
  p('holly', 'Holly', 'station', 0.36, 0.12, 0.02, 0.44, 0.24),
  p('inez', 'Inez', 'trickster', 0.58, 0.52, 0.46, 0.8, 0.28),
  p('jules', 'Jules', 'rock', 0.72, 0.82, 0.12, 0.4, 0.18),
  p('kai', 'Kai', 'maniac', 0.08, 0.76, 0.3, 0.68, 0.5),
  p('milo', 'Milo', 'nit', 0.86, 0.2, 0.06, 0.32, 0.36),
  p('nell', 'Nell', 'regular', 0.42, 0.64, 0.22, 0.58, 0.44),
  p('oz', 'Oz', 'station', 0.24, 0.38, 0.14, 0.82, 0.66),
  p('paz', 'Paz', 'trickster', 0.32, 0.88, 0.36, 0.9, 0.6),
  p('quinn', 'Quinn', 'regular', 0.7, 0.4, 0.1, 0.28, 0.2),
  p('rhea', 'Rhea', 'rock', 0.88, 0.74, 0.08, 0.24, 0.42),
  p('sol', 'Sol', 'maniac', 0.18, 0.98, 0.58, 0.76, 0.82),
  p('toni', 'Toni', 'nit', 0.8, 0.3, 0.01, 0.12, 0.18),
  p('uma', 'Uma', 'regular', 0.52, 0.58, 0.3, 0.66, 0.22),
  p('wren', 'Wren', 'station', 0.4, 0.28, 0.08, 0.5, 0.4),
]
