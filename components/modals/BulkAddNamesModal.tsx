'use client'

import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useWheelStore } from '@/store/wheelStore'
import { WheelEntry } from '@/types/wheel'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
}

export default function BulkAddNamesModal({ open, onClose }: Props) {
  const { addEntries, setEntries } = useWheelStore()
  const [text, setText] = useState('')
  const [clearFirst, setClearFirst] = useState(false)

  function handleClose() {
    setText('')
    setClearFirst(false)
    onClose()
  }

  function handleSubmit() {
    const names = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    const newEntries: WheelEntry[] = names.map(name => ({
      id: uuid(),
      name,
      imageId: null,
      imageUrl: null,
      weight: 1,
    }))

    if (newEntries.length > 0) {
      if (clearFirst) {
        setEntries(newEntries)
      } else {
        addEntries(newEntries)
      }
    }

    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Add Names" width="max-w-md">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--muted)]">
          Paste a list of names, one per line. Blank lines are ignored.
        </p>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'Jane Doe\nJohn Smith\nAlex Lee'}
          rows={10}
          className="w-full resize-y bg-[var(--row)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted-dim)] outline-none focus:border-[var(--border-accent)] transition-colors font-mono"
        />

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={clearFirst}
            onChange={e => setClearFirst(e.target.checked)}
            className="accent-[var(--accent-hi)] w-3.5 h-3.5 rounded"
          />
          <span className="text-xs text-[var(--muted)]">
            Clear existing entries first
          </span>
        </label>

        <div className="flex gap-2 pt-0.5">
          <Button size="sm" variant="primary" onClick={handleSubmit}>
            Add to wheel
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
