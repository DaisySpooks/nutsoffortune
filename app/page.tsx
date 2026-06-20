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

// Presentation-mode focal point — lounge circle center as fractions of the
// wheel stage. X is (50% + 190px) because the circle sits 190px right of the
// section center when the background is cover+center. Y is 38.5% because
// height drives cover at all desktop viewports, keeping the circle at a
// constant fraction of section height regardless of viewport width.
const PM_LEFT = 'calc(50vw + 190px)'
const PM_TOP = '38.5%'
// Half-wheel width, matching the min() size rule — used to place the spin
// button just below the wheel bottom.
const PM_HALF_WHEEL = 'min(24vw, 33vh, 260px)'

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
      {/* Wheel section */}
      <section
        className={clsx(
          'wheel-stage relative flex flex-col items-center flex-1 min-h-[55vw] lg:min-h-0 lg:overflow-hidden',
          // Presentation mode: title floats at top with padding; no justify-center
          // since wheel and spin button are absolutely positioned.
          presentationMode ? 'pt-5' : 'justify-center p-6'
        )}
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%), url(/backgrounds/wheel-room.png)',
          backgroundSize: 'cover',
          backgroundPosition: presentationMode ? 'center' : 'calc((100vw - 420px) / 2 - 113.3vh) 80px',
          transition: 'background-position 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <h1 className="text-2xl font-bold text-[var(--gold)] mb-5 tracking-[0.12em] uppercase text-glow">
          {config.name}
        </h1>

        {/* ── Desktop: single wheel, always absolutely positioned, animates between anchors ── */}
        {isDesktop && (
          <div
            style={{
              position: 'absolute',
              left: presentationMode ? PM_LEFT : 'calc(50vw - 210px)',
              top: presentationMode ? PM_TOP : 'calc(50% - 31px)',
              width: 'min(90vw, 90vh, 560px)',
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.6s cubic-bezier(0.22, 1, 0.36, 1), top 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div
              className="wheel-seat glow-ring rounded-full p-1.5"
              style={{
                width: '100%',
                height: '100%',
                transform: presentationMode ? 'scale(0.923)' : 'scale(1)',
                transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                transformOrigin: 'center center',
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
          </div>
        )}

        {/* ── Mobile: wheel in normal flex flow ── */}
        {!isDesktop && (
          <div
            className="wheel-seat glow-ring relative aspect-square w-full rounded-full p-1.5"
            style={{ maxWidth: 'min(90vw, 90vh, 560px)' }}
          >
            <WheelPointer color={theme.pointerColor} />
            <WheelCanvas
              entries={entries}
              currentAngle={currentAngle}
              theme={theme}
              displayMode={config.displayMode}
              winnerIndex={winnerIndex}
              backgroundUrl={null}
              editMode={false}
              onReorder={reorderEntries}
            />
          </div>
        )}

        {presentationMode ? (
          <>
            {/* Spin button anchored just below the wheel */}
            <div
              className="absolute"
              style={{
                left: PM_LEFT,
                top: `calc(${PM_TOP} + ${PM_HALF_WHEEL} + 20px)`,
                transform: 'translateX(-50%)',
              }}
            >
              <SpinButton
                isSpinning={isSpinning}
                disabled={entries.length < 2}
                onSpin={spin}
              />
            </div>

            {/* Show editor — bottom-right corner */}
            <button
              onClick={() => setPresentationMode(false)}
              className="hidden lg:inline-flex absolute bottom-5 right-5 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
            >
              Show editor
            </button>
          </>
        ) : (
          <>
            {/* Desktop placeholder — invisible, keeps flex flow spacing identical to before */}
            {isDesktop && (
              <div
                className="w-full"
                style={{ maxWidth: 'min(90vw, 90vh, 560px)', aspectRatio: '1 / 1', visibility: 'hidden', pointerEvents: 'none' }}
              />
            )}

            <SpinButton
              isSpinning={isSpinning}
              disabled={entries.length < 2}
              onSpin={spin}
            />

            {/* Desktop-only direct-edit toggle */}
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
          </>
        )}

        {/* Winner label — absolute so it never shifts the wheel position */}
        {winner && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Winner</p>
            <p className="text-xl font-bold text-[var(--gold)] text-glow whitespace-nowrap">{winner.name}</p>
          </div>
        )}
      </section>

      {/* Editor aside — always mounted on desktop so width can animate smoothly */}
      <aside
        className="w-full lg:h-full border-t border-[var(--border-mid)] lg:border-t-0 lg:border-l border-[var(--border-mid)] bg-[var(--panel)] flex flex-col"
        style={isDesktop ? {
          width: presentationMode ? 0 : '420px',
          flexShrink: 0,
          overflow: 'hidden',
          pointerEvents: presentationMode ? 'none' : undefined,
          transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        } : undefined}
      >
        <div className="w-full lg:w-[420px] h-full flex flex-col min-h-0">
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
        </div>
      </aside>

      {/* Spin result announcement */}
      <WinnerModal onSpinAgain={spin} />
    </main>
  )
}
