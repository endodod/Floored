import type { Errand, Scene } from '../types'
import { DUSTWATER_ERRANDS, DUSTWATER_SCENES } from './dustwater'

export { CHARACTERS, CHARACTER_BY_ID } from './characters'

/** Every scene and errand, all cities. Add a city's file here as it is written. */
export const SCENES: Scene[] = [...DUSTWATER_SCENES]
export const ERRANDS: Errand[] = [...DUSTWATER_ERRANDS]

export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]))
export const ERRAND_BY_ID = new Map(ERRANDS.map((e) => [e.id, e]))
