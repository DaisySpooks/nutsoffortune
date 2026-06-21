'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import Tabs from '@/components/ui/Tabs'
import EntriesTab from './tabs/EntriesTab'
import SettingsTab from './tabs/SettingsTab'
import Button from '@/components/ui/Button'
import WheelManagerModal from '@/components/modals/WheelManagerModal'

interface Props {
  editMode: boolean
  canEdit: boolean
  isDesktop: boolean
  isSpinning: boolean
  onToggleEdit: () => void
}

export default function EditorPanel({ editMode, canEdit, isDesktop, isSpinning, onToggleEdit }: Props) {
  const [showManager, setShowManager] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-mid)] flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-[0.18em]">Editor</h2>
        <div className="flex items-center gap-2">
          {isDesktop && (
            <button
              onClick={onToggleEdit}
              disabled={isSpinning}
              aria-pressed={canEdit}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                canEdit
                  ? 'border-[var(--border-accent)] bg-[var(--accent)]/15 text-[var(--gold)] shadow-[0_0_12px_-4px_var(--glow)]'
                  : 'border-[var(--border-mid)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--border-accent)]'
              )}
            >
              {canEdit ? '✓ Adjusting' : 'Adjust Slices'}
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setShowManager(true)}>
            Wheels
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs
          tabs={[
            { id: 'entries',  label: 'Entries',  content: <EntriesTab /> },
            { id: 'settings', label: 'Settings', content: <SettingsTab /> },
          ]}
          defaultTab="entries"
        />
      </div>

      <WheelManagerModal open={showManager} onClose={() => setShowManager(false)} />
    </div>
  )
}
