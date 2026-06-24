'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useWheelStore } from '@/store/wheelStore'
import { v4 as uuid } from 'uuid'
import { WheelEntry } from '@/types/wheel'
import { storeImageBlob } from '@/lib/persistence'
import { supabase } from '@/lib/supabase'
import { clsx } from 'clsx'

interface Props {
  useFilenamesAsNames: boolean
}

export default function ImageUploader({ useFilenamesAsNames }: Props) {
  const { addEntries } = useWheelStore()
  const [isDragActive, setIsDragActive] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newEntries: WheelEntry[] = []
      // Track which entries still need their imageUrl replaced with the public URL
      const uploadJobs: Array<{ entryId: string; imageId: string; file: File }> = []

      for (const file of acceptedFiles) {
        const imageId = uuid()
        const entryId = uuid()
        // Persist blob locally for offline/restore support
        await storeImageBlob(imageId, file)
        // Use a blob URL for instant rendering while the Supabase upload runs
        const imageUrl = URL.createObjectURL(file)
        const rawName = file.name.replace(/\.[^/.]+$/, '')
        newEntries.push({
          id: entryId,
          name: useFilenamesAsNames ? rawName : '',
          imageId,
          imageUrl,
          weight: 1,
        })
        uploadJobs.push({ entryId, imageId, file })
      }

      addEntries(newEntries)

      // Upload each image to Supabase Storage so live viewers can render them.
      // Once uploaded, replace the blob: URL with the stable public URL.
      for (const { entryId, imageId, file } of uploadJobs) {
        try {
          const { error } = await supabase.storage
            .from('wheel-images')
            .upload(imageId, file, { upsert: true })
          if (error) {
            console.warn('[ImageUploader] Storage upload error:', error.message)
            continue
          }
          const { data } = supabase.storage.from('wheel-images').getPublicUrl(imageId)
          console.log('[ImageUploader] Uploaded', imageId, '→', data.publicUrl)
          useWheelStore.getState().updateEntry(entryId, { imageUrl: data.publicUrl })
        } catch (e) {
          console.warn('[ImageUploader] Storage upload failed:', e)
        }
      }
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
  )
}
