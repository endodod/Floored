'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** How much the interface moves: follow the OS setting, or force it either way. */
export type MotionPreference = 'system' | 'reduced' | 'full'

interface SettingsStore {
  uiSoundsEnabled: boolean
  setUiSoundsEnabled: (v: boolean) => void
  gameSoundsEnabled: boolean
  setGameSoundsEnabled: (v: boolean) => void
  soundVolume: number
  setSoundVolume: (v: number) => void
  musicEnabled: boolean
  setMusicEnabled: (v: boolean) => void
  musicVolume: number
  setMusicVolume: (v: number) => void
  motion: MotionPreference
  setMotion: (v: MotionPreference) => void
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
      uiSoundsEnabled: true,
      setUiSoundsEnabled: (v) => set({ uiSoundsEnabled: v }),
      gameSoundsEnabled: true,
      setGameSoundsEnabled: (v) => set({ gameSoundsEnabled: v }),
      soundVolume: 0.35,
      setSoundVolume: (v) => set({ soundVolume: Math.max(0, Math.min(1, v)) }),
      musicEnabled: false,
      setMusicEnabled: (v) => set({ musicEnabled: v }),
      musicVolume: 0.16,
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(1, v)) }),
      motion: 'system',
      setMotion: (v) => set({ motion: v }),
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
      version: 2,
      migrate: (persisted: unknown) => {
        const old = (persisted ?? {}) as Record<string, unknown>
        const { soundEnabled: legacySoundEnabled, ...state } = old
        const soundEnabled = typeof legacySoundEnabled === 'boolean' ? legacySoundEnabled : true
        return {
          ...state,
          uiSoundsEnabled: soundEnabled,
          gameSoundsEnabled: soundEnabled,
        } as SettingsStore
      },
    }
  )
)
