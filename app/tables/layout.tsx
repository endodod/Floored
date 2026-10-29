import { notFound } from 'next/navigation'
import { TABLES_ENABLED } from '@/lib/features'

export default function TablesLayout({ children }: { children: React.ReactNode }) {
  if (!TABLES_ENABLED) notFound()
  return <>{children}</>
}
