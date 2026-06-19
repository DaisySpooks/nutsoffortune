'use client'

import { useWheelStore } from '@/store/wheelStore'
import { getTheme } from '@/lib/colorUtils'
import { useSpin } from '@/hooks/useSpin'
import { usePersistence } from '@/hooks/usePersistence'
import WheelCanvas from '@/components/wheel/WheelCanvas'
import WheelPointer from '@/components/wheel/WheelPointer'
import SpinButton from '@/components/wheel/SpinButton'
import EditorPanel from '@/components/editor/EditorPanel'
import WinnerModal from '@/components/modals/WinnerModal'

export default function Home() {
  const { config, currentAngle, winner, isSpinning } = useWheelStore()
  const theme = getTheme(config.themeId)
  const { spin } = useSpin()

  // Phase 6 — rehydrate the active wheel from IndexedDB and autosave changes.
  usePersistence()

  const entries = config.entries
  const winnerIndex = winner
    ? entries.findIndex(e => e.id === winner.id)
    : null

  return (
    <main className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Wheel section — fixed height on desktop so it never scrolls off screen */}
      <section className="flex flex-col items-center justify-center flex-1 p-6 min-h-[55vw] lg:min-h-0 lg:overflow-hidden">
        <h1 className="text-2xl font-bold text-[var(--gold)] mb-5 tracking-[0.12em] uppercase text-glow">
          {config.name}
        </h1>

        {/* Wheel + pointer container — gold ring frame with soft orange glow */}
        <div className="relative w-full max-w-[min(90vw,90vh,560px)] aspect-square rounded-full glow-ring p-1.5">
          <WheelPointer color={theme.pointerColor} />
          <WheelCanvas
            entries={entries}
            currentAngle={currentAngle}
            theme={theme}
            displayMode={config.displayMode}
            winnerIndex={winnerIndex}
            backgroundUrl={null}
          />
        </div>

        <SpinButton
          isSpinning={isSpinning}
          disabled={entries.length < 2}
          onSpin={spin}
        />

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
