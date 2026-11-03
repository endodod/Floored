'use client'

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Portrait } from '@/components/story/portrait'
import { SceneArt, type SceneArtState } from '@/components/story/scene-art'
import { PORTRAIT_LOOKS, type PortraitLook } from '@/lib/story/portraits'
import { spotPoint, spotScale, type CitySceneConfig, type SceneLayout } from '@/lib/story/scene-theme'
import { cn } from '@/lib/utils'

/**
 * The city as a scene: the drawn street fitted to the space (bottom-anchored,
 * the sky and road run on past its edges) with hotspots pinned to it. Portrait
 * spaces get the tall street, landscape ones the wide street. `--u` on the art
 * box is pixels per view unit, so hotspots can size with the picture.
 */

export interface SceneSpot {
  /** A spot id from the city's config (dive, marta, rest...). */
  spot: string
  node: ReactNode
  /** Draw above other spots (open sheet, tonight's door). */
  raise?: boolean
}

export function CityScene({
  config,
  state,
  spots = [],
  dim = false,
  headlights = true,
  className,
  children,
}: {
  config: CitySceneConfig
  state: SceneArtState
  spots?: SceneSpot[]
  dim?: boolean
  headlights?: boolean
  className?: string
  children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout: SceneLayout = box && box.w / Math.max(1, box.h) < 1.05 ? 'tall' : 'wide'
  const v = config.view[layout]
  const artW = box ? Math.min(box.w, (box.h * v.w) / v.h) : 0
  const artH = (artW * v.h) / v.w
  const u = artW / v.w

  return (
    <div ref={ref} className={cn('absolute inset-0 overflow-hidden', className)} style={{ background: config.palette.skyTop }} data-layout={layout}>
      {box && artW > 0 && (
        <div
          className="absolute bottom-0 left-1/2"
          style={{ width: artW, height: artH, transform: 'translateX(-50%)', ['--u' as string]: u } as CSSProperties}
        >
          <div className={cn('absolute inset-0 transition-[filter] duration-300', dim && 'brightness-[0.45] saturate-[0.7]')}>
            <SceneArt config={config} layout={layout} state={state} idPrefix={`sc${uid}`} headlights={headlights} />
          </div>
          {!dim &&
            spots.map((s) => {
              const p = spotPoint(config, layout, s.spot)
              if (!p) return null
              return (
                <div
                  key={s.spot}
                  className={cn('absolute', s.raise ? 'z-20' : 'z-10')}
                  style={{ left: `${(p[0] / v.w) * 100}%`, top: `${((p[1] - v.y0) / v.h) * 100}%`, transform: 'translate(-50%, -50%)', ['--s' as string]: spotScale(config, layout, s.spot) } as CSSProperties}
                  data-spot={s.spot}
                >
                  {s.node}
                </div>
              )
            })}
        </div>
      )}
      {children}
    </div>
  )
}

const isLook = (id: string): id is PortraitLook => (PORTRAIT_LOOKS as string[]).includes(id)

/** The small wood name plate under a hotspot. */
export function Plate({ children, tone = 'wood', className }: { children: ReactNode; tone?: 'wood' | 'dark' | 'felt'; className?: string }) {
  return (
    <span
      className={cn(
        'st-plate pointer-events-none inline-flex max-w-[9.5rem] items-center gap-1 whitespace-nowrap rounded-[3px] px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.12em] sm:text-[11px]',
        tone === 'wood' && 'st-plate-wood text-[#f4ead2]',
        tone === 'dark' && 'bg-black/70 text-dim shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
        tone === 'felt' && 'bg-[#1b4d34] text-[#fffaf0] shadow-[inset_0_0_0_1px_rgba(217,164,65,0.6)]',
        className,
      )}
    >
      {children}
    </span>
  )
}

const HOTSPOT_BTN =
  'st-spot group relative block rounded-md outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold'
const UNDER = 'pointer-events-none absolute left-1/2 top-full mt-1 flex -translate-x-1/2 flex-col items-center gap-0.5'
const OVER = 'pointer-events-none absolute bottom-full left-1/2 mb-1 flex -translate-x-1/2 flex-col items-center gap-0.5'

/** A character standing at their spot: a portrait medallion with a name plate under it. */
export function PersonSpot({
  id,
  name,
  sub,
  badge,
  muted,
  active,
  onOpen,
  label,
}: {
  id: string
  name: string
  sub?: string
  badge?: 'talk' | 'done' | null
  muted?: boolean
  active?: boolean
  onOpen: (e: MouseEvent<HTMLButtonElement>) => void
  label: string
}) {
  return (
    <button type="button" className={cn(HOTSPOT_BTN, 'rounded-full')} onClick={onOpen} aria-label={label} aria-haspopup="dialog" aria-expanded={!!active}>
      <span
        className={cn(
          'st-medallion relative block rounded-full transition-transform duration-200 group-hover:-translate-y-0.5',
          active && 'st-medallion-on',
          muted && 'opacity-60 grayscale-[0.6]',
        )}
        style={{ width: 'clamp(42px, calc(var(--u) * 96px), 78px)' }}
      >
        {isLook(id) && <Portrait look={id} className="block w-full [&_svg]:h-auto [&_svg]:w-full" />}
        {badge === 'talk' && (
          <span aria-hidden className="st-motion st-bob absolute -right-1 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gold text-[11px] font-black leading-none text-[#1a1206] shadow-[0_0_10px_rgba(217,164,65,0.7)]">
            !
          </span>
        )}
        {badge === 'done' && (
          <span aria-hidden className="absolute -right-1 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1b4d34] text-[10px] font-black leading-none text-[#fffaf0] shadow-[inset_0_0_0_1px_rgba(217,164,65,0.6)]">
            ✓
          </span>
        )}
      </span>
      <span className={cn(UNDER, '-mt-1')}>
        <Plate>{name}</Plate>
        {sub && <Plate tone="dark" className="normal-case tracking-normal">{sub}</Plate>}
      </span>
    </button>
  )
}

/** A door or a place on the street: a lit hit area over the art, with a plate under (or over) it. */
export function PlaceSpot({
  title,
  sub,
  icon,
  locked,
  lit,
  active,
  onOpen,
  label,
  size,
  plateBelow = true,
}: {
  title: string
  sub?: ReactNode
  icon?: ReactNode
  locked?: boolean
  lit?: boolean
  active?: boolean
  onOpen: (e: MouseEvent<HTMLButtonElement>) => void
  label: string
  /** Hit area over the art, in the piece's own units. */
  size: [number, number]
  plateBelow?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(HOTSPOT_BTN, 'st-hit rounded-[4px] transition-[box-shadow,background-color] duration-200', lit && 'st-hit-lit st-motion', active && 'st-hit-on')}
      onClick={onOpen}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={!!active}
      style={{ width: `max(30px, calc(var(--u) * var(--s, 1) * ${size[0]}px))`, height: `max(30px, calc(var(--u) * var(--s, 1) * ${size[1]}px))` }}
    >
      <span className={plateBelow ? UNDER : OVER}>
        <Plate tone={lit ? 'felt' : locked ? 'dark' : 'wood'}>
          {icon}
          {title}
        </Plate>
        {sub && <Plate tone="dark" className="normal-case tracking-normal">{sub}</Plate>}
      </span>
    </button>
  )
}
