'use client'

import { useState } from 'react'
import Tabs from '@/components/ui/Tabs'
import EntriesTab from './tabs/EntriesTab'
import SettingsTab from './tabs/SettingsTab'
import Button from '@/components/ui/Button'
import WheelManagerModal from '@/components/modals/WheelManagerModal'

export default function EditorPanel() {
  const [showManager, setShowManager] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-mid)] flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--gold)] uppercase tracking-[0.18em]">Editor</h2>
        <Button size="sm" variant="secondary" onClick={() => setShowManager(true)}>
          Wheels
        </Button>
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
