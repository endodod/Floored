import { notFound } from 'next/navigation'
import { STORY_ENABLED } from '@/lib/features'

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  if (!STORY_ENABLED) notFound()
  return children
}
