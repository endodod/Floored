'use client'

import { useEffect } from 'react'
import { StoryHub } from '@/components/story/hub'
import { useHydrated } from '@/hooks/use-hydrated'
import { useStoryStore } from '@/store/story-store'

export default function StoryPage() {
  const hydrated = useHydrated()
  // Scenes queued by the last visit (arrival, boss result, bust) play on entry.
  useEffect(() => {
    if (hydrated) useStoryStore.getState().playQueued()
  }, [hydrated])
  if (!hydrated) return null
  return <StoryHub />
}
