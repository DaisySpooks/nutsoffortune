'use client'

import { useState, useMemo } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { WheelEntry } from '@/types/wheel'
import { v4 as uuid } from 'uuid'
import Button from '@/components/ui/Button'
import Toggle from '@/components/ui/Toggle'
import ImageUploader from '@/components/editor/ImageUploader'
import EntryList from '@/components/editor/EntryList'

// ─── utilities ───────────────────────────────────────────────────────────────

function fisherYatesShuffle(arr: WheelEntry[]): WheelEntry[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Merges `added` entries evenly into `existing` using evenly-spaced target
 * positions. Each new entry k lands at round((k + 0.5) × total / N).
 *
 * Example: 3 existing [A,B,C] + 6 new → [A, n, n, B, n, n, C, n, n]
 */
function interleaveInto(existing: WheelEntry[], added: WheelEntry[]): WheelEntry[] {
  if (existing.length === 0) return added
  if (added.length === 0) return existing

  const M = existing.length
  const N = added.length
  const total = M + N

  // Target slot in the final array for each added entry.
  const targets = Array.from({ length: N }, (_, k) =>
    Math.round((k + 0.5) * total / N)
  )

  const result: WheelEntry[] = []
  let nIdx = 0
  let eIdx = 0

  for (let i = 0; i < total; i++) {
    const newReady  = nIdx < N && targets[nIdx] <= i
    const existLeft = eIdx < M

    if (newReady || !existLeft) {
      result.push(added[nIdx++])
    } else {
      result.push(existing[eIdx++])
    }
  }

  return result
}

// ─── bulk-add form state ──────────────────────────────────────────────────────

type BulkRow = { id: string; name: string; count: number }

function makeRow(): BulkRow {
  return { id: uuid(), name: '', count: 2 }
}

// ─── component ───────────────────────────────────────────────────────────────

export default function EntriesTab() {
  const { config, addEntries, clearEntries, setEntries } = useWheelStore()
  const entries = config.entries

  const [useFilenames, setUseFilenames] = useState(true)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([makeRow()])
  const [spreadOnAdd, setSpreadOnAdd] = useState(false)
  const [spreadLabel, setSpreadLabel] = useState('')

  // Names that appear more than once — drives the re-spread control.
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entries) {
      const name = e.name.trim()
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .filter(([, n]) => n > 1)
      .map(([name]) => name)
      .sort()
  }, [entries])

  // Fall back to the first available duplicate if the current selection disappears.
  const activeSpreadLabel = duplicateNames.includes(spreadLabel)
    ? spreadLabel
    : (duplicateNames[0] ?? '')

  function addBlank() {
    addEntries([{ id: uuid(), name: '', imageId: null, imageUrl: null, weight: 1 }])
  }

  function handleShuffle() {
    setEntries(fisherYatesShuffle(entries))
  }

  function handleSpread() {
    if (!activeSpreadLabel) return
    const selected  = entries.filter(e => e.name.trim() === activeSpreadLabel)
    const remaining = entries.filter(e => e.name.trim() !== activeSpreadLabel)
    // If nothing to spread into, leave as-is.
    if (remaining.length === 0) return
    setEntries(interleaveInto(remaining, selected))
  }

  // ── bulk form handlers ──
  function addBulkRow() {
    setBulkRows(rows => [...rows, makeRow()])
  }

  function removeBulkRow(id: string) {
    setBulkRows(rows => (rows.length > 1 ? rows.filter(r => r.id !== id) : rows))
  }

  function updateBulkRow(id: string, patch: Partial<Omit<BulkRow, 'id'>>) {
    setBulkRows(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function commitBulk() {
    const newEntries: WheelEntry[] = []
    for (const row of bulkRows) {
      const name = row.name.trim()
      if (!name) continue
      const count = Math.max(1, Math.min(100, row.count || 1))
      for (let i = 0; i < count; i++) {
        newEntries.push({ id: uuid(), name, imageId: null, imageUrl: null, weight: 1 })
      }
    }
    if (newEntries.length > 0) {
      if (spreadOnAdd && entries.length > 0) {
        setEntries(interleaveInto(entries, newEntries))
      } else {
        addEntries(newEntries)
      }
    }
    setShowBulk(false)
    setBulkRows([makeRow()])
  }

  function cancelBulk() {
    setShowBulk(false)
    setBulkRows([makeRow()])
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

      {/* Tools row */}
      <div className="flex flex-wrap gap-2">
        {entries.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleShuffle}
            title="Randomize entry order"
          >
            Shuffle
          </Button>
        )}
        <Button
          size="sm"
          variant={showBulk ? 'secondary' : 'ghost'}
          onClick={() => setShowBulk(v => !v)}
        >
          Bulk add
        </Button>
      </div>

      {/* Re-spread control — only when a repeated label exists */}
      {duplicateNames.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--muted)] shrink-0">Spread prize:</span>
          <select
            value={activeSpreadLabel}
            onChange={e => setSpreadLabel(e.target.value)}
            className="flex-1 min-w-0 bg-[var(--row)] border border-[var(--border)] rounded-md px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--border-accent)] transition-colors"
          >
            {duplicateNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSpread}
            disabled={!activeSpreadLabel}
            title={`Distribute all "${activeSpreadLabel}" entries evenly through the rest of the wheel`}
          >
            Spread through wheel
          </Button>
        </div>
      )}

      {/* Bulk add form */}
      {showBulk && (
        <div className="rounded-lg border border-[var(--border-mid)] bg-[var(--panel-raised)] p-3 flex flex-col gap-2.5">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wider font-medium">
            Add repeated entries
          </p>

          {bulkRows.map(row => (
            <div key={row.id} className="flex items-center gap-2">
              <input
                type="text"
                value={row.name}
                onChange={e => updateBulkRow(row.id, { name: e.target.value })}
                placeholder="Entry name"
                className="flex-1 bg-[var(--row)] border border-[var(--border)] rounded-md px-2 py-1 text-sm text-[var(--text)] placeholder-[var(--muted-dim)] outline-none focus:border-[var(--border-accent)] min-w-0 transition-colors"
              />
              <span className="text-sm text-[var(--muted)] shrink-0">×</span>
              <input
                type="number"
                min={1}
                max={100}
                value={row.count}
                onChange={e => updateBulkRow(row.id, { count: Number(e.target.value) })}
                className="w-14 bg-[var(--row)] border border-[var(--border)] rounded-md px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--border-accent)] text-center transition-colors"
              />
              {bulkRows.length > 1 && (
                <button
                  onClick={() => removeBulkRow(row.id)}
                  className="text-[var(--muted-dim)] hover:text-red-400 shrink-0 text-lg leading-none transition-colors"
                  aria-label="Remove row"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addBulkRow}
            className="text-xs text-[var(--muted)] hover:text-[var(--gold)] text-left transition-colors w-fit"
          >
            + Add another
          </button>

          {/* Spread toggle — only meaningful when there are existing entries */}
          {entries.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={spreadOnAdd}
                onChange={e => setSpreadOnAdd(e.target.checked)}
                className="accent-[var(--accent-hi)] w-3.5 h-3.5 rounded"
              />
              <span className="text-xs text-[var(--muted)]">
                Spread evenly through existing wheel
              </span>
            </label>
          )}

          <div className="flex gap-2 pt-0.5">
            <Button size="sm" variant="primary" onClick={commitBulk}>
              Add to wheel
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelBulk}>
              Cancel
            </Button>
          </div>
        </div>
      )}

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
