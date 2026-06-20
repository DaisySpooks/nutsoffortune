'use client'

import { useWheelStore } from '@/store/wheelStore'
import { THEME_PRESETS, DISPLAY_MODES } from '@/lib/constants'
import { WheelMode } from '@/types/wheel'
import { clsx } from 'clsx'
import Slider from '@/components/ui/Slider'
import Toggle from '@/components/ui/Toggle'

const DURATION_MIN = 1000
const DURATION_MAX = 12000
const DURATION_STEP = 500

export default function SettingsTab() {
  const {
    config,
    wheelMode,
    autoRemoveWinner,
    setDisplayMode,
    setTheme,
    updateSpin,
    updateSounds,
    setAutoRemoveWinner,
    setWheelMode,
  } = useWheelStore()

  const { displayMode, themeId, spin, sounds } = config

  const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`

  function setMin(v: number) {
    updateSpin({ minDuration: v, maxDuration: Math.max(v, spin.maxDuration) })
  }
  function setMax(v: number) {
    updateSpin({ maxDuration: v, minDuration: Math.min(v, spin.minDuration) })
  }

  const WHEEL_MODES: { value: WheelMode; label: string; description: string }[] = [
    { value: 'pick-winner', label: 'Pick a Winner', description: 'Spin to select a person' },
    { value: 'spin-for-prize', label: 'Spin for a Prize', description: 'Spin to reveal a prize' },
  ]

  return (
    <div className="flex flex-col gap-6 p-4">

      {/* ── Wheel mode ── */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Wheel mode
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {WHEEL_MODES.map(mode => (
            <button
              key={mode.value}
              onClick={() => setWheelMode(mode.value)}
              className={clsx(
                'flex flex-col gap-0.5 rounded-lg px-3 py-2 border transition-colors text-left',
                wheelMode === mode.value
                  ? 'border-[var(--border-accent)] bg-[var(--panel-raised)]'
                  : 'border-[var(--border)] hover:border-[var(--border-mid)]'
              )}
            >
              <span className={clsx(
                'text-sm font-medium leading-snug',
                wheelMode === mode.value ? 'text-[var(--gold)]' : 'text-[var(--text)]'
              )}>
                {mode.label}
              </span>
              <span className="text-[11px] text-[var(--muted)] leading-tight">
                {mode.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Display mode ── */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Display
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {DISPLAY_MODES.map(mode => (
            <button
              key={mode.value}
              onClick={() => setDisplayMode(mode.value)}
              className={clsx(
                'flex flex-col gap-0.5 rounded-lg px-3 py-2 border transition-colors text-left',
                displayMode === mode.value
                  ? 'border-[var(--border-accent)] bg-[var(--panel-raised)]'
                  : 'border-[var(--border)] hover:border-[var(--border-mid)]'
              )}
            >
              <span className={clsx(
                'text-sm font-medium leading-snug',
                displayMode === mode.value ? 'text-[var(--gold)]' : 'text-[var(--text)]'
              )}>
                {mode.label}
              </span>
              <span className="text-[11px] text-[var(--muted)] leading-tight">
                {mode.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Theme ── */}
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
              <span className="flex h-5 w-9 shrink-0 overflow-hidden rounded ring-1 ring-black/30">
                {preset.sliceColors.slice(0, 5).map((c, i) => (
                  <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className={clsx(
                'text-sm',
                themeId === preset.id ? 'text-[var(--gold)] font-medium' : 'text-[var(--text)]'
              )}>
                {preset.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Spin duration ── */}
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
          Each spin picks a random duration between these two values.
        </p>
      </section>

      {/* ── After a spin ── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          After a spin
        </h3>
        <Toggle
          checked={autoRemoveWinner}
          onChange={setAutoRemoveWinner}
          label={wheelMode === 'spin-for-prize' ? 'Remove the prize from the wheel' : 'Remove the winner from the wheel'}
        />
      </section>

      {/* ── Sound ── */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Sound
        </h3>
        <Toggle
          checked={sounds.enabled}
          onChange={v => updateSounds({ enabled: v })}
          label="Sound effects"
        />
        {sounds.enabled && (
          <Slider
            label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={sounds.volume}
            onChange={v => updateSounds({ volume: v })}
            formatValue={v => `${Math.round(v * 100)}%`}
          />
        )}
      </section>

    </div>
  )
}
