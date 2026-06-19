'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks a CSS media query. Starts `false` on the server / first paint and
 * updates after mount, so it never causes an SSR hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return matches
}
