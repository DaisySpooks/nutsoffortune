'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { WheelEntry } from '@/types/wheel'
import { v4 as uuid } from 'uuid'
import Button from '@/components/ui/Button'
import Toggle from '@/components/ui/Toggle'
import ImageUploader from '@/components/editor/ImageUploader'
import EntryList from '@/components/editor/EntryList'

// ─── utilities ───────────────────────────────────────────────────────────────

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Balances the wheel using slot placement instead of round-robin.
 *
 * Groups:
 *  - Names that appear more than once → one group per repeated label
 *  - Everything else (unique-name entries, images, unnamed) → one "main prizes" group
 *
 * For each group of size M in a total N-slot array, ideal positions are:
 *   floor((k + phase) × N / M)  for k = 0..M-1
 * where `phase` is a random 0–1 offset so each Balance wheel click varies the
 * starting position while keeping the same even spacing.
 *
 * Groups are placed largest-first. When a target slot is taken, the nearest
 * free slot is found by searching outward ±1, ±2, … (wrapping).
 *
 * A light cleanup pass then swaps adjacent same-label pairs when the swap
 * provably reduces total adjacent-conflict count.
 *
 * Example: 20 image prizes + "25 nuts"×30 + "50 nuts"×10  (N=60)
 *   25nuts fills every-other slot; images fill every-3rd; 50nuts every-6th
 *   → [50,25,img,25,img,25] pattern repeated — no tail clustering
 */
function balanceWheel(entries: WheelEntry[]): WheelEntry[] {
  if (entries.length < 2) return entries
  const N = entries.length

  // ── Build groups ──────────────────────────────────────────────────────────
  const nameCounts = new Map<string, number>()
  for (const e of entries) {
    const name = e.name.trim()
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }

  const repeatedGroups = new Map<string, WheelEntry[]>()
  const mainGroup: WheelEntry[] = []
  for (const e of entries) {
    const name = e.name.trim()
    if (name && (nameCounts.get(name) ?? 0) > 1) {
      if (!repeatedGroups.has(name)) repeatedGroups.set(name, [])
      repeatedGroups.get(name)!.push(e)
    } else {
      mainGroup.push(e)
    }
  }

  const allGroups: { key: string; items: WheelEntry[] }[] = []
  if (mainGroup.length > 0) allGroups.push({ key: '__main__', items: mainGroup })
  for (const [name, grp] of repeatedGroups) allGroups.push({ key: name, items: grp })
  allGroups.sort((a, b) => b.items.length - a.items.length)

  // ── Slot placement — largest group first ──────────────────────────────────
  const output: (WheelEntry | null)[] = new Array(N).fill(null)
  const keyAt: (string | null)[]      = new Array(N).fill(null)

  for (const group of allGroups) {
    const M     = group.items.length
    const phase = Math.random() // rotate starting position for variety each click

    for (let k = 0; k < M; k++) {
      const ideal = Math.floor((k + phase) * N / M) % N

      // Search outward for the nearest free slot, wrapping around the wheel.
      let placed = false
      for (let delta = 0; delta < N && !placed; delta++) {
        const candidates = delta === 0
          ? [ideal]
          : [(ideal + delta) % N, (ideal - delta + N) % N]
        for (const pos of candidates) {
          if (output[pos] === null) {
            output[pos] = group.items[k]
            keyAt[pos]  = group.key
            placed = true
            break
          }
        }
      }
    }
  }

  // ── Light cleanup: reduce adjacent same-label pairs ───────────────────────
  // One forward pass — swap position b with a non-adjacent j when it lowers
  // the total number of same-key neighbours at those two positions.
  for (let i = 0; i < N; i++) {
    const b = (i + 1) % N
    if (keyAt[i] !== keyAt[b]) continue

    const kb    = keyAt[b]!
    const bPrev = keyAt[i]!                    // = kb, guaranteed by the if above
    const bNext = keyAt[(b + 1) % N]

    // conflictsBeforeB: bPrev==kb is always 1; bNext may add 1
    const conflictsBeforeB = 1 + (bNext === kb ? 1 : 0)

    for (let delta = 2; delta < N - 1; delta++) {
      const j  = (b + delta) % N
      const kj = keyAt[j]!
      if (kj === kb) continue                  // same label, no gain

      const jPrev = keyAt[(j - 1 + N) % N]!
      const jNext = keyAt[(j + 1) % N]

      const conflictsBeforeJ = (jPrev === kj ? 1 : 0) + (jNext === kj ? 1 : 0)
      const conflictsAfterB  = (bPrev === kj ? 1 : 0) + (bNext === kj ? 1 : 0)
      const conflictsAfterJ  = (jPrev === kb ? 1 : 0) + (jNext === kb ? 1 : 0)

      if (conflictsAfterB + conflictsAfterJ < conflictsBeforeB + conflictsBeforeJ) {
        const tmp = output[b]; output[b] = output[j]; output[j] = tmp
        keyAt[b] = kj
        keyAt[j] = kb
        break
      }
    }
  }

  return output as WheelEntry[]
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

// ─── bulk-add form ────────────────────────────────────────────────────────────

type BulkRow = { id: string; name: string; count: number }

function makeRow(): BulkRow {
  return { id: uuid(), name: '', count: 2 }
}

// ─── component ───────────────────────────────────────────────────────────────

export default function EntriesTab() {
  const { config, addEntries, clearEntries, setEntries, originalEntries, restoreOriginalEntries } = useWheelStore()
  const entries = config.entries

  const canRestore = originalEntries !== null && (
    entries.length !== originalEntries.length ||
    entries.some((e, i) => e.id !== originalEntries![i]?.id)
  )

  const [useFilenames, setUseFilenames] = useState(true)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([makeRow()])
  const [spreadOnAdd, setSpreadOnAdd] = useState(false)

  function addBlank() {
    addEntries([{ id: uuid(), name: '', imageId: null, imageUrl: null, weight: 1 }])
  }

  function handleShuffle() {
    setEntries(fisherYatesShuffle(entries))
  }

  function handleBalance() {
    setEntries(balanceWheel(entries))
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
      {entries.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleShuffle}
            title="Randomize entry order"
          >
            Shuffle
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleBalance}
            title="Space repeated prize labels evenly around the wheel"
          >
            Balance wheel
          </Button>
          <Button
            size="sm"
            variant={showBulk ? 'secondary' : 'ghost'}
            onClick={() => setShowBulk(v => !v)}
          >
            Bulk add
          </Button>
        </div>
      )}

      {/* Restore snapshot */}
      {canRestore && (
        <Button
          size="sm"
          variant="secondary"
          onClick={restoreOriginalEntries}
          title="Restore the wheel to the full entry list from when it was last loaded"
        >
          Restore Original Entries
        </Button>
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

          {/* Only meaningful when existing entries are already on the wheel */}
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
