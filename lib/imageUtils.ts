'use client'

import { supabase } from './supabase'
import { useWheelStore } from '@/store/wheelStore'
import { WheelEntry } from '@/types/wheel'
import * as db from '@/lib/db'

export const MAX_PX = 1024  // longest side after resize

export function detectWebPSupport(): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

export async function compressImage(source: Blob): Promise<{ blob: Blob; contentType: string }> {
  const bitmap = await createImageBitmap(source)
  const { width: w, height: h } = bitmap

  const scale = Math.min(1, MAX_PX / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d not available')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const mimeType = detectWebPSupport() ? 'image/webp' : 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      mimeType,
      0.85
    )
  )
  return { blob, contentType: mimeType }
}

/**
 * For entries that have a local imageId but no public Supabase Storage URL,
 * load the blob from IndexedDB, compress it, and upload it.
 *
 * Called before creating a live room so that restored/saved wheels produce
 * the same live viewer experience as freshly-uploaded ones.
 *
 * - Entries already pointing to a public https:// URL are left untouched.
 * - If a file with the same imageId already exists in Storage (a previous
 *   upload succeeded but the URL was lost), the duplicate error is caught and
 *   the existing public URL is used instead.
 * - On any unrecoverable failure the entry's imageUrl is cleared so it is
 *   omitted cleanly from the live snapshot rather than appearing broken.
 *
 * Returns the number of entries that could not be prepared.
 */
export async function ensureLiveImages(entries: WheelEntry[]): Promise<{ failedCount: number }> {
  const jobs = entries.filter(
    e => e.imageId && !e.imageUrl?.startsWith('https://')
  )
  if (jobs.length === 0) return { failedCount: 0 }

  let failedCount = 0

  await Promise.allSettled(
    jobs.map(async (entry) => {
      try {
        const blob = await db.getImageBlob(entry.imageId!)
        if (!blob) throw new Error('blob not found in IndexedDB')

        const { blob: compressed, contentType } = await compressImage(blob)

        const { error: uploadError } = await supabase.storage
          .from('wheel-images')
          .upload(entry.imageId!, compressed, { contentType })

        if (uploadError) {
          // A 409/Duplicate means this imageId was uploaded in a previous session.
          // The file already exists — just derive the public URL from it.
          const isDuplicate = /already exist|duplicate/i.test(uploadError.message)
          if (!isDuplicate) throw uploadError
          console.log('[ensureLiveImages] already in Storage, reusing URL for', entry.imageId)
        } else {
          console.log('[ensureLiveImages] uploaded', entry.imageId)
        }

        const { data } = supabase.storage.from('wheel-images').getPublicUrl(entry.imageId!)
        useWheelStore.getState().updateEntry(entry.id, { imageUrl: data.publicUrl })
      } catch (e) {
        console.warn('[ensureLiveImages] failed for entry', entry.id, entry.imageId, e)
        useWheelStore.getState().updateEntry(entry.id, { imageUrl: null })
        failedCount++
      }
    })
  )

  return { failedCount }
}
