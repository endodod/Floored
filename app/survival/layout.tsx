import { notFound } from 'next/navigation'
import { SURVIVAL_ENABLED } from '@/lib/features'
import { SurvivalShell } from './survival-shell'

export default function SurvivalLayout({ children }: { children: React.ReactNode }) {
  if (!SURVIVAL_ENABLED) notFound()
  return <SurvivalShell>{children}</SurvivalShell>
}
