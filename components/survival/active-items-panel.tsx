'use client'

import { SurvivalSidebarPanel } from '@/components/survival/survival-sidebar-panel'

/** Placeholder for owned active items (coming soon). */
export function ActiveItemsPanel({ compact = false }: { compact?: boolean }) {
  return (
    <SurvivalSidebarPanel
      compact={compact}
      title="Active items"
      count={0}
      empty
      emptyLabel="No active items yet"
      footer={<p className="text-[11px] text-dim">Coming soon</p>}
    />
  )
}
