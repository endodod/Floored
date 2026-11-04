import type { Scene, WrittenJob } from '../types'
import { DUSTWATER_JOBS, DUSTWATER_SCENES } from './dustwater'

export { CHARACTERS, CHARACTER_BY_ID } from './characters'

/** Every scene and written job, all cities. Add a city's file here as it is written. */
export const SCENES: Scene[] = [...DUSTWATER_SCENES]
export const WRITTEN_JOBS: WrittenJob[] = [...DUSTWATER_JOBS]

export const SCENE_BY_ID = new Map(SCENES.map((s) => [s.id, s]))
