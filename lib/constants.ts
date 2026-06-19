import { ThemePreset, WheelConfig, DisplayMode } from '@/types/wheel'
import { v4 as uuid } from 'uuid'

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic',
    label: 'Classic',
    sliceColors: ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#8bc34a'],
    textColor: '#ffffff',
    borderColor: '#ffffff',
    pointerColor: '#e74c3c',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'pastel',
    label: 'Pastel',
    sliceColors: ['#ffb3ba','#ffdfba','#ffffba','#baffc9','#bae1ff','#d4baff','#ffbaf3','#c9ffba','#ffd4ba','#baecff'],
    textColor: '#555555',
    borderColor: '#ffffff',
    pointerColor: '#ff8fab',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'dark',
    label: 'Dark',
    sliceColors: ['#1a1a2e','#16213e','#0f3460','#533483','#2d6a4f','#1b4332','#3d0000','#4a0e8f','#004e89','#1a472a'],
    textColor: '#ffffff',
    borderColor: '#444444',
    pointerColor: '#e94560',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'neon',
    label: 'Neon',
    sliceColors: ['#ff0080','#ff00ff','#8000ff','#0080ff','#00ffff','#00ff80','#80ff00','#ffff00','#ff8000','#ff0040'],
    textColor: '#ffffff',
    borderColor: '#ffffff',
    pointerColor: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    sliceColors: ['#03045e','#023e8a','#0077b6','#0096c7','#00b4d8','#48cae4','#90e0ef','#ade8f4','#caf0f8','#0077b6'],
    textColor: '#ffffff',
    borderColor: '#ffffff',
    pointerColor: '#00b4d8',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    sliceColors: ['#ff6b6b','#ff8e53','#ff7043','#ff4081','#e040fb','#7c4dff','#ff6d00','#ffab00','#f50057','#aa00ff'],
    textColor: '#ffffff',
    borderColor: '#ffffff',
    pointerColor: '#ff6b6b',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'forest',
    label: 'Forest',
    sliceColors: ['#1b4332','#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2','#6b4226','#8b5e3c','#a47551','#3a5a40'],
    textColor: '#ffffff',
    borderColor: '#ffffff',
    pointerColor: '#52b788',
    fontFamily: 'system-ui, sans-serif',
  },
  {
    id: 'mono',
    label: 'Mono',
    sliceColors: ['#111111','#222222','#333333','#444444','#555555','#666666','#777777','#888888','#999999','#aaaaaa'],
    textColor: '#ffffff',
    borderColor: '#ffffff',
    pointerColor: '#ffffff',
    fontFamily: 'system-ui, sans-serif',
  },
]

export const DISPLAY_MODES: { value: DisplayMode; label: string; description: string }[] = [
  { value: 'text-only',        label: 'Text only',          description: 'Names on colored slices' },
  { value: 'image-text',       label: 'Image + text',       description: 'Thumbnail with name' },
  { value: 'image-full',       label: 'Full image',         description: 'Photo fills each slice' },
  { value: 'image-full-text',  label: 'Image + overlay',    description: 'Photo with name overlay' },
]

export const DEFAULT_ENTRIES = [
  'Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank',
].map(name => ({
  id: uuid(),
  name,
  imageId: null,
  imageUrl: null,
  weight: 1,
}))

export const DEFAULT_WHEEL_CONFIG: WheelConfig = {
  id: uuid(),
  name: 'My Wheel',
  entries: DEFAULT_ENTRIES,
  displayMode: 'text-only',
  themeId: 'classic',
  backgroundImageId: null,
  sounds: { enabled: true, volume: 0.6 },
  spin: { minDuration: 4000, maxDuration: 8000 },
}
