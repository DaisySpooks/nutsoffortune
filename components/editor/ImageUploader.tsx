'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useWheelStore } from '@/store/wheelStore'
import { v4 as uuid } from 'uuid'
import { WheelEntry } from '@/types/wheel'
import { storeImageBlob } from '@/lib/persistence'
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
      for (const file of acceptedFiles) {
        const imageId = uuid()
        // Persist the blob to IndexedDB so the image survives a refresh.
        await storeImageBlob(imageId, file)
        const imageUrl = URL.createObjectURL(file)
        const rawName = file.name.replace(/\.[^/.]+$/, '') // strip extension
        newEntries.push({
          id: uuid(),
          name: useFilenamesAsNames ? rawName : '',
          imageId,
          imageUrl,
          weight: 1,
        })
      }
      addEntries(newEntries)
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
