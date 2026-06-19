export type DisplayMode = 'text-only' | 'image-text' | 'image-full' | 'image-full-text'

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

export interface WheelFile {
  version: '1.0'
  exportedAt: number
  config: Omit<WheelConfig, never>
  images: Record<string, string> // imageId → base64 data URL
}
