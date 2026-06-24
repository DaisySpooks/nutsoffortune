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
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button variant="primary" disabled={loading} onClick={handleStart}>
            {loading ? 'Creating room…' : 'Start Live Draw'}
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
        </div>
      )}
    </Modal>
  )
}
