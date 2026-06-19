'use client'

import { openDB, type IDBPDatabase } from 'idb'
import { StoredWheel } from '@/types/wheel'

// ── Local IndexedDB ──────────────────────────────────────────────────────────
// Two object stores:
//   • images — uploaded image blobs, keyed by imageId (out-of-line keys)
//   • wheels — full StoredWheel records, keyed by record.id (in-line keyPath)
// Blobs live here (never localStorage). All access is browser-only and guarded.

const DB_NAME = 'nut-of-fortune'
const DB_VERSION = 1
export const IMAGE_STORE = 'images'
export const WHEEL_STORE = 'wheels'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment'))
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IMAGE_STORE)) {
          db.createObjectStore(IMAGE_STORE)
        }
        if (!db.objectStoreNames.contains(WHEEL_STORE)) {
          db.createObjectStore(WHEEL_STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// ── Image blobs ──────────────────────────────────────────────────────────────

export async function putImageBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await db.put(IMAGE_STORE, blob, id)
}

export async function getImageBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB()
  return db.get(IMAGE_STORE, id)
}

export async function deleteImageBlob(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(IMAGE_STORE, id)
}

export async function getAllImageKeys(): Promise<string[]> {
  const db = await getDB()
  return (await db.getAllKeys(IMAGE_STORE)) as string[]
}

// ── Wheel records ────────────────────────────────────────────────────────────

export async function putWheelRecord(record: StoredWheel): Promise<void> {
  const db = await getDB()
  await db.put(WHEEL_STORE, record)
}

export async function getWheelRecord(id: string): Promise<StoredWheel | undefined> {
  const db = await getDB()
  return db.get(WHEEL_STORE, id)
}

export async function getAllWheelRecords(): Promise<StoredWheel[]> {
  const db = await getDB()
  return db.getAll(WHEEL_STORE)
}

export async function deleteWheelRecord(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(WHEEL_STORE, id)
}
