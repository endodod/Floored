import type { CityId } from './cities'

/**
 * The story hub's city scenes: one drawn night street per city, built from
 * pieces (casino, motel, truck wash...) placed per layout. The art is drawn in
 * code by components/story/scene-art.tsx; this module only holds the numbers:
 * the palette, where each piece stands and where each hotspot sits.
 *
 * Two layouts: `wide` (landscape, a 1600 × 900 street) and `tall` (portrait
 * phones, a 600 × 1000 street seen deeper). A city gets its own scene by adding
 * a config to SCENES; any other city falls back to a generic night street with
 * its name on the casino sign.
 */

export type SceneLayout = 'wide' | 'tall'

export interface ScenePalette {
  skyTop: string
  skyMid: string
  haze: string
  mesa: string
  mesaFar: string
  wall: string
  wallLit: string
  trim: string
  roof: string
  window: string
  windowDim: string
  lot: string
  road: string
  roadLine: string
  curb: string
  lamp: string
  /** Neon colours: the casino sign, the motel sign, the bar, the vacancy light, the road sign. */
  neonSign: string
  neonMotel: string
  neonBar: string
  neonVacancy: string
  neonDead: string
  roadSign: string
  wash: string
  felt: string
  shade: string
}

/** Dustwater: desert dust over a sodium-lit truck stop. */
export const DUSTWATER_PALETTE: ScenePalette = {
  skyTop: '#05060b',
  skyMid: '#0d1220',
  haze: '#3a2224',
  mesa: '#120e12',
  mesaFar: '#1b1419',
  wall: '#19161a',
  wallLit: '#2a2326',
  trim: '#3a3033',
  roof: '#0f0d10',
  window: '#f2c06b',
  windowDim: '#3b2f25',
  lot: '#141210',
  road: '#0c0d0f',
  roadLine: '#c9a85a',
  curb: '#2a2522',
  lamp: '#ffc47a',
  neonSign: '#ff4d5e',
  neonMotel: '#ff7ab0',
  neonBar: '#ff9a3d',
  neonVacancy: '#5fe3a1',
  neonDead: '#3a2a2e',
  roadSign: '#1f5a43',
  wash: '#5cc8ff',
  felt: '#2a7a57',
  shade: '#000000',
}

/** Other cities, until they get their own art: a cooler, generic night street. */
export const GENERIC_PALETTE: ScenePalette = {
  ...DUSTWATER_PALETTE,
  skyMid: '#0f1526',
  haze: '#1f2a3a',
  mesa: '#0f1118',
  mesaFar: '#151a24',
  wall: '#161820',
  wallLit: '#22252f',
  trim: '#30333e',
  neonSign: '#ffcf6b',
}

export type PieceKind =
  | 'gas'
  | 'motel'
  | 'motelSign'
  | 'truckWash'
  | 'cups'
  | 'casino'
  | 'backroom'
  | 'lamp'
  | 'car'
  | 'roadSign'
  | 'block'
  | 'truck'

/** Where a piece stands in one layout: top-left corner and scale, in that layout's view units. */
export interface Place {
  x: number
  y: number
  s: number
}

export interface ScenePiece {
  id: string
  kind: PieceKind
  wide?: Place
  tall?: Place
  /** Generic blocks: size in local units and a seed for the lit windows. */
  w?: number
  h?: number
  seed?: number
  /** Drawn on top of the people (a foreground piece). */
  front?: boolean
}

/** Each piece's local size (ground at the bottom edge) and its named anchor points. */
export const PIECE_SIZE: Record<PieceKind, { w: number; h: number }> = {
  gas: { w: 400, h: 280 },
  motel: { w: 460, h: 260 },
  motelSign: { w: 140, h: 420 },
  truckWash: { w: 340, h: 210 },
  cups: { w: 90, h: 60 },
  casino: { w: 650, h: 420 },
  backroom: { w: 170, h: 200 },
  lamp: { w: 60, h: 300 },
  car: { w: 170, h: 64 },
  roadSign: { w: 150, h: 220 },
  block: { w: 200, h: 300 },
  truck: { w: 300, h: 120 },
}

