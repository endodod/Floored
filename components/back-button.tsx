'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/** Back to wherever the player came from (a game, the home page); home when opened directly. */
export function BackButton({ fallback = '/', label = '← Back' }: { fallback?: string; label?: string }) {
  const router = useRouter()
  return (
    <Button
      variant="outline"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      {label}
    </Button>
  )
}
