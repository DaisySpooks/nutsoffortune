'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useWheelStore } from '@/store/wheelStore'
import { v4 as uuid } from 'uuid'
import { WheelEntry } from '@/types/wheel'
import { storeImageBlob } from '@/lib/persistence'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/imageUtils'
import { clsx } from 'clsx'

interface Props {
  useFilenamesAsNames: boolean
}

export default function ImageUploader({ useFilenamesAsNames }: Props) {
  const { addEntries } = useWheelStore()
  const [isDragActive, setIsDragActive] = useState(false)
  const [failedCount, setFailedCount] = useState(0)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setFailedCount(0)
      const newEntries: WheelEntry[] = []
      const uploadJobs: Array<{ entryId: string; imageId: string; file: File }> = []

      for (const file of acceptedFiles) {
        const imageId = uuid()
        const entryId = uuid()
        await storeImageBlob(imageId, file)
        const imageUrl = URL.createObjectURL(file)
        const rawName = file.name.replace(/\.[^/.]+$/, '')
        newEntries.push({ id: entryId, name: useFilenamesAsNames ? rawName : '', imageId, imageUrl, weight: 1 })
        uploadJobs.push({ entryId, imageId, file })
      }

      addEntries(newEntries)

      // Track in-flight uploads with a counter so LiveDrawModal can unblock as
      // soon as all promises settle — regardless of any stale blob: URLs.
      const store = useWheelStore.getState()
      store.incrementUploadCount(uploadJobs.length)

      let failures = 0
      await Promise.allSettled(
        uploadJobs.map(async ({ entryId, imageId, file }) => {
          try {
            const { blob, contentType } = await compressImage(file)
            console.log(
              `[ImageUploader] ${file.name}: ${(file.size / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB (${contentType})`
            )
            const { error } = await supabase.storage
              .from('wheel-images')
              .upload(imageId, blob, { contentType })
            if (error) throw error
            const { data } = supabase.storage.from('wheel-images').getPublicUrl(imageId)
            console.log('[ImageUploader] Uploaded', imageId, '→', data.publicUrl)
            useWheelStore.getState().updateEntry(entryId, { imageUrl: data.publicUrl })
          } catch (e) {
            console.warn('[ImageUploader] Upload failed for', imageId, e)
            // Clear the blob: URL so it is not treated as pending by other code
            useWheelStore.getState().updateEntry(entryId, { imageUrl: null })
            failures++
          } finally {
            useWheelStore.getState().decrementUploadCount()
          }
        })
      )

      if (failures > 0) setFailedCount(failures)
    },
    [addEntries, useFilenamesAsNames]
  )

  const { getRootProps, getInputProps, isDragAccept } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false),
  })

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps()}
        className={clsx(
          'flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors bg-[var(--app-bg-deep)]/40',
          isDragActive || isDragAccept
            ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-hi)] shadow-[0_0_20px_-6px_var(--glow)]'
            : 'border-[var(--border-accent)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--gold)]'
        )}
      >
        <input {...getInputProps()} />
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium">Drop images here</p>
        <p className="text-xs">or click to browse — multiple files OK</p>
      </div>
      {failedCount > 0 && (
        <p className="text-xs text-red-400">
          {failedCount} image{failedCount > 1 ? 's' : ''} failed to upload — {failedCount > 1 ? 'they' : 'it'} will not appear in the live viewer.
        </p>
      )}
    </div>
  )
}
