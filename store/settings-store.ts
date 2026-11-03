'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** How much the interface moves: follow the OS setting, or force it either way. */
export type MotionPreference = 'system' | 'reduced' | 'full'

interface SettingsStore {
  motion: MotionPreference
  setMotion: (v: MotionPreference) => void
  /** Simple view: bigger type and buttons, fewer words. Mirrored on <html data-view>. */
  simpleView: boolean
  setSimpleView: (v: boolean) => void
  autoReBet: boolean
  setAutoReBet: (v: boolean) => void
  forceTie: boolean
  setForceTie: (v: boolean) => void
  showAllGames: boolean
  setShowAllGames: (v: boolean) => void
  devModeUnlocked: boolean
  setDevModeUnlocked: (v: boolean) => void
  devInfiniteBets: boolean
  setDevInfiniteBets: (v: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      motion: 'full',
      setMotion: (v) => set({ motion: v }),
      simpleView: false,
      setSimpleView: (v) => set({ simpleView: v }),
      autoReBet: true,
      setAutoReBet: (v) => set({ autoReBet: v }),
      forceTie: false,
      setForceTie: (v) => set({ forceTie: v }),
      showAllGames: false,
      setShowAllGames: (v) => set({ showAllGames: v }),
      devModeUnlocked: false,
      setDevModeUnlocked: (v) => set({ devModeUnlocked: v }),
      devInfiniteBets: false,
      setDevInfiniteBets: (v) => set({ devInfiniteBets: v }),
    }),
    {
      name: 'floored-settings',
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        const state = { ...((persisted ?? {}) as Record<string, unknown>) }
        for (const key of ['soundEnabled', 'uiSoundsEnabled', 'soundVolume', 'gameSoundsEnabled', 'musicEnabled', 'musicVolume']) {
          delete state[key]
        }
        // v5: full motion became the default; move players still on the old 'system' default over.
        if (version < 5 && state.motion === 'system') state.motion = 'full'
        return state as unknown as SettingsStore
      },
    }
  )
)