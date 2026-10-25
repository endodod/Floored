'use client'

import { useEffect, useState } from 'react'

/** False during SSR and the first client render — gate localStorage-backed UI on it to avoid hydration mismatches. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
