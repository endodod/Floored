import { notFound } from 'next/navigation'
import { TABLES_ENABLED } from '@/lib/features'
import { TablesHub } from '@/components/tables/hub'

export default function TablesPage() {
  if (!TABLES_ENABLED) notFound()
  return <TablesHub />
}
