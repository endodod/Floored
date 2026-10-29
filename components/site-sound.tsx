'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

type SoundKind =
  | 'tap' | 'chip' | 'deal' | 'card' | 'dice' | 'wheel' | 'spin' | 'win' | 'loss'
  | 'case' | 'case-tick' | 'mine-safe' | 'mine-hit' | 'keno-pick' | 'keno-ball'
  | 'tower-safe' | 'tower-hit' | 'crash-rise' | 'crash-hit' | 'coin' | 'ball'
  | 'step-safe' | 'step-hit' | 'race' | 'cashout' | 'cups'

let audio: AudioContext | null = null
let musicGain: GainNode | null = null
let musicMotionGain: GainNode | null = null
let musicStarted = false
let musicStepTimer: ReturnType<typeof setInterval> | null = null
let musicStep = 0
let crashOscillator: OscillatorNode | null = null
let crashFilter: BiquadFilterNode | null = null
let crashEnvelope: GainNode | null = null

function getAudioContext() {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  audio ??= new AudioContextClass()
  if (audio.state === 'suspended') void audio.resume()
  return audio
}

function syncMusic() {
  const { musicEnabled, musicVolume } = useSettingsStore.getState()
  if (!audio && !musicEnabled) return
  const context = getAudioContext()
  if (!context) return
  if (!musicStarted) {
    musicStarted = true
    musicGain = context.createGain()
    musicGain.gain.value = 0
    musicGain.connect(context.destination)
    // A quiet, warm sustained chord gives the room a little life without competing with play.
    for (const [frequency, level] of [[110, 0.24], [164.81, 0.13], [220, 0.08]] as const) {
      const oscillator = context.createOscillator()
      const voice = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      voice.gain.value = level
      oscillator.connect(voice)
      voice.connect(musicGain)
      oscillator.start()
    }
    const lfo = context.createOscillator()
    musicMotionGain = context.createGain()
    lfo.frequency.value = 0.09
    musicMotionGain.gain.value = 0
    lfo.connect(musicMotionGain)
    musicMotionGain.connect(musicGain.gain)
    lfo.start()
  }
  musicGain?.gain.setTargetAtTime(musicEnabled ? musicVolume : 0, context.currentTime, 0.8)
  musicMotionGain?.gain.setTargetAtTime(musicEnabled ? musicVolume * 0.075 : 0, context.currentTime, 0.8)
  if (musicEnabled && musicVolume > 0 && !musicStepTimer) {
    const notes = [440, 523.25, 659.25, 783.99, 659.25, 587.33, 523.25, 392]
    const playNote = () => {
      if (!musicGain) return
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const start = context.currentTime
      oscillator.type = 'triangle'
      oscillator.frequency.value = notes[musicStep % notes.length]
      envelope.gain.setValueAtTime(0.001, start)
      envelope.gain.exponentialRampToValueAtTime(0.12, start + 0.025)
      envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.38)
      oscillator.connect(envelope)
      envelope.connect(musicGain)
      oscillator.start(start)
      oscillator.stop(start + 0.4)
      musicStep += 1
    }
    playNote()
    musicStepTimer = setInterval(playNote, 420)
  } else if ((!musicEnabled || musicVolume <= 0) && musicStepTimer) {
    clearInterval(musicStepTimer)
    musicStepTimer = null
  }
}

export function startCrashCurveSound() {
  if (typeof window === 'undefined') return
  const { gameSoundsEnabled, soundVolume } = useSettingsStore.getState()
  if (!gameSoundsEnabled || soundVolume <= 0) return
  try {
    const context = getAudioContext()
    if (!context) return
    stopCrashCurveSound()
    crashOscillator = context.createOscillator()
    crashFilter = context.createBiquadFilter()
    crashEnvelope = context.createGain()
    crashOscillator.type = 'sawtooth'
    crashOscillator.frequency.value = 95
    crashFilter.type = 'lowpass'
    crashFilter.frequency.value = 420
    crashEnvelope.gain.value = 0.001
    crashOscillator.connect(crashFilter)
    crashFilter.connect(crashEnvelope)
    crashEnvelope.connect(context.destination)
    crashOscillator.start()
    crashEnvelope.gain.setTargetAtTime(0.018 * soundVolume, context.currentTime, 0.2)
  } catch {
    stopCrashCurveSound()
  }
}

