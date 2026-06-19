'use client'

import { v4 as uuid } from 'uuid'
import { useWheelStore } from '@/store/wheelStore'
import { StoredWheel, WheelConfig, WheelEntry, WheelMeta } from '@/types/wheel'
import * as db from '@/lib/db'

// ── Phase 6: local persistence orchestration ─────────────────────────────────
// Bridges the in-memory zustand store and IndexedDB. The store keeps live object
// URLs (`imageUrl`) for rendering; those are session-only and are stripped when
// a wheel is written. On load, blobs are read back and fresh object URLs created.
//
// localStorage holds only one lightweight value: the id of the active wheel, so
// a refresh reopens it. Everything else (wheels + image blobs) lives in IndexedDB.

const CURRENT_KEY = 'nof:currentWheelId'
const SAVE_DEBOUNCE_MS = 600

let ready = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

export function isReady(): boolean {
  return ready
}

// ── localStorage pointer ─────────────────────────────────────────────────────

function readCurrentId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}

function writeCurrentId(id: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, id)
  } catch {
    /* storage may be unavailable (private mode) — persistence degrades silently */
  }
}

// ── Serialization helpers ────────────────────────────────────────────────────

function stripEntryUrls(entries: WheelEntry[]): WheelEntry[] {
  // Object URLs are session-only; persist the imageId, drop the URL.
  return entries.map(e => ({ ...e, imageUrl: null }))
}

