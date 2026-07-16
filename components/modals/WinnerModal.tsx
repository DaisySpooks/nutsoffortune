'use client'

import { useWheelStore } from '@/store/wheelStore'
import { broadcastWheelState, toPublicWinners } from '@/lib/liveRoom'
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
  const { winner, showWinnerModal, setShowWinnerModal, autoRemoveEntry, config, wheelMode, history, setHistoryNote } = useWheelStore()
  const isPrizeMode = wheelMode === 'spin-for-prize'

  const close = () => setShowWinnerModal(false)

  if (!winner) return null

  const stillOnWheel = config.entries.some(e => e.id === winner.id)
  const canSpinAgain = config.entries.length >= 2
  // The record for this spin — addToHistory runs synchronously before the modal
  // opens, and unshift keeps it first among any prior records for the same entry.
  const historyRecord = history.find(h => h.entryId === winner.id)

  return (
    <Modal open={showWinnerModal} onClose={close} title={isPrizeMode ? 'You landed on' : 'We have a winner!'} width="max-w-sm">
      <div className="flex flex-col items-center gap-4 text-center result-reveal-anim result-glow-anim">
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

        {historyRecord && (
          <div className="w-full text-left">
            <label htmlFor="winner-note" className="block text-xs text-[var(--muted)] mb-1">
              Notes (host-only)
            </label>
            <textarea
              id="winner-note"
              value={historyRecord.note ?? ''}
              onChange={(e) => setHistoryNote(historyRecord.id, e.target.value)}
              placeholder="Add a private note about this result…"
              rows={2}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </div>
        )}

        <div className="flex w-full gap-2 pt-1">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={close}
          >
            Review Wheel
          </Button>
          {stillOnWheel && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
              autoRemoveEntry(winner.id)
              const s = useWheelStore.getState()
              broadcastWheelState({
                config: s.config,
                wheelMode: s.wheelMode,
                autoRemoveWinner: s.autoRemoveWinner,
                showWinnersOnLiveView: s.showWinnersOnLiveView,
                winners: s.showWinnersOnLiveView ? toPublicWinners(s.history) : [],
              })
              close()
            }}
            >
              {isPrizeMode ? 'Remove Prize' : 'Remove Winner'}
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1"
            disabled={!canSpinAgain}
            onClick={() => { close(); onSpinAgain() }}
          >
            Spin again
          </Button>
        </div>

        {/* Auto-remove already took the winner off the wheel — say so instead of
            offering a duplicate remove action. */}
        {!stillOnWheel && (
          <p className="text-xs text-[var(--muted)]">Removed from future spins.</p>
        )}
      </div>
    </Modal>
  )
}