export function updateCrashCurveSound(multiplier: number) {
  if (!audio || !crashOscillator || !crashFilter || !crashEnvelope) return
  const { gameSoundsEnabled, soundVolume } = useSettingsStore.getState()
  if (!gameSoundsEnabled || soundVolume <= 0) {
    stopCrashCurveSound()
    return
  }
  const now = audio.currentTime
  const level = Math.min(16, Math.max(1, multiplier))
  crashOscillator.frequency.setTargetAtTime(95 + level * 19, now, 0.12)
  crashFilter.frequency.setTargetAtTime(420 + level * 90, now, 0.12)
  crashEnvelope.gain.setTargetAtTime((0.012 + level * 0.0012) * soundVolume, now, 0.12)
}

export function stopCrashCurveSound() {
  if (!audio || !crashOscillator || !crashEnvelope) return
  const oscillator = crashOscillator
  const envelope = crashEnvelope
  crashOscillator = null
  crashFilter = null
  crashEnvelope = null
  const now = audio.currentTime
  try {
    envelope.gain.cancelScheduledValues(now)
    envelope.gain.setTargetAtTime(0.001, now, 0.04)
    oscillator.stop(now + 0.18)
  } catch {
    // A sound can finish while a round is being reset.
  }
}

/** Short synthesized UI cues keep the app self-contained and need no downloaded assets. */
export function playSiteSound(kind: SoundKind = 'tap') {
  if (typeof window === 'undefined') return
  const { uiSoundsEnabled, gameSoundsEnabled, soundVolume } = useSettingsStore.getState()
  const gameSound = kind !== 'tap'
  if ((gameSound ? !gameSoundsEnabled : !uiSoundsEnabled) || soundVolume <= 0) return

  try {
    const context = getAudioContext()
    if (!context) return

    const now = context.currentTime
    const tone = (frequency: number, duration: number, level: number, type: OscillatorType = 'sine', endFrequency?: number, delay = 0) => {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const start = now + delay
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, start)
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
      envelope.gain.setValueAtTime(0.001, start)
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, level * soundVolume), start + 0.012)
      envelope.gain.exponentialRampToValueAtTime(0.001, start + duration)
      oscillator.connect(envelope)
      envelope.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + duration)
    }

    switch (kind) {
      case 'tap': tone(520, 0.04, 0.025); break
      case 'chip': tone(1450, 0.055, 0.055, 'triangle', 780); tone(920, 0.07, 0.035, 'sine', 620, 0.025); break
      case 'deal': tone(380, 0.08, 0.045, 'triangle', 220); break
      case 'card': tone(760, 0.085, 0.045, 'triangle', 420); tone(1180, 0.035, 0.018, 'sine', undefined, 0.035); break
      case 'dice': tone(220, 0.22, 0.06, 'triangle', 85); tone(510, 0.06, 0.028, 'square', 300, 0.11); tone(350, 0.05, 0.024, 'square', 220, 0.19); break
      case 'wheel': tone(180, 0.75, 0.045, 'sawtooth', 75); tone(880, 0.04, 0.025, 'triangle', 450, 0.65); break
      case 'spin': tone(420, 0.45, 0.035, 'triangle', 950); break
      case 'case': tone(90, 0.55, 0.07, 'sawtooth', 54); tone(280, 0.08, 0.035, 'square', 180, 0.08); tone(215, 0.1, 0.03, 'square', 140, 0.2); tone(150, 0.09, 0.025, 'square', 90, 0.34); break
      case 'case-tick': tone(1120, 0.045, 0.04, 'triangle', 660); break
      case 'mine-safe': tone(620, 0.1, 0.045, 'triangle', 880); tone(1320, 0.11, 0.025, 'sine', undefined, 0.045); break
      case 'mine-hit': tone(105, 0.42, 0.11, 'sawtooth', 38); tone(72, 0.34, 0.075, 'triangle', 42, 0.035); tone(165, 0.12, 0.055, 'square', 55, 0.08); break
      case 'keno-pick': tone(880, 0.055, 0.035, 'sine'); break
      case 'keno-ball': tone(410, 0.22, 0.045, 'triangle', 235); tone(960, 0.1, 0.035, 'sine', undefined, 0.12); break
      case 'tower-safe': tone(510, 0.08, 0.04, 'triangle', 700); tone(920, 0.12, 0.025, 'sine', undefined, 0.045); break
      case 'tower-hit': tone(165, 0.45, 0.09, 'sawtooth', 48); tone(92, 0.32, 0.06, 'triangle', 40, 0.05); break
      case 'crash-rise': tone(110, 0.9, 0.045, 'sawtooth', 460); tone(220, 0.85, 0.022, 'sine', 920); break
      case 'crash-hit': tone(210, 0.55, 0.1, 'sawtooth', 45); tone(95, 0.42, 0.07, 'square', 32, 0.06); break
      case 'coin': tone(520, 0.34, 0.05, 'sine', 1560); tone(980, 0.08, 0.035, 'triangle', 420, 0.28); break
      case 'ball': tone(680, 0.09, 0.04, 'triangle', 400); tone(370, 0.065, 0.03, 'sine', 220, 0.11); break
      case 'step-safe': tone(300, 0.07, 0.04, 'triangle', 390); tone(530, 0.08, 0.025, 'sine', undefined, 0.055); break
      case 'step-hit': tone(190, 0.36, 0.085, 'triangle', 55); tone(88, 0.26, 0.055, 'sawtooth', 36, 0.06); break
      case 'race': tone(130, 0.65, 0.04, 'sawtooth', 300); tone(260, 0.54, 0.02, 'triangle', 520); break
      case 'cashout': tone(660, 0.16, 0.055, 'triangle', 990); tone(990, 0.22, 0.045, 'sine', 1320, 0.1); break
      case 'cups': tone(420, 0.075, 0.04, 'triangle', 220); tone(690, 0.055, 0.025, 'sine', 340, 0.08); break
      case 'win': [523, 659, 784, 1047].forEach((n, i) => tone(n, 0.32, 0.07, 'sine', undefined, i * 0.09)); break
      case 'loss': tone(330, 0.48, 0.07, 'triangle', 145); tone(220, 0.38, 0.045, 'sine', 110, 0.13); break
    }
  } catch {
    // Audio is an enhancement; autoplay/device restrictions should never affect gameplay.
  }
}

