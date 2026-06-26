'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { createLiveRoom, getActiveRoomCode, broadcastWheelState } from '@/lib/liveRoom'
import { ensureLiveImages } from '@/lib/imageUtils'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
}

export default function LiveDrawModal({ open, onClose }: Props) {
  const { activeUploadCount } = useWheelStore()
  // Read the existing active room on every open so re-opening mid-presentation
  // shows the same room the host already shared, not a new one.
  const [roomCode, setRoomCode] = useState<string | null>(() => getActiveRoomCode())
  const [loading, setLoading] = useState(false)
  const [preparingImages, setPreparingImages] = useState(false)
  const [imageWarning, setImageWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = roomCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live?room=${roomCode}`
    : null

  const hasPendingUploads = activeUploadCount > 0

  async function handleCreateRoom() {
    setLoading(true)
    setError(null)
    setImageWarning(null)

    try {
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

      const s = useWheelStore.getState()
      const { roomCode: code } = await createLiveRoom({
        config: s.config,
        wheelMode: s.wheelMode,
        autoRemoveWinner: s.autoRemoveWinner,
      })
      setRoomCode(code)
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room')
    } finally {
      setLoading(false)
      setPreparingImages(false)
    }
  }

  // Sync the latest wheel state to the existing active room, then copy the link.
  async function handleSyncAndCopy() {
    if (!shareUrl) return
    setLoading(true)
    setError(null)

    try {
      const s = useWheelStore.getState()
      await broadcastWheelState({
        config: s.config,
        wheelMode: s.wheelMode,
        autoRemoveWinner: s.autoRemoveWinner,
      })
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync room')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setError(null)
    setImageWarning(null)
    setCopied(false)
    onClose()
  }

  const createLabel = preparingImages
    ? 'Preparing images…'
    : loading
    ? 'Creating room…'
    : hasPendingUploads
    ? 'Waiting for uploads…'
    : null

  return (
    <Modal open={open} onClose={handleClose} title="Live Draw" width="max-w-sm">
      <div className="flex flex-col gap-4">
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

        {!roomCode ? (
          /* ── No active room ── */
          <>
            <p className="text-sm text-[var(--muted)]">
              Create a live room so viewers can follow along in real time.
            </p>
            <Button
              variant="primary"
              disabled={loading || hasPendingUploads}
              onClick={handleCreateRoom}
            >
              {createLabel ?? 'Start live room'}
            </Button>
          </>
        ) : (
          /* ── Active room exists ── */
          <>
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--muted)] mb-1">Current live room</p>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={shareUrl ?? ''}
                  className="flex-1 min-w-0 rounded-lg px-3 py-2 text-xs bg-[var(--panel-raised)] border border-[var(--border-mid)] text-[var(--gold)] font-mono focus:outline-none"
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                Code:{' '}
                <span className="font-mono tracking-widest text-[var(--gold)]">{roomCode}</span>
              </p>
            </div>

            <Button
              variant="primary"
              disabled={loading}
              onClick={handleSyncAndCopy}
            >
              {loading ? 'Syncing…' : copied ? 'Copied!' : 'Sync current wheel & copy link'}
            </Button>

            {/* Secondary: intentional fresh room */}
            <div className="border-t border-[var(--border-mid)] pt-3 flex flex-col gap-2">
              <p className="text-xs text-[var(--muted)]">
                Start a brand-new room — viewers in the current room will need the new link.
              </p>
              <Button
                variant="secondary"
                disabled={loading || hasPendingUploads}
                onClick={handleCreateRoom}
              >
                {createLabel ?? 'Start fresh room'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
