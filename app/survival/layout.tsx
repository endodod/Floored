'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-is-mobile'

export default function SurvivalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (isMobile) router.replace('/')
  }, [isMobile, router])

  if (isMobile) return null

  return <>{children}</>
}
