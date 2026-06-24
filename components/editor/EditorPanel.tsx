'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import Tabs from '@/components/ui/Tabs'
import EntriesTab from './tabs/EntriesTab'
import SettingsTab from './tabs/SettingsTab'
import WheelManagerModal from '@/components/modals/WheelManagerModal'
import LiveDrawModal from '@/components/modals/LiveDrawModal'

const pill = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border transition-colors'
const pillIdle = 'border-[var(--border-mid)] bg-[var(--panel-raised)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--border-accent)]'
const pillActive = 'border-[var(--border-accent)] bg-[var(--accent)]/15 text-[var(--gold)] shadow-[0_0_12px_-4px_var(--glow)]'

interface Props {
  editMode: boolean
  canEdit: boolean
  isDesktop: boolean
  isSpinning: boolean
  onToggleEdit: () => void
  onHide: () => void
}

export default function EditorPanel({ editMode, canEdit, isDesktop, isSpinning, onToggleEdit, onHide }: Props) {
  const [showManager, setShowManager] = useState(false)
  const [showLive, setShowLive] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-mid)] flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-[0.18em]">Editor</h2>
        <div className="flex items-center gap-1.5">
          {isDesktop && (
            <button
              onClick={onToggleEdit}
              disabled={isSpinning}
              aria-pressed={canEdit}
              className={clsx(pill, canEdit ? pillActive : pillIdle, 'disabled:opacity-40 disabled:cursor-not-allowed')}
            >
              {canEdit ? '✓ Adjust' : 'Adjust'}
            </button>
          )}
          <button onClick={() => setShowManager(true)} className={clsx(pill, pillIdle)}>
            Wheels
          </button>
          <button onClick={() => setShowLive(true)} className={clsx(pill, pillIdle)}>
            Live
          </button>
          {isDesktop && (
            <button onClick={onHide} className={clsx(pill, pillIdle)}>
              Hide
            </button>
          )}
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
      <LiveDrawModal open={showLive} onClose={() => setShowLive(false)} />
    </div>
  )
}
