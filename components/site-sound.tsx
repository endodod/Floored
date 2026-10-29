'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settings-store'

type SoundKind =
  | 'tap' | 'chip' | 'deal' | 'card' | 'dice' | 'wheel' | 'spin' | 'win' | 'loss'
  | 'case' | 'case-tick' | 'mine-safe' | 'mine-hit' | 'keno-pick' | 'keno-ball'
  | 'tower-safe' | 'tower-hit' | 'crash-rise' | 'crash-hit' | 'coin' | 'ball'
  | 'step-safe' | 'step-hit' | 'race' | 'cashout' | 'cups'

type Sample = {
  files: string[]
  rate: number
  cutoff: number
  level: number
  offset?: number
  duration?: number
}

const kenney = '/audio/kenney-casino/Audio/'
const recorded = '/audio/recorded/'
const files = (...names: string[]) => names.map((name) => `${kenney}${name}.ogg`)

// CC0 field recordings and Kenney's recorded card, chip, and dice foley.
// Slower playback and low-pass filtering keep transient sounds warm and restrained.
const samples: Record<SoundKind, Sample> = {
  tap: { files: files('chip-lay-1', 'chip-lay-2'), rate: 0.72, cutoff: 1700, level: 0.17 },
  chip: { files: files('chips-handle-1', 'chips-handle-3', 'chips-collide-1'), rate: 0.76, cutoff: 2200, level: 0.34 },
  deal: { files: files('card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'), rate: 0.78, cutoff: 2100, level: 0.32 },
  card: { files: files('card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-4', 'card-slide-5', 'card-slide-6', 'card-slide-7', 'card-slide-8'), rate: 0.78, cutoff: 2400, level: 0.37 },
  dice: { files: files('dice-throw-1', 'dice-throw-2', 'dice-throw-3', 'die-throw-1', 'die-throw-2'), rate: 0.78, cutoff: 2700, level: 0.42 },
  wheel: { files: [`${recorded}roulette-wheel.mp3`], rate: 0.86, cutoff: 3400, level: 0.48 },
  spin: { files: [`${recorded}slot-reels.mp3`], rate: 0.9, cutoff: 3000, level: 0.44, duration: 3.6 },
  win: { files: [`${recorded}slot-payout.mp3`], rate: 0.82, cutoff: 2200, level: 0.52, duration: 3.2 },
  loss: { files: [`${recorded}roulette-wheel.mp3`], rate: 0.7, cutoff: 1250, level: 0.4, offset: 2.1, duration: 0.48 },
  case: { files: [`${recorded}slot-reels.mp3`], rate: 0.78, cutoff: 2600, level: 0.45, duration: 2.4 },
  'case-tick': { files: files('chips-collide-1', 'chips-collide-2', 'chips-collide-3', 'chips-collide-4'), rate: 0.72, cutoff: 1800, level: 0.25 },
  'mine-safe': { files: files('chip-lay-1', 'chip-lay-2', 'chip-lay-3'), rate: 0.76, cutoff: 1900, level: 0.3 },
  'mine-hit': { files: files('die-throw-1', 'die-throw-2', 'die-throw-3', 'die-throw-4'), rate: 0.58, cutoff: 1050, level: 0.55 },
  'keno-pick': { files: files('chip-lay-1', 'chip-lay-2', 'chip-lay-3'), rate: 0.72, cutoff: 1750, level: 0.26 },
  'keno-ball': { files: files('dice-grab-1', 'dice-grab-2', 'dice-throw-1'), rate: 0.76, cutoff: 2200, level: 0.34 },
  'tower-safe': { files: files('card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'), rate: 0.72, cutoff: 1900, level: 0.3 },
  'tower-hit': { files: files('die-throw-1', 'die-throw-2', 'die-throw-3', 'die-throw-4'), rate: 0.55, cutoff: 950, level: 0.55 },
  'crash-rise': { files: [`${recorded}roulette-wheel.mp3`], rate: 0.74, cutoff: 1800, level: 0.32, duration: 2.3 },
  'crash-hit': { files: files('chips-collide-1', 'chips-collide-2', 'chips-collide-3', 'chips-collide-4'), rate: 0.56, cutoff: 900, level: 0.58 },
  coin: { files: files('chips-collide-1', 'chips-collide-2', 'chips-collide-3', 'chips-stack-1'), rate: 0.72, cutoff: 1800, level: 0.36 },
  ball: { files: files('dice-throw-1', 'dice-throw-2', 'dice-throw-3'), rate: 0.72, cutoff: 2300, level: 0.35 },
  'step-safe': { files: files('card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'), rate: 0.74, cutoff: 1850, level: 0.3 },
  'step-hit': { files: files('chips-collide-1', 'chips-collide-2', 'chips-collide-3'), rate: 0.56, cutoff: 950, level: 0.52 },
  race: { files: files('dice-shake-1', 'dice-shake-2', 'dice-shake-3'), rate: 0.8, cutoff: 2600, level: 0.3, duration: 1.1 },
  cashout: { files: files('chips-stack-1', 'chips-stack-2', 'chips-stack-3', 'chips-stack-4', 'chips-stack-5', 'chips-stack-6'), rate: 0.78, cutoff: 2300, level: 0.42 },
  cups: { files: files('card-slide-1', 'card-slide-3', 'card-slide-5', 'card-slide-7'), rate: 0.72, cutoff: 1800, level: 0.32 },
}

const soundKinds = new Set<SoundKind>(Object.keys(samples) as SoundKind[])
const decodedSamples = new Map<string, AudioBuffer>()
const pendingSamples = new Map<string, Promise<AudioBuffer | null>>()
let audio: AudioContext | null = null
let musicGain: GainNode | null = null
let musicMotionGain: GainNode | null = null
let musicStarted = false
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

