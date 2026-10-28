import { notFound } from 'next/navigation'
import { LADDER_ENABLED } from '@/lib/features'

export default function LadderLayout({ children }: { children: React.ReactNode }) {
  if (!LADDER_ENABLED) notFound()
  return <>{children}</>
}
