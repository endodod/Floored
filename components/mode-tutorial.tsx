'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Suit } from '@/components/ui/terminal'

export interface TutorialStep {
  title: string
  body: React.ReactNode
}

function storageKey(id: string) {
  return `floored-tutorial-hidden:${id}`
}

// Storage can throw (private mode, blocked site data) — the tutorial then just shows every visit.
function readHidden(id: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(id)) === '1'
  } catch {
    return false
  }
}

function writeHidden(id: string, hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(storageKey(id), '1')
    else window.localStorage.removeItem(storageKey(id))
  } catch {
    // Nothing to do — the choice just isn't remembered.
  }
}

// Auto-opened tutorials this page load — returning to the hub from a game shouldn't pop it again.
const autoOpened = new Set<string>()

/**
 * Opens the tutorial on the first visit of a page load unless the player ticked "Don't show again".
 * Pass `auto: false` where the screen already explains the rules (a mode's intro screen).
 */
export function useTutorial(id: string, { auto = true }: { auto?: boolean } = {}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!auto || autoOpened.has(id) || readHidden(id)) return
    autoOpened.add(id)
    setOpen(true)
  }, [id, auto])
  return { open, setOpen }
}

export function ModeTutorial({
  id,
  title,
  intro,
  steps,
  open,
  onOpenChange,
}: {
  id: string
  title: string
  intro: string
  steps: TutorialStep[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [dontShow, setDontShow] = useState(false)

  // Reflect the saved choice each time the dialog opens, so reopening via "How to play" can undo it.
  useEffect(() => {
    if (open) setDontShow(readHidden(id))
  }, [open, id])

  function handleOpenChange(next: boolean) {
    if (!next) writeHidden(id, dontShow)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <p className="text-[13px] text-dim">How to play</p>
          <DialogTitle className="text-[22px] font-semibold">{title}</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>

        <TutorialSteps steps={steps} />

        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-soft">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-[var(--felt)]"
            />
            Don&apos;t show again
          </label>
          <Button onClick={() => handleOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The steps as a ruled list, each marked with a suit pip — shared by the dialog and the intro screens. */
export function TutorialSteps({ steps, className }: { steps: TutorialStep[]; className?: string }) {
  return (
    <ol className={`divide-y divide-rule ${className ?? ''}`}>
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <Suit index={i} className="w-4 shrink-0 pt-0.5 text-center text-[13px]" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink">{step.title}</p>
            <p className="mt-0.5 text-[13px] leading-5 text-soft">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