function loadSample(url: string, context: AudioContext): Promise<AudioBuffer | null> {
  const cached = decodedSamples.get(url)
  if (cached) return Promise.resolve(cached)
  const pending = pendingSamples.get(url)
  if (pending) return pending

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Audio request failed: ${response.status}`)
      return response.arrayBuffer()
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      decodedSamples.set(url, buffer)
      return buffer
    })
    .catch(() => null)
    .finally(() => pendingSamples.delete(url))
  pendingSamples.set(url, request)
  return request
}

async function playSample(kind: SoundKind, context: AudioContext, volume: number) {
  const sample = samples[kind]
  const url = sample.files[Math.floor(Math.random() * sample.files.length)]
  const buffer = await loadSample(url, context)
  if (!buffer || audio !== context) return

  const offset = Math.min(sample.offset ?? 0, Math.max(0, buffer.duration - 0.04))
  const duration = Math.min(sample.duration ?? buffer.duration - offset, buffer.duration - offset)
  if (duration <= 0.035) return

  const now = context.currentTime
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  const playbackRate = Math.max(0.5, Math.min(1.2, sample.rate))
  const end = now + duration / playbackRate
  const level = sample.level * volume

  source.buffer = buffer
  source.playbackRate.setValueAtTime(playbackRate, now)
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(sample.cutoff, now)
  filter.Q.value = 0.55
  envelope.gain.setValueAtTime(0.001, now)
  envelope.gain.linearRampToValueAtTime(level, now + 0.012)
  if (end > now + 0.05) {
    envelope.gain.setValueAtTime(level, end - 0.035)
    envelope.gain.linearRampToValueAtTime(0.001, end)
  }
  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(context.destination)
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    envelope.disconnect()
  }
  source.start(now, offset, duration)
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
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 360
    filter.Q.value = 0.35
    filter.connect(musicGain)
    musicGain.connect(context.destination)
    // A dim, low-register room tone replaces the bright arpeggio.
    for (const [frequency, level] of [[55, 0.18], [82.41, 0.09], [110, 0.035]] as const) {
      const oscillator = context.createOscillator()
      const voice = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      voice.gain.value = level
      oscillator.connect(voice)
      voice.connect(filter)
      oscillator.start()
    }
    const lfo = context.createOscillator()
    musicMotionGain = context.createGain()
    lfo.frequency.value = 0.055
    musicMotionGain.gain.value = 0
    lfo.connect(musicMotionGain)
    musicMotionGain.connect(musicGain.gain)
    lfo.start()
  }
  musicGain?.gain.setTargetAtTime(musicEnabled ? musicVolume : 0, context.currentTime, 0.9)
  musicMotionGain?.gain.setTargetAtTime(musicEnabled ? musicVolume * 0.035 : 0, context.currentTime, 0.9)
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
    crashOscillator.type = 'sine'
    crashOscillator.frequency.value = 38
    crashFilter.type = 'lowpass'
    crashFilter.frequency.value = 150
    crashEnvelope.gain.value = 0.001
    crashOscillator.connect(crashFilter)
    crashFilter.connect(crashEnvelope)
    crashEnvelope.connect(context.destination)
    crashOscillator.start()
    crashEnvelope.gain.setTargetAtTime(0.013 * soundVolume, context.currentTime, 0.24)
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
  const level = Math.min(12, Math.max(1, multiplier))
  crashOscillator.frequency.setTargetAtTime(38 + level * 3.2, now, 0.2)
  crashFilter.frequency.setTargetAtTime(150 + level * 11, now, 0.2)
  crashEnvelope.gain.setTargetAtTime((0.009 + level * 0.00055) * soundVolume, now, 0.2)
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
    envelope.gain.setTargetAtTime(0.001, now, 0.05)
    oscillator.stop(now + 0.2)
  } catch {
    // A sound can finish while a round is being reset.
  }
}

/** Play recorded casino foley, with separate UI and game-sound controls. */
export function playSiteSound(kind: SoundKind = 'tap') {
  if (typeof window === 'undefined') return
  const { uiSoundsEnabled, gameSoundsEnabled, soundVolume } = useSettingsStore.getState()
  if ((kind === 'tap' ? !uiSoundsEnabled : !gameSoundsEnabled) || soundVolume <= 0) return
  try {
    const context = getAudioContext()
    if (!context) return
    void playSample(kind, context, soundVolume).catch(() => undefined)
  } catch {
    // Audio is an enhancement; device or autoplay restrictions must never affect gameplay.
  }
}

function kindFor(target: HTMLElement): SoundKind {
  const explicit = target.closest<HTMLElement>('[data-sound]')?.dataset.sound
  if (explicit && soundKinds.has(explicit as SoundKind)) return explicit as SoundKind
  if (target.closest('[data-sound="silent"]')) return 'tap'
  const button = target.closest<HTMLElement>('button, a, [role="button"]')
  if (!button) return 'tap'
  const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`.toLowerCase()
  if (/roulette|wheel/.test(label)) return 'wheel'
  if (/slots?|reel|spin/.test(label)) return 'spin'
  if (/dice|roll/.test(label)) return 'dice'
  if (/cash out|cashout|withdraw/.test(label)) return 'cashout'
  if (/draw|deal|card|hit|stand|double|fold/.test(label)) return 'card'
  if (/chip|bet|raise|call|check|fold|bid|pick|tile|cup|drop|flip|next/.test(label)) return 'chip'
  return 'tap'
}

/** One delegated listener covers shared UI, all game boards and Tables interactions. */
export function SiteSound() {
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(syncMusic)
    syncMusic()
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
