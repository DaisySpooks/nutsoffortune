'use client'

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { WheelConfig, WheelEntry, WinnerRecord, WheelMeta, DisplayMode, WheelMode } from '@/types/wheel'
import { DEFAULT_WHEEL_CONFIG } from '@/lib/constants'
import { v4 as uuid } from 'uuid'

interface WheelStore {
  // Wheel data
  config: WheelConfig

  // Runtime UI
  isSpinning: boolean
  currentAngle: number
  winner: WheelEntry | null
  showWinnerModal: boolean

  // Options
  wheelMode: WheelMode
  autoRemoveWinner: boolean
  predeterminedWinnerId: string | null
  isPredeterminedMode: boolean
  hidePredeterminedMode: boolean
  showHistory: boolean

  // History
  history: WinnerRecord[]

  // Saved wheels metadata
  savedWheels: WheelMeta[]

  // Snapshot of entries at last load — null when no wheel has been loaded or wheel was new
  originalEntries: WheelEntry[] | null

  // Number of image uploads currently in-flight. Drives LiveDrawModal pending state.
  // Using a counter (not a blob: URL scan) so the modal unblocks as soon as all
  // upload promises settle, regardless of whether any blob: URLs remain stale.
  activeUploadCount: number
  incrementUploadCount: (by: number) => void
  decrementUploadCount: () => void

  // Entry actions
  addEntries: (entries: WheelEntry[]) => void
  setEntries: (entries: WheelEntry[]) => void
  insertEntriesAfter: (afterId: string, entries: WheelEntry[]) => void
  updateEntry: (id: string, patch: Partial<WheelEntry>) => void
  removeEntry: (id: string) => void
  // Removes an entry without updating originalEntries — used only by auto-remove
  // so the snapshot of the user's intended wheel is preserved across spins.
  autoRemoveEntry: (id: string) => void
  reorderEntries: (fromIndex: number, toIndex: number) => void
  clearEntries: () => void
  restoreOriginalEntries: () => void

  // Config actions
  setDisplayMode: (mode: DisplayMode) => void
  setTheme: (themeId: string) => void
  setWheelName: (name: string) => void
  updateSounds: (sounds: Partial<WheelConfig['sounds']>) => void
  updateSpin: (spin: Partial<WheelConfig['spin']>) => void
  setBackgroundImageId: (id: string | null) => void

  // Spin actions
  setCurrentAngle: (deg: number) => void
  setIsSpinning: (v: boolean) => void
  setWinner: (entry: WheelEntry | null) => void
  setShowWinnerModal: (v: boolean) => void

  // Option toggles
  setWheelMode: (mode: WheelMode) => void
  setAutoRemoveWinner: (v: boolean) => void
  setPredeterminedWinnerId: (id: string | null) => void
  setIsPredeterminedMode: (v: boolean) => void
  setHidePredeterminedMode: (v: boolean) => void
  setShowHistory: (v: boolean) => void

  // History actions
  addToHistory: (record: WinnerRecord) => void
  clearHistory: () => void

  // Persistence actions
  loadConfig: (config: WheelConfig) => void
  loadWheel: (payload: { config: WheelConfig; history: WinnerRecord[]; autoRemoveWinner: boolean; wheelMode: WheelMode; originalEntries?: WheelEntry[] }) => void
  setSavedWheels: (meta: WheelMeta[]) => void
}

