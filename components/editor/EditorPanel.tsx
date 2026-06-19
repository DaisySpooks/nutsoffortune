'use client'

import Tabs from '@/components/ui/Tabs'
import EntriesTab from './tabs/EntriesTab'
import SettingsTab from './tabs/SettingsTab'
import WheelTab from './tabs/WheelTab'
import { useWheelStore } from '@/store/wheelStore'
import { DisplayMode } from '@/types/wheel'
import { clsx } from 'clsx'

// TODO Phase 5: remove this dev strip once the real settings tab has a display mode selector
const MODES: { value: DisplayMode; label: string }[] = [
  { value: 'text-only',       label: 'Text' },
  { value: 'image-text',      label: 'Img+Text' },
  { value: 'image-full',      label: 'Full Img' },
  { value: 'image-full-text', label: 'Full+Text' },
]

function DevModeStrip() {
  const { config, setDisplayMode } = useWheelStore()
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)] bg-[var(--app-bg-deep)]">
      <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider shrink-0">
        Dev
      </span>
      {MODES.map(m => (
        <button
          key={m.value}
          onClick={() => setDisplayMode(m.value)}
          className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium transition-colors',
            config.displayMode === m.value
              ? 'bg-[var(--accent)] text-[#2a1606]'
              : 'bg-[var(--panel-raised)] text-[var(--muted)] hover:text-[var(--gold)]'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

export default function EditorPanel() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-mid)]">
        <h2 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-[0.18em]">Editor</h2>
      </div>

      {/* Dev-only display mode strip — delete this block in Phase 5 */}
      <DevModeStrip />

      <div className="flex-1 overflow-hidden">
        <Tabs
          tabs={[
            { id: 'entries', label: 'Entries', content: <EntriesTab /> },
            { id: 'settings', label: 'Settings', content: <SettingsTab /> },
            { id: 'wheel', label: 'Wheel', content: <WheelTab /> },
          ]}
          defaultTab="entries"
        />
      </div>
    </div>
  )
}
