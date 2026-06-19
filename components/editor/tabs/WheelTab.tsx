'use client'

import { useWheelStore } from '@/store/wheelStore'
import { THEME_PRESETS } from '@/lib/constants'
import { clsx } from 'clsx'
import Slider from '@/components/ui/Slider'
import Toggle from '@/components/ui/Toggle'

// Spin-duration bounds (milliseconds) exposed to the sliders.
const DURATION_MIN = 1000
const DURATION_MAX = 12000
const DURATION_STEP = 500

export default function WheelTab() {
  const { config, autoRemoveWinner, setTheme, updateSpin, setAutoRemoveWinner } = useWheelStore()
  const { themeId, spin } = config

  const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`

  // Keep min ≤ max while either slider moves.
  function setMin(v: number) {
    updateSpin({ minDuration: v, maxDuration: Math.max(v, spin.maxDuration) })
  }
  function setMax(v: number) {
    updateSpin({ maxDuration: v, minDuration: Math.min(v, spin.minDuration) })
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Theme presets */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Theme
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => setTheme(preset.id)}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-2.5 py-2 border transition-colors text-left',
                themeId === preset.id
                  ? 'border-[var(--border-accent)] bg-[var(--panel-raised)]'
                  : 'border-[var(--border)] hover:border-[var(--border-mid)]'
              )}
            >
              {/* Swatch strip — preview of the (independent) slice palette */}
              <span className="flex h-5 w-9 shrink-0 overflow-hidden rounded ring-1 ring-black/30">
                {preset.sliceColors.slice(0, 5).map((c, i) => (
                  <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span
                className={clsx(
                  'text-sm',
                  themeId === preset.id ? 'text-[var(--gold)] font-medium' : 'text-[var(--text)]'
                )}
              >
                {preset.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Spin feel */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Spin duration
        </h3>
        <Slider
          label="Minimum"
          min={DURATION_MIN}
          max={DURATION_MAX}
          step={DURATION_STEP}
          value={spin.minDuration}
          onChange={setMin}
          formatValue={formatSeconds}
        />
        <Slider
          label="Maximum"
          min={DURATION_MIN}
          max={DURATION_MAX}
          step={DURATION_STEP}
          value={spin.maxDuration}
          onChange={setMax}
          formatValue={formatSeconds}
        />
        <p className="text-xs text-[var(--muted)]">
          Each spin lasts a random time between these two values.
        </p>
      </section>

      {/* Behaviour */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          After a spin
        </h3>
        <Toggle
          checked={autoRemoveWinner}
          onChange={setAutoRemoveWinner}
          label="Remove the winner from the wheel"
        />
      </section>
    </div>
  )
}