function toMeta(r: StoredWheel): WheelMeta {
  return {
    id: r.id,
    name: r.name,
    entryCount: r.config.entries.length,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

async function refreshMeta(): Promise<void> {
  try {
    const all = await db.getAllWheelRecords()
    all.sort((a, b) => b.updatedAt - a.updatedAt)
    useWheelStore.getState().setSavedWheels(all.map(toMeta))
  } catch (e) {
    console.warn('[persistence] refreshMeta failed', e)
  }
}

/** Recreate live object URLs for entries that have a stored image blob. */
async function hydrateEntryUrls(entries: WheelEntry[]): Promise<WheelEntry[]> {
  return Promise.all(
    entries.map(async e => {
      if (!e.imageId) return { ...e, imageUrl: null }
      try {
        const blob = await db.getImageBlob(e.imageId)
        if (blob) return { ...e, imageUrl: URL.createObjectURL(blob) }
      } catch (err) {
        console.warn('[persistence] image hydrate failed', e.imageId, err)
      }
      return { ...e, imageUrl: null }
    })
  )
}

/** Revoke the current wheel's object URLs before we swap wheels (avoid leaks). */
function revokeCurrentUrls(): void {
  const { config } = useWheelStore.getState()
  config.entries.forEach(e => {
    if (e.imageUrl) URL.revokeObjectURL(e.imageUrl)
  })
}

// ── Public: image storage (used by the uploader) ─────────────────────────────

export async function storeImageBlob(id: string, file: Blob): Promise<void> {
  try {
    await db.putImageBlob(id, file)
  } catch (e) {
    console.warn('[persistence] storeImageBlob failed', e)
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────

export async function saveCurrentWheel(): Promise<void> {
  try {
    const s = useWheelStore.getState()
    const id = s.config.id
    const prev = await db.getWheelRecord(id)
    const now = Date.now()

    const record: StoredWheel = {
      id,
      name: s.config.name,
      config: { ...s.config, entries: stripEntryUrls(s.config.entries) },
      history: s.history.map(h => ({ ...h, imageUrl: null })),
      autoRemoveWinner: s.autoRemoveWinner,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    }

    await db.putWheelRecord(record)
    writeCurrentId(id)
    await refreshMeta()
  } catch (e) {
    console.warn('[persistence] saveCurrentWheel failed', e)
  }
}

/** Debounced autosave — called by the store subscription on persistent changes. */
export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveCurrentWheel()
  }, SAVE_DEBOUNCE_MS)
}

// ── Load ─────────────────────────────────────────────────────────────────────

export async function loadWheelById(id: string): Promise<boolean> {
  try {
    const rec = await db.getWheelRecord(id)
    if (!rec) return false

    revokeCurrentUrls()
    const entries = await hydrateEntryUrls(rec.config.entries)
    const config: WheelConfig = { ...rec.config, entries }

    useWheelStore.getState().loadWheel({
      config,
      history: rec.history,
      autoRemoveWinner: rec.autoRemoveWinner,
    })
    writeCurrentId(id)
    await refreshMeta()
    return true
  } catch (e) {
    console.warn('[persistence] loadWheelById failed', e)
    return false
  }
}

// ── New / duplicate ──────────────────────────────────────────────────────────

export async function createNewWheel(): Promise<void> {
  revokeCurrentUrls()
  const id = uuid()
  const config: WheelConfig = {
    id,
    name: 'New Wheel',
    entries: [],
    displayMode: 'text-only',
    themeId: 'classic',
    backgroundImageId: null,
    sounds: { enabled: true, volume: 0.6 },
    spin: { minDuration: 4000, maxDuration: 8000 },
  }
  useWheelStore.getState().loadWheel({ config, history: [], autoRemoveWinner: false })
  await saveCurrentWheel()
}

export async function duplicateCurrentWheel(): Promise<void> {
  try {
    // Make sure the source is persisted before copying it.
    await saveCurrentWheel()

    const s = useWheelStore.getState()
    const now = Date.now()
    const newId = uuid()
    const copyName = `${s.config.name} copy`

    // The copy shares the same imageIds (blobs); orphan GC on delete keeps shared
    // blobs alive as long as any wheel references them.
    const record: StoredWheel = {
      id: newId,
      name: copyName,
      config: { ...s.config, id: newId, name: copyName, entries: stripEntryUrls(s.config.entries) },
      history: [],
      autoRemoveWinner: s.autoRemoveWinner,
      createdAt: now,
      updatedAt: now,
    }

    await db.putWheelRecord(record)
    await loadWheelById(newId) // switch to the copy with fresh object URLs
  } catch (e) {
    console.warn('[persistence] duplicateCurrentWheel failed', e)
  }
}

// ── Delete (with image garbage collection) ───────────────────────────────────

export async function deleteWheelById(id: string): Promise<void> {
  try {
    await db.deleteWheelRecord(id)

    const currentId = useWheelStore.getState().config.id
    if (currentId === id) {
      // Deleted the active wheel — open the most recent remaining one, or start fresh.
      const all = await db.getAllWheelRecords()
      if (all.length) {
        all.sort((a, b) => b.updatedAt - a.updatedAt)
        await loadWheelById(all[0].id)
      } else {
        await createNewWheel()
      }
    } else {
      await refreshMeta()
    }

    // GC after the active wheel is resolved, so the reference set reflects the
    // final state (e.g. deleting the last wheel that held an image's sole ref).
    await garbageCollectImages()
  } catch (e) {
    console.warn('[persistence] deleteWheelById failed', e)
  }
}

/** Remove image blobs not referenced by any saved wheel or the in-memory one. */
async function garbageCollectImages(): Promise<void> {
  try {
    const referenced = new Set<string>()
    const all = await db.getAllWheelRecords()
    for (const r of all) {
      for (const e of r.config.entries) if (e.imageId) referenced.add(e.imageId)
      if (r.config.backgroundImageId) referenced.add(r.config.backgroundImageId)
    }
    // Include the live current wheel — it may hold images not yet autosaved.
    const cur = useWheelStore.getState().config
    for (const e of cur.entries) if (e.imageId) referenced.add(e.imageId)
    if (cur.backgroundImageId) referenced.add(cur.backgroundImageId)

    const keys = await db.getAllImageKeys()
    await Promise.all(keys.filter(k => !referenced.has(k)).map(k => db.deleteImageBlob(k)))
  } catch (e) {
    console.warn('[persistence] garbageCollectImages failed', e)
  }
}

// ── Bootstrap (called once on mount) ─────────────────────────────────────────

export async function hydrateOnMount(): Promise<void> {
  try {
    await refreshMeta()
    const currentId = readCurrentId()
    if (currentId && (await loadWheelById(currentId))) {
      return
    }
    // First run (or a stale pointer): persist the in-memory default as wheel #1.
    await saveCurrentWheel()
  } catch (e) {
    console.warn('[persistence] hydrateOnMount failed', e)
  } finally {
    ready = true
  }
}
