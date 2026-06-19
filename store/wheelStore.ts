'use client'

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { WheelConfig, WheelEntry, WinnerRecord, WheelMeta, DisplayMode } from '@/types/wheel'
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
  autoRemoveWinner: boolean
  predeterminedWinnerId: string | null
  isPredeterminedMode: boolean
  hidePredeterminedMode: boolean
  showHistory: boolean

  // History
  history: WinnerRecord[]

  // Saved wheels metadata
  savedWheels: WheelMeta[]

  // Entry actions
  addEntries: (entries: WheelEntry[]) => void
  updateEntry: (id: string, patch: Partial<WheelEntry>) => void
  removeEntry: (id: string) => void
  reorderEntries: (fromIndex: number, toIndex: number) => void
  clearEntries: () => void

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
  setAutoRemoveWinner: (v: boolean) => void
  setPredeterminedWinnerId: (id: string | null) => void
  setIsPredeterminedMode: (v: boolean) => void
  setHidePredeterminedMode: (v: boolean) => void
  setShowHistory: (v: boolean) => void

  // History actions
  addToHistory: (record: WinnerRecord) => void
  clearHistory: () => void

  // Persistence actions (implementations filled in Phase 6)
  loadConfig: (config: WheelConfig) => void
  setSavedWheels: (meta: WheelMeta[]) => void
}

export const useWheelStore = create<WheelStore>()(
  immer((set) => ({
    config: DEFAULT_WHEEL_CONFIG,
    isSpinning: false,
    currentAngle: 0,
    winner: null,
    showWinnerModal: false,
    autoRemoveWinner: false,
    predeterminedWinnerId: null,
    isPredeterminedMode: false,
    hidePredeterminedMode: false,
    showHistory: false,
    history: [],
    savedWheels: [],

    addEntries: (entries) =>
      set((s) => { s.config.entries.push(...entries) }),

    updateEntry: (id, patch) =>
      set((s) => {
        const idx = s.config.entries.findIndex(e => e.id === id)
        if (idx !== -1) Object.assign(s.config.entries[idx], patch)
      }),

    removeEntry: (id) =>
      set((s) => {
        s.config.entries = s.config.entries.filter(e => e.id !== id)
      }),

    reorderEntries: (fromIndex, toIndex) =>
      set((s) => {
        const entries = s.config.entries
        const [moved] = entries.splice(fromIndex, 1)
        entries.splice(toIndex, 0, moved)
      }),

    clearEntries: () =>
      set((s) => { s.config.entries = [] }),

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

    setSavedWheels: (meta) =>
      set((s) => { s.savedWheels = meta }),
  }))
)