export const PIECE_ANCHORS: Partial<Record<PieceKind, Record<string, [number, number]>>> = {
  casino: { dive: [100, 368], main: [380, 362], high: [500, 202], sign: [310, 72] },
  backroom: { door: [85, 188] },
  motel: { diner: [70, 200], room: [375, 222], building: [230, 152] },
  motelSign: { sign: [70, 96] },
  cups: { stand: [45, -6] },
  car: { car: [85, 30] },
  roadSign: { sign: [75, 44] },
}

/** A hotspot: a piece's anchor, or a fixed point per layout. */
export type SpotRef = { piece: string; anchor: string } | { at: Record<SceneLayout, [number, number]> }

export interface SceneView {
  /** The view box: top edge, width and height (the art runs past all four edges). */
  y0: number
  w: number
  h: number
  /** Where the desert meets the sky, the lot ends and the road begins. */
  horizon: number
  road: number
}

export interface CitySceneConfig {
  palette: ScenePalette
  view: Record<SceneLayout, SceneView>
  /** The casino's sign; `dead` letters (by index, spaces count) are dark, `flicker` is the dying one. */
  sign: { text: string; dead: number[]; flicker?: number }
  motelName: string
  /** The diner/bar neon on the motel's corner. */
  barName: string
  pieces: ScenePiece[]
  /**
   * Hotspots by id: `dive`, `main`, `high`, `rest`, `car`, `road`, `notary`, `boss`,
   * character ids, and `p0`–`p3` for people a city has no named spot for.
   */
  spots: Record<string, SpotRef>
}

const VIEW: Record<SceneLayout, SceneView> = {
  wide: { y0: 110, w: 1600, h: 790, horizon: 600, road: 770 },
  tall: { y0: 0, w: 600, h: 1060, horizon: 540, road: 935 },
}

export const DUSTWATER_SCENE: CitySceneConfig = {
  palette: DUSTWATER_PALETTE,
  view: VIEW,
  // OPEN 24 HRS: three of the letters work (the arrival scene says so).
  sign: { text: 'OPEN 24 HRS', dead: [1, 2, 5, 9, 10], flicker: 8 },
  motelName: 'STARLITE',
  barName: 'DINER',
  pieces: [
    { id: 'gas', kind: 'gas', wide: { x: 1300, y: 448, s: 0.75 }, tall: { x: 420, y: 534, s: 0.45 } },
    { id: 'truck', kind: 'truck', wide: { x: 1405, y: 590, s: 0.7 }, tall: { x: 470, y: 640, s: 0.45 } },
    { id: 'motelSign', kind: 'motelSign', wide: { x: 5, y: 278, s: 0.9 }, tall: { x: 232, y: 652, s: 0.45 } },
    { id: 'casino', kind: 'casino', wide: { x: 740, y: 300, s: 0.8 }, tall: { x: 38, y: 190, s: 0.8 } },
    { id: 'backroom', kind: 'backroom', wide: { x: 1210, y: 494, s: 0.74 }, tall: { x: 325, y: 552, s: 0.7 } },
    { id: 'road', kind: 'roadSign', wide: { x: 1465, y: 606, s: 0.78 }, tall: { x: 480, y: 600, s: 0.5 } },
    { id: 'lamp2', kind: 'lamp', wide: { x: 860, y: 476, s: 1 }, tall: { x: -60, y: 640, s: 0.95 } },
    { id: 'wash', kind: 'truckWash', wide: { x: 510, y: 540, s: 0.8 }, tall: { x: -50, y: 762, s: 0.76 } },
    { id: 'motel', kind: 'motel', wide: { x: 70, y: 430, s: 0.92 }, tall: { x: 290, y: 760, s: 0.6 } },
    { id: 'lamp1', kind: 'lamp', wide: { x: 445, y: 476, s: 1 }, tall: { x: 180, y: 648, s: 0.95 } },
    { id: 'cups', kind: 'cups', wide: { x: 610, y: 690, s: 1 }, tall: { x: 124, y: 864, s: 0.9 } },
    { id: 'car', kind: 'car', wide: { x: 180, y: 708, s: 1 }, tall: { x: 384, y: 946, s: 0.75 }, front: true },
  ],
  spots: {
    dive: { piece: 'casino', anchor: 'dive' },
    main: { piece: 'casino', anchor: 'main' },
    high: { piece: 'casino', anchor: 'high' },
    marta: { piece: 'motel', anchor: 'diner' },
    pike: { piece: 'cups', anchor: 'stand' },
    cutter: { piece: 'backroom', anchor: 'door' },
    boss: { piece: 'backroom', anchor: 'door' },
    // The whole motel is the hit area (people standing on it sit above); the Room 5 label sits on top.
    rest: { piece: 'motel', anchor: 'building' },
    car: { piece: 'car', anchor: 'car' },
    jo: { at: { wide: [410, 712], tall: [545, 958] } },
    road: { piece: 'road', anchor: 'sign' },
    notary: { at: { wide: [500, 708], tall: [372, 690] } },
    p0: { piece: 'motel', anchor: 'diner' },
    p1: { piece: 'cups', anchor: 'stand' },
    p2: { at: { wide: [80, 720], tall: [120, 1000] } },
    p3: { at: { wide: [1090, 730], tall: [330, 1010] } },
  },
}

