export type DisplayMode = 'text-only' | 'image-text' | 'image-full' | 'image-full-text'
export type WheelMode = 'pick-winner' | 'spin-for-prize'

export interface WheelEntry {
  id: string
  name: string
  imageId: string | null   // IndexedDB key
  imageUrl: string | null  // runtime object URL, never persisted
  weight: number
  color?: string           // per-entry slice color override
}

export interface ThemePreset {
  id: string
  label: string
  sliceColors: string[]
  textColor: string
  borderColor: string
  pointerColor: string
  fontFamily: string
}

export interface WheelConfig {
  id: string
  name: string
  entries: WheelEntry[]
  displayMode: DisplayMode
  themeId: string
  backgroundImageId: string | null
  sounds: { enabled: boolean; volume: number }
  spin: { minDuration: number; maxDuration: number }
}

export interface WinnerRecord {
  id: string
  entryId: string
  name: string
  imageUrl: string | null
  timestamp: number
}

export interface WheelMeta {
  id: string
  name: string
  entryCount: number
  createdAt: number
  updatedAt: number
}

/**
 * A wheel as persisted in IndexedDB. Entry/winner `imageUrl`s are stripped on
 * save (object URLs are session-only); images are stored as blobs keyed by
 * `imageId` in the separate `images` store and rehydrated on load.
 */
export interface StoredWheel {
  id: string
  name: string
  config: WheelConfig
  history: WinnerRecord[]
  autoRemoveWinner: boolean
  wheelMode: WheelMode
  createdAt: number
  updatedAt: number
  // Full entry list at the time the wheel was first loaded/created. Stored
  // separately so autosave of reduced entries (via auto-remove) cannot clobber
  // it. Absent on wheels saved before this field was introduced; those fall
  // back to using config.entries as the snapshot on first load.
  originalEntries?: WheelEntry[]
}

export interface WheelFile {
  version: '1.0'
  exportedAt: number
  config: Omit<WheelConfig, never>
  images: Record<string, string> // imageId → base64 data URL
}
