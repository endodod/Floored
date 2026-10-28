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

export interface TutorialStep {
  icon: string
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

/** Opens the tutorial on the first visit of a page load unless the player ticked "Don't show again". */
export function useTutorial(id: string) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (autoOpened.has(id) || readHidden(id)) return
    autoOpened.add(id)
    setOpen(true)
  }, [id])
  return { open, setOpen }
}

export function ModeTutorial({
  id,
  title,
  intro,
  steps,
  open,
  onOpenChange,
  accent = 'text-violet-400',
}: {
  id: string
  title: string
  intro: string
  steps: TutorialStep[]
  open: boolean
  onOpenChange: (open: boolean) => void
  accent?: string
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${accent}`}>How to play</p>
          <DialogTitle className="text-2xl font-black tracking-tight">{title}</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.title} className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <span aria-hidden className="w-6 text-center text-xl leading-none shrink-0 pt-0.5">
                {step.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{step.title}</p>
                <p className="text-sm text-zinc-400 leading-snug">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 accent-white cursor-pointer"
            />
            Don&apos;t show again
          </label>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="px-5 py-2 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-lg transition-colors text-sm shadow-lg"
          >
            Got it
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
