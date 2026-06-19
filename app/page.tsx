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
  const canEdit = editMode && isDesktop && !isSpinning

  const entries = config.entries
  const winnerIndex = winner
    ? entries.findIndex(e => e.id === winner.id)
    : null

  return (
    <main className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Wheel section — fixed height on desktop so it never scrolls off screen */}
      <section
        className="wheel-stage flex flex-col items-center justify-center flex-1 p-6 min-h-[55vw] lg:min-h-0 lg:overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%), url(/backgrounds/wheel-room.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <h1 className="text-2xl font-bold text-[var(--gold)] mb-5 tracking-[0.12em] uppercase text-glow">
          {config.name}
        </h1>

        {/* Wheel + pointer container — gold ring frame with soft orange glow */}
        <div className="wheel-seat relative w-full max-w-[min(90vw,90vh,560px)] aspect-square rounded-full glow-ring p-1.5">
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

        {/* Desktop-only direct-edit toggle — drag slices on the wheel to reorder */}
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

        {winner && (
          <div className="mt-3 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Winner</p>
            <p className="text-xl font-bold text-[var(--gold)] text-glow">{winner.name}</p>
          </div>
        )}
      </section>

      {/* Editor section */}
      {/* Editor aside — scrolls independently; wheel stays visible */}
      <aside className="w-full lg:w-[420px] lg:h-full border-t border-[var(--border-mid)] lg:border-t-0 lg:border-l border-[var(--border-mid)] bg-[var(--panel)] flex flex-col">
        <EditorPanel />
      </aside>

      {/* Spin result announcement */}
      <WinnerModal onSpinAgain={spin} />
    </main>
  )
}
