'use client'

import { useEffect } from 'react'
import { useSettingsStore, type MotionPreference } from '@/store/settings-store'

const QUERY = '(prefers-reduced-motion: reduce)'

function resolve(pref: MotionPreference): 'reduced' | 'full' {
  if (pref === 'system') return window.matchMedia(QUERY).matches ? 'reduced' : 'full'
  return pref
}

/**
 * Runs before first paint: reads the saved setting straight from localStorage
 * so a player who chose reduced motion never sees an entrance animation play.
 */
export const MOTION_BOOT_SCRIPT = `(function(){try{var p='system';var raw=localStorage.getItem('floored-settings');if(raw){var s=JSON.parse(raw);if(s&&s.state&&s.state.motion)p=s.state.motion}var r=p==='system'?(window.matchMedia('${QUERY}').matches?'reduced':'full'):p;document.documentElement.setAttribute('data-motion',r)}catch(e){}})()`

/** Keeps <html data-motion> in step with the setting and, on "system", with the OS preference. */
export function MotionPreferenceSync() {
  const motion = useSettingsStore((s) => s.motion)

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-motion', resolve(motion))
    apply()
    if (motion !== 'system') return
    const mql = window.matchMedia(QUERY)
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [motion])

  return null
}
