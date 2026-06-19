'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import {
  createNewWheel,
  duplicateCurrentWheel,
  loadWheelById,
  deleteWheelById,
} from '@/lib/persistence'

interface Props {
  open: boolean
  onClose: () => void
}

function formatWhen(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * Phase 6 — manage locally saved wheels. Renames go through the existing
 * `setWheelName` action (autosave persists it); new / duplicate / load / delete
 * call the persistence helpers directly.
 */
export default function WheelManagerModal({ open, onClose }: Props) {
  const { config, savedWheels, setWheelName } = useWheelStore()
  const currentId = config.id
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  return (
    <Modal open={open} onClose={onClose} title="Saved wheels" width="max-w-lg">
      <div className="flex flex-col gap-5">
        {/* Current wheel name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
            Current wheel
          </label>
          <input
            type="text"
            value={config.name}
            onChange={e => setWheelName(e.target.value)}
            placeholder="Wheel name"
            className="w-full rounded-lg bg-[var(--row)] border border-[var(--border-mid)] focus:border-[var(--border-accent)] outline-none px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted-dim)]"
          />
        </div>

        {/* Create actions */}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { void createNewWheel() }}>
            + New wheel
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => { void duplicateCurrentWheel() }}>
            Duplicate
          </Button>
        </div>

        {/* Saved list */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
            {savedWheels.length} saved
          </span>

          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {savedWheels.map(w => {
              const isCurrent = w.id === currentId
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-2 rounded-lg bg-[var(--row)] border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text)] truncate">
                      {w.name || 'Untitled wheel'}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--accent-hi)]">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {w.entryCount} {w.entryCount === 1 ? 'entry' : 'entries'} · {formatWhen(w.updatedAt)}
                    </p>
                  </div>

                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { void loadWheelById(w.id).then(onClose) }}
                    >
                      Load
                    </Button>
                  )}

                  {confirmDeleteId === w.id ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setConfirmDeleteId(null)
                        void deleteWheelById(w.id)
                      }}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(w.id)}
                      className="text-[var(--muted-dim)] hover:text-red-400 shrink-0 text-lg leading-none transition-colors px-1"
                      aria-label={`Delete ${w.name}`}
                      title="Delete wheel"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Wheels and uploaded images are saved automatically on this device.
        </p>
      </div>
    </Modal>
  )
}
