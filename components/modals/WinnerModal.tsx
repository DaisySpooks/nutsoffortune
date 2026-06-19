'use client'

import { useWheelStore } from '@/store/wheelStore'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  /** Trigger another spin — supplied by the page so there is a single spin loop. */
  onSpinAgain: () => void
}

/**
 * Phase 3 — celebratory result dialog shown when a spin finishes. Reads existing
 * runtime state (`winner` / `showWinnerModal`) and only calls existing store
 * actions, so it adds no new behaviour beyond surfacing the result.
 */
export default function WinnerModal({ onSpinAgain }: Props) {
  const { winner, showWinnerModal, setShowWinnerModal, removeEntry, config } = useWheelStore()

  const close = () => setShowWinnerModal(false)

  if (!winner) return null

  const stillOnWheel = config.entries.some(e => e.id === winner.id)
  const canSpinAgain = config.entries.length >= 2

  return (
    <Modal open={showWinnerModal} onClose={close} title="We have a winner!" width="max-w-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        {winner.imageUrl && (
          <img
            src={winner.imageUrl}
            alt=""
            className="w-28 h-28 rounded-xl object-cover border border-[var(--border-accent)] shadow-[0_0_24px_-6px_var(--glow)]"
          />
        )}

        <p className="text-2xl font-extrabold text-[var(--gold)] text-glow break-words leading-tight">
          {winner.name.trim() || 'Unnamed entry'}
        </p>

        <div className="flex w-full gap-2 pt-1">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!canSpinAgain}
            onClick={() => { close(); onSpinAgain() }}
          >
            Spin again
          </Button>
          {stillOnWheel && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { removeEntry(winner.id); close() }}
            >
              Remove from wheel
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
