'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { v4 as uuid } from 'uuid'
import Button from '@/components/ui/Button'
import Toggle from '@/components/ui/Toggle'
import ImageUploader from '@/components/editor/ImageUploader'
import EntryList from '@/components/editor/EntryList'

export default function EntriesTab() {
  const { config, addEntries, clearEntries } = useWheelStore()
  const entries = config.entries
  const [useFilenames, setUseFilenames] = useState(true)

  function addBlank() {
    addEntries([{ id: uuid(), name: '', imageId: null, imageUrl: null, weight: 1 }])
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Upload zone */}
      <ImageUploader useFilenamesAsNames={useFilenames} />

      {/* Filename toggle */}
      <Toggle
        checked={useFilenames}
        onChange={setUseFilenames}
        label="Use filename as entry name"
      />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
        <div className="flex gap-2">
          {entries.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearEntries}>
              Clear all
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={addBlank}>
            + Add
          </Button>
        </div>
      </div>

      {/* Sortable list */}
      {entries.length === 0 ? (
        <p className="text-center text-[var(--muted-dim)] text-sm py-6">
          Drop images above or click + Add to get started.
        </p>
      ) : (
        <EntryList />
      )}
    </div>
  )
}
