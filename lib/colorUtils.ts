import { THEME_PRESETS } from './constants'
import { ThemePreset } from '@/types/wheel'

export function getTheme(themeId: string): ThemePreset {
  return THEME_PRESETS.find(t => t.id === themeId) ?? THEME_PRESETS[0]
}

export function getSliceColor(theme: ThemePreset, index: number): string {
  return theme.sliceColors[index % theme.sliceColors.length]
}

export function applyThemeToCssVars(theme: ThemePreset) {
  const root = document.documentElement
  theme.sliceColors.forEach((color, i) => {
    root.style.setProperty(`--wof-slice-${i}`, color)
  })
  root.style.setProperty('--wof-text', theme.textColor)
  root.style.setProperty('--wof-border', theme.borderColor)
  root.style.setProperty('--wof-pointer', theme.pointerColor)
}