function kindFor(target: HTMLElement): SoundKind {
  const explicit = target.closest<HTMLElement>('[data-sound]')?.dataset.sound
  if (explicit === 'chip' || explicit === 'deal' || explicit === 'card' || explicit === 'dice' || explicit === 'wheel' || explicit === 'spin' || explicit === 'win' || explicit === 'loss' || explicit === 'case' || explicit === 'case-tick' || explicit === 'mine-safe' || explicit === 'mine-hit' || explicit === 'keno-pick' || explicit === 'keno-ball' || explicit === 'tower-safe' || explicit === 'tower-hit' || explicit === 'crash-rise' || explicit === 'crash-hit' || explicit === 'coin' || explicit === 'ball' || explicit === 'step-safe' || explicit === 'step-hit' || explicit === 'race' || explicit === 'cashout' || explicit === 'cups') return explicit
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
    const unsubscribe = useSettingsStore.subscribe(syncMusic)
    const onClick = (event: MouseEvent) => {
      syncMusic()
      const target = event.target
      if (!(target instanceof HTMLElement) || target.closest('[data-sound="silent"]')) return
      const control = target.closest('button, a, [role="button"]')
      if (control instanceof HTMLButtonElement && (control.disabled || control.getAttribute('aria-disabled') === 'true')) return
      if (control) playSiteSound(kindFor(target))
    }
    document.addEventListener('click', onClick, true)
    return () => {
      unsubscribe()
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  return null
}
