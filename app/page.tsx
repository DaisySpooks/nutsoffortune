'use client'

import { useState } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { getTheme } from '@/lib/colorUtils'
import { useSpin } from '@/hooks/useSpin'
import { usePersistence } from '@/hooks/usePersistence'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { clsx } from 'clsx'
import WheelCanvas from '@/components/wheel/WheelCanvas'
import WheelPointer from '@/components/wheel/WheelPointer'
import SpinButton from '@/components/wheel/SpinButton'
import EditorPanel from '@/components/editor/EditorPanel'
import WinnerModal from '@/components/modals/WinnerModal'

export default function Home() {
  const { config, currentAngle, winner, isSpinning, reorderEntries } = useWheelStore()
  const theme = getTheme(config.themeId)
  const { spin } = useSpin()

  // Phase 6 — rehydrate the active wheel from IndexedDB and autosave changes.
  usePersistence()

  // Desktop direct-wheel editing — desktop only, never while spinning.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [editMode, setEditMode] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const canEdit = editMode && isDesktop && !isSpinning

  function enterPresentation() {
    setEditMode(false)
    setPresentationMode(true)
  }

  const entries = config.entries
  const winnerIndex = winner
    ? entries.findIndex(e => e.id === winner.id)
    : null

  return (
    <main className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Wheel section — fixed height on desktop so it never scrolls off screen */}
      <section
        className="wheel-stage relative flex flex-col items-center justify-center flex-1 p-6 min-h-[55vw] lg:min-h-0 lg:overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%), url(/backgrounds/wheel-room.png)',
          backgroundSize: 'cover',
          backgroundPosition: presentationMode ? 'center' : '86% 80px',
          transition: 'background-position 0.4s ease',
        }}
      >
        <h1 className="text-2xl font-bold text-[var(--gold)] mb-5 tracking-[0.12em] uppercase text-glow">
          {config.name}
        </h1>

        {/* Wheel + pointer container — gold ring frame with soft orange glow */}
        <div
          className="wheel-seat glow-ring relative aspect-square w-full rounded-full p-1.5"
          style={{
            maxWidth: presentationMode
              ? 'min(48vw, 66vh, 520px)'
              : 'min(90vw, 90vh, 560px)',
            transform: presentationMode
              ? 'translate(190px, -80px)'
              : 'translateX(0)',
            transition: 'max-width 0.4s ease, transform 0.4s ease',
          }}
        >
          <WheelPointer color={theme.pointerColor} />
          <WheelCanvas
            entries={entries}
            currentAngle={currentAngle}
            theme={theme}
            displayMode={config.displayMode}
            winnerIndex={winnerIndex}
            backgroundUrl={null}
            editMode={canEdit}
            onReorder={reorderEntries}
          />
        </div>

        <SpinButton
          isSpinning={isSpinning}
          disabled={entries.length < 2}
          onSpin={spin}
        />

        {/* Desktop-only direct-edit toggle — hidden in presentation mode */}
        {!presentationMode && (
          <button
            onClick={() => setEditMode(v => !v)}
            disabled={isSpinning}
            className={clsx(
              'mt-3 hidden lg:inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              canEdit
                ? 'border-[var(--border-accent)] bg-[var(--accent)]/15 text-[var(--gold)] shadow-[0_0_16px_-4px_var(--glow)]'
                : 'border-[var(--border-mid)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--border-accent)]'
            )}
            aria-pressed={canEdit}
          >
            {canEdit ? '✓ Editing wheel — drag slices' : 'Edit wheel'}
          </button>
        )}

        {/* Show editor button — only visible in presentation mode on desktop */}
        {presentationMode && (
          <button
            onClick={() => setPresentationMode(false)}
            className="hidden lg:inline-flex absolute bottom-5 right-5 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
          >
            Show editor
          </button>
        )}

        {winner && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Winner</p>
            <p className="text-xl font-bold text-[var(--gold)] text-glow whitespace-nowrap">{winner.name}</p>
          </div>
        )}
      </section>

      {/* Editor aside — hidden in presentation mode on desktop */}
      {(!presentationMode || !isDesktop) && (
        <aside className="w-full lg:w-[420px] lg:h-full border-t border-[var(--border-mid)] lg:border-t-0 lg:border-l border-[var(--border-mid)] bg-[var(--panel)] flex flex-col">
          {/* Hide editor button — desktop only, top-right of panel */}
          <div className="hidden lg:flex justify-end px-3 pt-2 pb-0">
            <button
              onClick={enterPresentation}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
            >
              Hide editor
            </button>
          </div>
          <EditorPanel />
        </aside>
      )}

      {/* Spin result announcement */}
      <WinnerModal onSpinAgain={spin} />
    </main>
  )
}
