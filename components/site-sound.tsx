'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

const interfaceSamples = [
  '/audio/kenney-casino/Audio/chip-lay-1.ogg',
  '/audio/kenney-casino/Audio/chip-lay-2.ogg',
]
let audio: AudioContext | null = null
let decoded: AudioBuffer[] | null = null
let pending: Promise<AudioBuffer[]> | null = null

function getAudioContext() {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  audio ??= new AudioContextClass()
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined)
  return audio
}

async function loadInterfaceSamples(context: AudioContext) {
  if (decoded) return decoded
  if (pending) return pending
  pending = Promise.all(interfaceSamples.map(async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Audio request failed: ${response.status}`)
    return context.decodeAudioData(await response.arrayBuffer())
  })).then((samples) => {
    decoded = samples
    return samples
  }).finally(() => { pending = null })
  return pending
}

/** Only interface clicks remain audible; legacy game cues are ignored. */
export function playSiteSound(kind: string = 'tap') {
  if (typeof window === 'undefined' || kind !== 'tap') return
  const { uiSoundsEnabled, soundVolume } = useSettingsStore.getState()
  if (!uiSoundsEnabled || soundVolume <= 0) return
  const context = getAudioContext()
  if (!context) return
  void loadInterfaceSamples(context).then((samples) => {
    if (audio !== context || samples.length === 0) return
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = samples[Math.floor(Math.random() * samples.length)]
    source.playbackRate.value = 0.76
    filter.type = 'lowpass'
    filter.frequency.value = 1600
    gain.gain.value = soundVolume * 0.2
    source.connect(filter)
    filter.connect(gain)
    gain.connect(context.destination)
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
    source.start()
  }).catch(() => undefined)
}

// Crash game imports kept as harmless compatibility shims; no game audio is played.
export function startCrashCurveSound() {}
export function updateCrashCurveSound(_multiplier: number) {}
export function stopCrashCurveSound() {}

export function SiteSound() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const control = target.closest('button, a, [role="button"]')
      if (!control) return
      if (control instanceof HTMLButtonElement && (control.disabled || control.getAttribute('aria-disabled') === 'true')) return
      playSiteSound('tap')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}