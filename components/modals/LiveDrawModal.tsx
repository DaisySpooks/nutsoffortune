'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { createLiveRoom, getActiveRoomCode } from '@/lib/liveRoom'
import { ensureLiveImages } from '@/lib/imageUtils'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
}

export default function LiveDrawModal({ open, onClose }: Props) {
  const { config, wheelMode, autoRemoveWinner, activeUploadCount } = useWheelStore()
  // Initialise from localStorage so re-opening the modal shows the existing
  // active room rather than "Start Live Draw", preventing accidental duplicates.
  const [roomCode, setRoomCode] = useState<string | null>(() => getActiveRoomCode())
  const [loading, setLoading] = useState(false)
  const [preparingImages, setPreparingImages] = useState(false)
  const [imageWarning, setImageWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = roomCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live?room=${roomCode}`
    : null

  // Block room creation only while uploads are actively in-flight (counter > 0).
  // Using a counter rather than scanning for blob: URLs means the modal unblocks
  // as soon as every upload promise settles — failed uploads clear their blob:
  // URL and decrement the counter, so nothing can stay stuck forever.
  const hasPendingUploads = activeUploadCount > 0

  async function handleStart() {
    setLoading(true)
    setError(null)
    setImageWarning(null)

    try {
      // Ensure entries with a local imageId but no public URL are uploaded first.
      // This covers reused/saved wheels where imageUrl was stripped on save.
      const currentEntries = useWheelStore.getState().config.entries
      const needsReupload = currentEntries.some(
        e => e.imageId && !e.imageUrl?.startsWith('https://')
      )

      if (needsReupload) {
        setPreparingImages(true)
        const { failedCount } = await ensureLiveImages(currentEntries)
        setPreparingImages(false)
        if (failedCount > 0) {
          setImageWarning(
            `${failedCount} image${failedCount > 1 ? 's' : ''} could not be prepared and will not appear in the live viewer.`
          )
        }
      }

      // Re-read the store after any updateEntry calls from ensureLiveImages.
      const s = useWheelStore.getState()
      const { roomCode: code } = await createLiveRoom({
        config: s.config,
        wheelMode: s.wheelMode,
        autoRemoveWinner: s.autoRemoveWinner,
      })
      setRoomCode(code)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room')
    } finally {
      setLoading(false)
      setPreparingImages(false)
    }
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleClose() {
    setError(null)
    setImageWarning(null)
    setCopied(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Live Draw" width="max-w-sm">
      {!roomCode ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--muted)]">
            Create a live room so viewers can follow along in real time. The current wheel and entries will be shared.
          </p>
          {hasPendingUploads && (
            <p className="text-xs text-amber-400">
              Images are still uploading. Wait a moment before starting.
            </p>
          )}
          {preparingImages && (
            <p className="text-xs text-amber-400">
              Preparing images for live — uploading saved wheel images…
            </p>
          )}
          {imageWarning && (
            <p className="text-xs text-amber-400">{imageWarning}</p>
          )}
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button variant="primary" disabled={loading || hasPendingUploads} onClick={handleStart}>
            {preparingImages ? 'Preparing images…' : loading ? 'Creating room…' : hasPendingUploads ? 'Waiting for uploads…' : 'Start Live Draw'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--muted)]">
            Share this link with your audience:
          </p>
          <div className="flex gap-2 items-center">
            <input
              readOnly
              value={shareUrl ?? ''}
              className="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs bg-[var(--panel-raised)] border border-[var(--border-mid)] text-[var(--gold)] font-mono focus:outline-none"
            />
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Room code:{' '}
            <span className="font-mono tracking-widest text-[var(--gold)]">{roomCode}</span>
          </p>

          <div className="border-t border-[var(--border-mid)] pt-3 flex flex-col gap-2">
            <p className="text-xs text-[var(--muted)]">
              Changed your wheel? Start a fresh room with the current entries.
            </p>
            {error && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {hasPendingUploads && (
              <p className="text-xs text-amber-400">
                Images are still uploading. Wait a moment before starting.
              </p>
            )}
            {preparingImages && (
              <p className="text-xs text-amber-400">
                Preparing images for live — uploading saved wheel images…
              </p>
            )}
            {imageWarning && (
              <p className="text-xs text-amber-400">{imageWarning}</p>
            )}
            <Button variant="secondary" disabled={loading || hasPendingUploads} onClick={handleStart}>
              {preparingImages ? 'Preparing images…' : loading ? 'Creating room…' : hasPendingUploads ? 'Waiting for uploads…' : 'Start new live room'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
