'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import type { Expression } from '@/lib/story/types'
import { Portrait } from '@/components/story/portrait'
import { CHARACTER_BY_ID } from '@/lib/story/content/characters'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import { useStoryStore } from '@/store/story-store'
import { cn } from '@/lib/utils'

const isLook = (id: string): id is PortraitLook => (PORTRAIT_LOOKS as string[]).includes(id)

/** Letters a second while a line types out. */
const TYPE_CPS = 36

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (document.documentElement.getAttribute('data-motion') === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches)

/**
 * The story dialogue: plays the store's active scene (lines, choices, end) as a
 * game conversation over the dimmed city. It fills its parent.
 *
 * - Character lines are speech bubbles with a tail at the speaker's medallion;
 *   the speaker brightens, a second character in the scene dims. "You" lines
 *   are a felt bubble on the player's side (right), the narrator a caption card.
 * - Lines type out (TYPE_CPS); a click, tap, Enter or Space first finishes the
 *   line, then moves on. A gold ▼ shows once the line is complete. Reduced
 *   motion shows the whole line at once and a still ▼.
 * - Choices are option cards: number keys 1–9 pick, arrow keys move focus.
 *
 * Calls `onDone` once the scene ends.
 */
export function DialogueBox({ onDone }: { onDone?: () => void }) {
  // Subscribe to everything the current step depends on, then read the step.
  const scene = useStoryStore((s) => s.scene)
  useStoryStore((s) => s.flags)
  useStoryStore((s) => s.factions)
  useStoryStore((s) => s.money)
  const advance = useStoryStore((s) => s.advance)
  const pick = useStoryStore((s) => s.pick)
  const step = scene ? useStoryStore.getState().currentStep() : null

  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  // The end node: applying it clears the scene; then tell the page.
  const ending = step?.kind === 'end'
  useEffect(() => {
    if (!ending) return
    advance()
    onDoneRef.current?.()
  }, [ending, scene?.id, advance])

  const isLine = step?.kind === 'line'
  const lineText = step?.kind === 'line' ? step.text : ''
  const stepKey = scene ? `${scene.id}:${scene.node}` : ''

  // Who is on stage this scene: up to two characters (left, right) and their last expression.
  const cast = useRef<{ scene: string; looks: PortraitLook[]; faces: Partial<Record<PortraitLook, Expression>>; last: PortraitLook | null }>({ scene: '', looks: [], faces: {}, last: null })
  if (scene && cast.current.scene !== scene.id) cast.current = { scene: scene.id, looks: [], faces: {}, last: null }
  if (step?.kind === 'line' && isLook(step.speaker)) {
    const c = cast.current
    const look = step.speaker
    if (!c.looks.includes(look)) {
      if (c.looks.length < 2) c.looks = [...c.looks, look]
      else c.looks = c.looks.map((l) => (l === c.last ? l : look))
    }
    c.faces = { ...c.faces, [look]: step.expression ?? 'neutral' }
    c.last = look
  }

  // Typewriter: how many letters of the line are showing.
  const [typed, setTyped] = useState(0)
  useEffect(() => {
    if (!isLine) return
    if (reducedMotion()) {
      setTyped(lineText.length)
      return
    }
    setTyped(0)
    const started = performance.now()
    const id = window.setInterval(() => {
      const n = Math.min(lineText.length, Math.floor(((performance.now() - started) / 1000) * TYPE_CPS) + 1)
      // A tap may already have finished the line: never type backwards.
      setTyped((t) => Math.max(t, n))
      if (n >= lineText.length) window.clearInterval(id)
    }, 1000 / TYPE_CPS)
    return () => window.clearInterval(id)
  }, [stepKey, isLine, lineText])
  const complete = typed >= lineText.length

  const next = useCallback(() => {
    if (!complete) setTyped(lineText.length)
    else advance()
  }, [advance, complete, lineText.length])

  useEffect(() => {
    if (!isLine) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return
      const t = e.target as HTMLElement | null
      // Let focused buttons/inputs handle their own activation.
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLine, next])

  // Choices: number keys pick; the first option takes focus so arrows and Enter work at once.
  const optionsRef = useRef<HTMLDivElement>(null)
  const isChoice = step?.kind === 'choice'
  const optionIndexes = step?.kind === 'choice' ? step.options.map((o) => o.index).join(',') : ''
  useEffect(() => {
    if (!isChoice) return
    optionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const picks = optionIndexes.split(',').map(Number)
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > Math.min(9, picks.length)) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault()
      pick(picks[n - 1]!)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isChoice, optionIndexes, stepKey, pick])

  const onOptionKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const buttons = [...(optionsRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
    buttons[(at + dir + buttons.length) % buttons.length]?.focus()
    e.preventDefault()
  }

  if (!step || step.kind === 'end') return null

  const c = cast.current
  const speaking: PortraitLook | null = step.kind === 'line' ? (isLook(step.speaker) ? step.speaker : null) : c.last
  const side = (look: PortraitLook | null) => (look && c.looks.indexOf(look) === 1 ? 'right' : 'left')

  const castRow =
    c.looks.length > 0 ? (
      <div className="pointer-events-none relative flex items-end justify-between" aria-hidden>
        {[0, 1].map((slot) => {
          const look = c.looks[slot]
          if (!look) return <span key={slot} />
          const on = look === speaking
          return (
            <div
              key={look}
              className={cn(
                'st-cast w-[min(34cqw,22cqh)] transition-[transform,filter,opacity] duration-300 lg:w-[min(17cqw,32cqh)]',
                on ? 'st-cast-on' : 'st-cast-off',
              )}
            >
              <div key={on ? `${stepKey}` : 'idle'} className={on ? 'st-motion st-cast-pop' : undefined}>
                <Portrait look={look} expression={c.faces[look] ?? 'neutral'} className="block w-full [&_svg]:h-auto [&_svg]:w-full" />
              </div>
              <p className={cn('st-plate-wood mx-auto -mt-2 w-max rounded-[4px] px-2.5 py-[3px] text-[10.5px] font-bold uppercase leading-4 tracking-[0.16em] text-[#f7eed6] sm:text-[12px]', !on && 'opacity-70')}>
                {CHARACTER_BY_ID.get(look)?.name ?? look}
              </p>
            </div>
          )
        })}
      </div>
    ) : null

  const stage = 'absolute inset-0 flex flex-col justify-end px-3 pb-3 sm:px-6 sm:pb-5 [container-type:size]'
  const column = 'relative mx-auto flex w-full max-w-[980px] flex-col gap-3'
  const prompt = (
    <span aria-hidden className={cn('st-next absolute bottom-2 right-3 text-[13px] leading-none text-gold transition-opacity duration-150', complete ? 'opacity-100' : 'opacity-0')}>
      <span className={complete ? 'st-motion st-bob inline-block' : 'inline-block'}>▼</span>
    </span>
  )

  if (step.kind === 'choice') {
    return (
      <div className={stage}>
        <div className={column}>
          <div className="flex flex-col items-end gap-2">
            {step.prompt && (
              <p aria-live="polite" className="st-caption self-center rounded-md px-4 py-2 text-center text-[14px] italic leading-relaxed text-soft sm:text-[15px]">
                {step.prompt}
              </p>
            )}
            <div ref={optionsRef} role="group" aria-label="Your answer" onKeyDown={onOptionKeys} className="flex w-full max-w-[560px] flex-col gap-2">
              {step.options.map((o, i) => (
                <button
                  key={o.index}
                  type="button"
                  onClick={() => pick(o.index)}
                  className="st-option group relative flex min-h-11 w-full items-center gap-3 rounded-lg py-2.5 pl-3 pr-4 text-left text-[14px] font-medium leading-snug text-ink outline-none sm:text-[15px]"
                >
                  <span aria-hidden className="st-option-key flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{o.text}</span>
                  <span aria-hidden className="st-option-chip h-3.5 w-3.5 shrink-0 rounded-full" />
                </button>
              ))}
            </div>
          </div>
          {castRow}
        </div>
      </div>
    )
  }

  const narrator = step.speaker === 'narrator'
  const you = step.speaker === 'you'
  const character = narrator || you ? undefined : CHARACTER_BY_ID.get(step.speaker)
  const look = character && isLook(character.id) ? character.id : null
  const label = you ? 'You' : character?.name ?? step.speaker
  const text = (
    <>
      <span className="sr-only" aria-live="polite">{step.text}</span>
      <span aria-hidden>
        {step.text.slice(0, typed)}
        <span className="invisible">{step.text.slice(typed)}</span>
      </span>
    </>
  )

  let bubble: ReactNode
  if (narrator) {
    bubble = (
      <div className="st-caption relative mx-auto w-full max-w-[640px] rounded-md px-5 pb-6 pt-4 sm:px-7">
        <p className="text-center text-[15px] italic leading-relaxed text-[#e9dfc8] sm:text-[17px]">{text}</p>
        {prompt}
      </div>
    )
  } else if (you) {
    bubble = (
      <div className="flex justify-end">
        <div className="st-bubble-you relative w-[88%] max-w-[560px] rounded-2xl px-4 pb-6 pt-3 sm:px-5">
          <p className="mb-1 text-right font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-gold">{label}</p>
          <p className="text-[15px] leading-relaxed text-[#f4f1ea] sm:text-[17px]">{text}</p>
          {prompt}
        </div>
      </div>
    )
  } else {
    const right = side(look) === 'right'
    bubble = (
      <div className={cn('flex', right ? 'justify-end' : 'justify-start')}>
        <div className={cn('st-bubble relative w-full max-w-[620px] rounded-2xl px-4 pb-6 pt-3 sm:px-5 sm:pt-4', right ? 'st-tail-right' : 'st-tail-left')}>
          {!look && <p className="mb-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#7a5a2a]">{label}</p>}
          <p className="text-[15px] leading-relaxed text-[#221c17] sm:text-[17px]">{text}</p>
          {prompt}
        </div>
      </div>
    )
  }

  return (
    <div className={`${stage} cursor-pointer select-none`} onClick={next} data-speaker={step.speaker}>
      <div className={column}>
        {bubble}
        {castRow}
      </div>
    </div>
  )
}
