'use client'

import { useEffect } from 'react'
import { useSettingsStore, type MotionPreference } from '@/store/settings-store'
import { SIMPLE_VIEW_ENABLED } from '@/lib/features'

const QUERY = '(prefers-reduced-motion: reduce)'

function resolve(pref: MotionPreference): 'reduced' | 'full' {
  if (pref === 'system') return window.matchMedia(QUERY).matches ? 'reduced' : 'full'
  return pref
}

/**
 * Runs before first paint: reads the saved setting straight from localStorage
 * so a player who chose reduced motion never sees an entrance animation play.
 * It sets <html data-view="simple"> the same way, so Simple view never flashes the full layout.
 */
export const MOTION_BOOT_SCRIPT = `(function(){try{var p='full';var raw=localStorage.getItem('floored-settings');if(raw){var s=JSON.parse(raw);if(s&&s.state&&s.state.motion&&!(s.state.motion==='system'&&(s.version||0)<5))p=s.state.motion${SIMPLE_VIEW_ENABLED ? ";if(s&&s.state&&s.state.simpleView)document.documentElement.setAttribute('data-view','simple')" : ''}}var r=p==='system'?(window.matchMedia('${QUERY}').matches?'reduced':'full'):p;document.documentElement.setAttribute('data-motion',r)}catch(e){}})()`

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

/** Keeps <html data-view> in step with the Simple view setting; the `simple:` Tailwind variant keys off it. */
export function SimpleViewSync() {
  const simpleView = useSettingsStore((s) => s.simpleView)

  useEffect(() => {
    const root = document.documentElement
    if (SIMPLE_VIEW_ENABLED && simpleView) root.setAttribute('data-view', 'simple')
    else root.removeAttribute('data-view')
  }, [simpleView])

  return null
}