/** The fallback street: generic blocks either side, the casino with the city's name on it. */
export function genericScene(cityName: string): CitySceneConfig {
  return {
    ...DUSTWATER_SCENE,
    palette: GENERIC_PALETTE,
    sign: { text: cityName.toUpperCase(), dead: [] },
    motelName: 'MOTEL',
    barName: 'BAR',
    pieces: [
      { id: 'b1', kind: 'block', w: 220, h: 420, seed: 3, wide: { x: -20, y: 250, s: 0.9 }, tall: { x: -150, y: 300, s: 0.7 } },
      { id: 'b2', kind: 'block', w: 180, h: 330, seed: 7, wide: { x: 170, y: 330, s: 0.9 }, tall: { x: -10, y: 380, s: 0.6 } },
      { id: 'b3', kind: 'block', w: 200, h: 360, seed: 11, wide: { x: 760, y: 300, s: 0.85 }, tall: { x: 470, y: 330, s: 0.6 } },
      ...DUSTWATER_SCENE.pieces.filter((p) => p.kind !== 'gas' && p.kind !== 'truck' && p.kind !== 'truckWash'),
    ],
  }
}

export const SCENES: Partial<Record<CityId, CitySceneConfig>> = {
  dustwater: DUSTWATER_SCENE,
}

export function sceneConfigFor(city: CityId, cityName: string): CitySceneConfig {
  return SCENES[city] ?? genericScene(cityName)
}

/** A hotspot's point in the layout's view units, or null if the scene has no such spot or piece. */
export function spotPoint(config: CitySceneConfig, layout: SceneLayout, spot: string): [number, number] | null {
  const ref = config.spots[spot]
  if (!ref) return null
  if ('at' in ref) return ref.at[layout]
  const piece = config.pieces.find((p) => p.id === ref.piece)
  const place = piece?.[layout]
  const anchor = piece && PIECE_ANCHORS[piece.kind]?.[ref.anchor]
  if (!place || !anchor) return null
  return [place.x + anchor[0] * place.s, place.y + anchor[1] * place.s]
}

/** The scale of the piece a hotspot sits on (1 for fixed points), so hit areas match the art. */
export function spotScale(config: CitySceneConfig, layout: SceneLayout, spot: string): number {
  const ref = config.spots[spot]
  if (!ref || 'at' in ref) return layout === 'tall' ? 0.7 : 1
  return config.pieces.find((p) => p.id === ref.piece)?.[layout]?.s ?? 1
}

/**
 * The hub's own palette (wood, paper, brass) for plates, slips and the night card.
 * Kept here so the story screens share one set instead of hex in every file.
 */
export const STORY_UI = {
  wood: 'linear-gradient(#5a3b22, #3a2617 45%, #22160d)',
  goldTrim: 'inset 0 0 0 1px rgba(217,164,65,0.55)',
  drop: '0 18px 36px -12px rgba(0,0,0,0.75)',
  paper: '#efe6d2',
  paperShade: '#d9ccb0',
  paperInk: '#2a2420',
  paperDim: '#6f6354',
  matchRed: '#8f2633',
  brass: 'linear-gradient(180deg,#f2d48f,#d9a441 45%,#8a6224)',
} as const
