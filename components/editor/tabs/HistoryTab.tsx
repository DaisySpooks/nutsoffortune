'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import Button from '@/components/ui/Button'

export default function HistoryTab() {
  const { history, setHistoryNote } = useWheelStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  function startEdit(recordId: string, currentNote: string) {
    setEditingId(recordId)
    setDraft(currentNote)
  }

  function save(recordId: string) {
    setHistoryNote(recordId, draft)
    setEditingId(null)
  }

  function cancel() {
    setEditingId(null)
    setDraft('')
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-sm text-[var(--muted)]">
        No spins yet — history will appear here after the first spin.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {history.map(record => {
        const isEditing = editingId === record.id
        return (
          <div
            key={record.id}
            className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {record.imageUrl && (
                  <img
                    src={record.imageUrl}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover border border-[var(--border-mid)] shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    {record.name.trim() || 'Unnamed entry'}
                  </p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {new Date(record.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(record.id, record.note ?? '')}
                >
                  {record.note ? 'Edit Note' : 'Add Note'}
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a private note about this result…"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--row)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={cancel}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => save(record.id)}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              record.note && (
                <p className="text-sm text-[var(--muted)] whitespace-pre-wrap break-words">
                  {record.note}
                </p>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
