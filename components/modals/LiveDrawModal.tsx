'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { createLiveRoom, getActiveRoomCode } from '@/lib/liveRoom'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
}

export default function LiveDrawModal({ open, onClose }: Props) {
  const { config, wheelMode, autoRemoveWinner } = useWheelStore()
  // Initialise from localStorage so re-opening the modal shows the existing
  // active room rather than "Start Live Draw", preventing accidental duplicates.
  const [roomCode, setRoomCode] = useState<string | null>(() => getActiveRoomCode())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = roomCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/live?room=${roomCode}`
    : null

  // True while any entry still has a session-only blob: URL — means the Supabase
  // Storage upload hasn't finished yet and the snapshot would lose those images.
  const hasPendingUploads = config.entries.some(e => e.imageUrl?.startsWith('blob:'))

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const { roomCode: code } = await createLiveRoom({ config, wheelMode, autoRemoveWinner })
      setRoomCode(code)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room')
    } finally {
      setLoading(false)
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
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button variant="primary" disabled={loading || hasPendingUploads} onClick={handleStart}>
            {loading ? 'Creating room…' : hasPendingUploads ? 'Waiting for uploads…' : 'Start Live Draw'}
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
            <Button variant="secondary" disabled={loading || hasPendingUploads} onClick={handleStart}>
              {loading ? 'Creating room…' : hasPendingUploads ? 'Waiting for uploads…' : 'Start new live room'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