export const useWheelStore = create<WheelStore>()(
  subscribeWithSelector(
  immer((set) => ({
    config: DEFAULT_WHEEL_CONFIG,
    isSpinning: false,
    currentAngle: 0,
    winner: null,
    showWinnerModal: false,
    wheelMode: 'pick-winner' as WheelMode,
    autoRemoveWinner: false,
    predeterminedWinnerId: null,
    isPredeterminedMode: false,
    hidePredeterminedMode: false,
    showHistory: false,
    history: [],
    savedWheels: [],
    originalEntries: null,
    activeUploadCount: 0,
    incrementUploadCount: (by) =>
      set((s) => { s.activeUploadCount += by }),
    decrementUploadCount: () =>
      set((s) => { s.activeUploadCount = Math.max(0, s.activeUploadCount - 1) }),

    addEntries: (entries) =>
      set((s) => {
        s.config.entries.push(...entries)
        s.originalEntries = [...s.config.entries]
      }),

    setEntries: (entries) =>
      set((s) => {
        s.config.entries = entries
        s.originalEntries = entries.length > 0 ? [...entries] : null
      }),

    insertEntriesAfter: (afterId, newEntries) =>
      set((s) => {
        const idx = s.config.entries.findIndex(e => e.id === afterId)
        const pos = idx === -1 ? s.config.entries.length : idx + 1
        s.config.entries.splice(pos, 0, ...newEntries)
        s.originalEntries = [...s.config.entries]
      }),

    updateEntry: (id, patch) =>
      set((s) => {
        const idx = s.config.entries.findIndex(e => e.id === id)
        if (idx !== -1) Object.assign(s.config.entries[idx], patch)
        // Mirror the patch into originalEntries so renames/image changes are
        // reflected when the user later restores.
        if (s.originalEntries) {
          const origIdx = s.originalEntries.findIndex(e => e.id === id)
          if (origIdx !== -1) Object.assign(s.originalEntries[origIdx], patch)
        }
      }),

    removeEntry: (id) =>
      set((s) => {
        s.config.entries = s.config.entries.filter(e => e.id !== id)
        s.originalEntries = s.config.entries.length > 0 ? [...s.config.entries] : null
      }),

    autoRemoveEntry: (id) =>
      set((s) => {
        s.config.entries = s.config.entries.filter(e => e.id !== id)
        // originalEntries intentionally left unchanged — this is the spin auto-remove
        // path, not a user edit. The snapshot must stay intact so the user can restore.
      }),

    reorderEntries: (fromIndex, toIndex) =>
      set((s) => {
        const entries = s.config.entries
        const [moved] = entries.splice(fromIndex, 1)
        entries.splice(toIndex, 0, moved)
        s.originalEntries = [...s.config.entries]
      }),

    clearEntries: () =>
      set((s) => { s.config.entries = []; s.originalEntries = null }),

    restoreOriginalEntries: () =>
      set((s) => {
        if (s.originalEntries) s.config.entries = [...s.originalEntries]
      }),

    setDisplayMode: (mode) =>
      set((s) => { s.config.displayMode = mode }),

    setTheme: (themeId) =>
      set((s) => { s.config.themeId = themeId }),

    setWheelName: (name) =>
      set((s) => { s.config.name = name }),

    updateSounds: (sounds) =>
      set((s) => { Object.assign(s.config.sounds, sounds) }),

    updateSpin: (spin) =>
      set((s) => { Object.assign(s.config.spin, spin) }),

    setBackgroundImageId: (id) =>
      set((s) => { s.config.backgroundImageId = id }),

    setCurrentAngle: (deg) =>
      set((s) => { s.currentAngle = deg }),

    setIsSpinning: (v) =>
      set((s) => { s.isSpinning = v }),

    setWinner: (entry) =>
      set((s) => { s.winner = entry }),

    setShowWinnerModal: (v) =>
      set((s) => { s.showWinnerModal = v }),

    setWheelMode: (mode) =>
      set((s) => { s.wheelMode = mode }),

    setAutoRemoveWinner: (v) =>
      set((s) => { s.autoRemoveWinner = v }),

    setPredeterminedWinnerId: (id) =>
      set((s) => { s.predeterminedWinnerId = id }),

    setIsPredeterminedMode: (v) =>
      set((s) => { s.isPredeterminedMode = v }),

    setHidePredeterminedMode: (v) =>
      set((s) => { s.hidePredeterminedMode = v }),

    setShowHistory: (v) =>
      set((s) => { s.showHistory = v }),

    addToHistory: (record) =>
      set((s) => { s.history.unshift(record) }),

    clearHistory: () =>
      set((s) => { s.history = [] }),

    loadConfig: (config) =>
      set((s) => { s.config = config; s.winner = null; s.currentAngle = 0 }),

    loadWheel: (payload) =>
      set((s) => {
        s.config = payload.config
        s.history = payload.history
        s.autoRemoveWinner = payload.autoRemoveWinner
        s.wheelMode = payload.wheelMode
        // Use the explicitly passed snapshot when available (preserved across
        // autosaves). Fall back to the loaded entries for new/legacy wheels.
        const snap = payload.originalEntries ?? payload.config.entries
        s.originalEntries = snap.length > 0 ? [...snap] : null
        // Reset transient spin state for the freshly loaded wheel.
        s.winner = null
        s.currentAngle = 0
        s.isSpinning = false
        s.showWinnerModal = false
      }),

    setSavedWheels: (meta) =>
      set((s) => { s.savedWheels = meta }),
  }))
  )
)
