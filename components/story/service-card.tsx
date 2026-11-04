'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * What a person offers besides talk and jobs (Marta's plate, Pike's loans, Jo's read):
 * a round brass button on their card, and a paper card over the street when pressed,
 * in the night receipt's style. `menu` is a diner menu, `iou` a loan slip with a red
 * header, `note` a page from a notebook.
 */

export function ServiceButton({ icon, label, onClick, dot, disabled }: { icon: ReactNode; label: string; onClick: () => void; dot?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-[68px] flex-col items-center gap-1 rounded-md text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-default disabled:opacity-45"
    >
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#2a2118,#120e0b)] text-gold shadow-[inset_0_0_0_1.5px_rgba(217,164,65,0.55),0_4px_10px_-4px_rgba(0,0,0,0.8)] transition-[transform,box-shadow] duration-200 group-enabled:group-hover:-translate-y-0.5 group-enabled:group-hover:shadow-[inset_0_0_0_1.5px_rgba(217,164,65,0.95),0_0_14px_-2px_rgba(217,164,65,0.55)] [&_svg]:h-[19px] [&_svg]:w-[19px]">
        {icon}
        {dot && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_6px_rgba(217,164,65,0.8)]" />}
      </span>
      <span className="text-[11px] font-semibold uppercase leading-3 tracking-[0.1em] text-[#d9b779]">{label}</span>
    </button>
  )
}

export function ServicePopup({
  kind,
  kicker,
  title,
  onClose,
  children,
  footer,
}: {
  kind: 'menu' | 'iou' | 'note'
  kicker: string
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" tabIndex={-1} aria-hidden className="absolute inset-0 cursor-default bg-black/55" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-label={title}
        className={cn(
          'st-motion relative w-full max-w-[330px] text-[#2a2420] outline-none',
          kind === 'menu' && 'st-receipt px-5 pb-6 pt-5',
          kind === 'iou' && 'st-notebook st-paper overflow-hidden rounded-[3px]',
          kind === 'note' && 'st-notebook st-paper rounded-[3px] bg-[repeating-linear-gradient(180deg,transparent_0_23px,rgba(63,94,140,0.18)_23px_24px)] px-5 pb-5 pt-4',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn(
            'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold',
            kind === 'iou' ? 'text-[#f7eed6]/85' : 'text-[#6f6354]',
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        {kind === 'iou' ? (
          <div className="st-matchbook px-5 pb-2.5 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#f0c9a8]">{kicker}</p>
            <h2 className="font-mono text-[18px] font-bold uppercase tracking-[0.18em] text-[#f7eed6]">{title}</h2>
          </div>
        ) : (
          <div className={kind === 'menu' ? 'text-center' : ''}>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#6f6354]">{kicker}</p>
            <h2 className={cn('mt-0.5 font-bold text-[#2a2420]', kind === 'menu' ? 'font-mono text-[17px] uppercase tracking-[0.12em]' : 'text-[17px] italic')}>{title}</h2>
          </div>
        )}
        <div className={cn(kind === 'iou' ? 'px-5 pb-5 pt-3' : 'mt-3')}>
          {kind === 'menu' && <div aria-hidden className="mb-3 border-t border-dashed border-[#2a2420]/40" />}
          {children}
          {footer && <div className="mt-4 flex justify-center">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/** A label and its value on a paper card (the receipt's rows). */
export function PaperRow({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 font-mono text-[12.5px] leading-[19px]">
      <span>{label}</span>
      <span className={cn('num text-right font-bold', tone === 'good' && 'text-[#1d5a3e]', tone === 'bad' && 'text-[#8f2633]')}>{value}</span>
    </div>
  )
}
