'use client'

import type { ReactNode } from 'react'

export const SURVIVAL_SIDEBAR_PANEL_CLASS =
  'rounded-md bg-surface p-2.5 flex flex-col gap-1.5 min-h-0'

export function SurvivalSidebarPanel({
  title,
  count,
  compact = false,
  empty,
  emptyLabel,
  footer,
  children,
}: {
  title: string
  count?: number
  compact?: boolean
  empty?: boolean
  emptyLabel?: string
  footer?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className={`${SURVIVAL_SIDEBAR_PANEL_CLASS} ${compact ? 'h-full' : 'shrink'}`}>
      <p className="shrink-0 text-[13px] font-semibold text-ink">
        {title}
        {count != null && <span className="font-normal text-dim"> {count}</span>}
      </p>

      {empty ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 text-center px-1">
          <span className="text-xs text-dim">{emptyLabel ?? 'Nothing here yet'}</span>
          {footer}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 flex flex-col gap-1 pr-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

export function SurvivalSidebarRow({
  name,
  scope,
}: {
  name: string
  scope?: string | null
}) {
  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      <p className="text-[12px] leading-snug text-soft">{name}</p>
      {scope && (
        <p className="text-[11px] leading-tight text-dim">{scope}</p>
      )}
    </div>
  )
}
