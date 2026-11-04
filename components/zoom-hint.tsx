'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const SEEN_KEY = 'floored-zoom-hint-seen'

/** Screen widths (CSS pixels at 100% zoom) the advice changes at. */
const SMALL_BELOW = 1366
const LARGE_FROM = 2200

type Advice = 'in' | 'out' | 'fine'

function adviceFor(width: number): Advice {
  if (width >= LARGE_FROM) return 'in'
  if (width < SMALL_BELOW) return 'out'
  return 'fine'
}

/**
 * A one-time tip on the home page: the games are built to fit one screen, and browser
 * zoom (Ctrl + mouse wheel) sizes them to yours. Only for a mouse and keyboard (phones
 * and tablets pinch instead); the advice follows the screen's width. Dismissed for good.
 */
export function ZoomHint() {
  const [open, setOpen] = useState(false)
  const [advice, setAdvice] = useState<Advice>('fine')
  const [mac, setMac] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY)) return
    } catch {
      return
    }
    if (!window.matchMedia('(pointer: fine) and (hover: hover)').matches) return
    setAdvice(adviceFor(window.screen.width))
    setMac(/Mac/i.test(navigator.platform || navigator.userAgent))
    setOpen(true)
  }, [])

  const close = () => {
    setOpen(false)
    try {
      window.localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Private windows: the tip simply shows again next time.
    }
  }

  const key = mac ? '⌘' : 'Ctrl'
  const tip =
    advice === 'in'
      ? `Your screen is large. Zoom in so the tables fill it: hold ${key} and scroll up (or press ${key} +).`
      : advice === 'out'
        ? `Your screen is on the small side. If a game doesn't fit, zoom out: hold ${key} and scroll down (or press ${key} −).`
        : `If things look too small or too big, hold ${key} and scroll the mouse wheel (or press ${key} + / −).`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Size Floored to your screen</DialogTitle>
          <DialogDescription>
            Every game is built to fit on one screen. {tip} {key} 0 puts it back to normal.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={close}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
