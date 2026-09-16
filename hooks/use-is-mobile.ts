'use client'

import { useEffect, useState } from 'react'

/** Matches the app's `sm` breakpoint (Tailwind default: 640px). */
const MOBILE_QUERY = '(max-width: 639px)'

/** SSR-safe: reports `false` until mounted, then tracks the viewport live. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    setIsMobile(mql.matches)
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
