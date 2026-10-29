'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

type SoundKind = 'tap' | 'chip' | 'deal' | 'win' | 'loss'

let audio: AudioContext | null = null

/** Short synthesized UI cues keep the app self-contained and need no downloaded assets. */
export function playSiteSound(kind: SoundKind = 'tap') {
  if (typeof window === 'undefined') return
  const { soundEnabled, soundVolume } = useSettingsStore.getState()
  if (!soundEnabled || soundVolume <= 0) return

  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    audio ??= new AudioContextClass()
    if (audio.state === 'suspended') void audio.resume()

    const now = audio.currentTime
    const notes: Record<SoundKind, [number, number, number]> = {
      tap: [520, 0.035, 0.035],
      chip: [760, 0.055, 0.055],
      deal: [390, 0.09, 0.05],
      win: [660, 0.24, 0.075],
      loss: [180, 0.2, 0.065],
    }
    const [frequency, duration, gain] = notes[kind]
    const oscillator = audio.createOscillator()
    const envelope = audio.createGain()
    oscillator.type = kind === 'loss' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, now)
    if (kind === 'win') oscillator.frequency.exponentialRampToValueAtTime(990, now + duration)
    if (kind === 'loss') oscillator.frequency.exponentialRampToValueAtTime(110, now + duration)
    envelope.gain.setValueAtTime(gain * soundVolume, now)
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(envelope)
    envelope.connect(audio.destination)
    oscillator.start(now)
    oscillator.stop(now + duration)
  } catch {
    // Audio is an enhancement; autoplay/device restrictions should never affect gameplay.
  }
}

function kindFor(target: HTMLElement): SoundKind {
  const explicit = target.closest<HTMLElement>('[data-sound]')?.dataset.sound
  if (explicit === 'chip' || explicit === 'deal' || explicit === 'win' || explicit === 'loss') return explicit
  if (target.closest('[data-sound="silent"]')) return 'tap'
  const button = target.closest<HTMLElement>('button, a, [role="button"]')
  if (!button) return 'tap'
  const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase()
  if (/chip|bet|raise|call|check|fold|bid|dice|pick|tile|cup|hit|stand|double|spin|deal|draw|drop|roll|flip|cash out|next/.test(label)) return 'deal'
  return 'tap'
}

/** One delegated listener covers shared UI, all game boards and Tables interactions. */
export function SiteSound() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.closest('[data-sound="silent"]')) return
      const control = target.closest('button, a, [role="button"]')
      if (control instanceof HTMLButtonElement && (control.disabled || control.getAttribute('aria-disabled') === 'true')) return
      if (control) playSiteSound(kindFor(target))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
