'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Portrait } from '@/components/story/portrait'
import { CHARACTER_BY_ID } from '@/lib/story/content/characters'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import { useStoryStore } from '@/store/story-store'

const isLook = (id: string): id is PortraitLook => (PORTRAIT_LOOKS as string[]).includes(id)

/**
 * The story dialogue box: plays the store's active scene (lines, choices, end).
 * A normal block; the page decides where it sits. Calls `onDone` once the scene ends.
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
  const next = useCallback(() => advance(), [advance])

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

  if (!step || step.kind === 'end') return null

  const frame =
    'rounded-md bg-ground/80 p-3 shadow-[inset_0_0_0_1px_var(--line)] sm:p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150'

  if (step.kind === 'choice') {
    return (
      <div className={frame}>
        <div aria-live="polite">
          {step.prompt && <p className="mb-3 text-[15px] leading-relaxed text-soft sm:text-base">{step.prompt}</p>}
        </div>
        <div className="flex flex-col gap-2">
          {step.options.map((o) => (
            <Button
              key={o.index}
              variant="outline"
              className="h-auto min-h-10 w-full justify-start whitespace-normal px-4 py-2 text-left"
              onClick={() => pick(o.index)}
            >
              {o.text}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  const narrator = step.speaker === 'narrator'
  const you = step.speaker === 'you'
  const character = narrator || you ? undefined : CHARACTER_BY_ID.get(step.speaker)
  const look = character && isLook(character.id) ? character.id : null
  const label = you ? 'YOU' : character?.name ?? step.speaker
  const hint = (
    <p className="mt-2 font-mono text-[11px] tracking-wider text-dim" aria-hidden="true">
      ▸ continue
    </p>
  )

  return (
    <div
      className={`${frame} cursor-pointer select-none`}
      onClick={next}
      data-speaker={step.speaker}
    >
      {narrator ? (
        <div>
          <p aria-live="polite" className="text-[15px] italic leading-relaxed text-dim sm:text-base">
            {step.text}
          </p>
          {hint}
        </div>
      ) : you ? (
        <div className="text-right">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold">YOU</p>
          <p aria-live="polite" className="mt-1 text-[15px] leading-relaxed text-ink sm:text-base">
            {step.text}
          </p>
          {hint}
        </div>
      ) : (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4">
          <div className="w-[72px] sm:w-24">
            {look ? (
              <Portrait look={look} expression={step.expression} className="block w-full [&_svg]:h-auto [&_svg]:w-full" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold">{label}</p>
            <p aria-live="polite" className="mt-1 text-[15px] leading-relaxed text-ink sm:text-base">
              {step.text}
            </p>
            {hint}
          </div>
        </div>
      )}
    </div>
  )
}
