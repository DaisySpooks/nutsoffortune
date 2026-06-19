'use client'

import { useEffect } from 'react'
import { shallow } from 'zustand/shallow'
import { useWheelStore } from '@/store/wheelStore'
import { hydrateOnMount, isReady, scheduleSave } from '@/lib/persistence'

/**
 * Phase 6 — wires the store to local persistence. Call once at the app root.
 *
 * On mount it rehydrates the active wheel (and its image blobs) from IndexedDB,
 * then subscribes to the persistent slice of the store and autosaves (debounced)
 * whenever it changes. Runtime-only fields (angle, spinning, winner) are excluded
 * from the selector, so spinning the wheel never triggers a save.
 */
export function usePersistence(): void {
  useEffect(() => {
    void hydrateOnMount()

    const unsubscribe = useWheelStore.subscribe(
      (s) => [s.config, s.history, s.autoRemoveWinner] as const,
      () => {
        if (isReady()) scheduleSave()
      },
      { equalityFn: shallow }
    )

    return () => unsubscribe()
  }, [])
}
