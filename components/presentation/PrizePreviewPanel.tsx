'use client'

import { useEffect, useRef } from 'react'
import { WheelEntry, WheelMode } from '@/types/wheel'

interface Props {
  open: boolean
  onClose: () => void
  entries: WheelEntry[]
  wheelMode: WheelMode
  isSpinning: boolean
  readOnly?: boolean
  onScroll?: (ratio: number) => void
  scrollRatio?: number
}

export default function PrizePreviewPanel({ open, onClose, entries, wheelMode, isSpinning, readOnly = false, onScroll, scrollRatio }: Props) {
  const prevSpinning = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-close when a spin starts.
  useEffect(() => {
    if (!prevSpinning.current && isSpinning && open) {
      onClose()
    }
    prevSpinning.current = isSpinning
  }, [isSpinning, open, onClose])

  // Viewer side: apply incoming scroll ratio from host.
  useEffect(() => {
    if (scrollRatio === undefined) return
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    if (max > 0) el.scrollTop = scrollRatio * max
  }, [scrollRatio])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!onScroll) return
    const el = e.currentTarget
    const max = el.scrollHeight - el.clientHeight
    onScroll(max > 0 ? el.scrollTop / max : 0)
  }

  const isPrizeMode = wheelMode === 'spin-for-prize'
  const heading = isPrizeMode ? 'Prizes In This Wheel' : 'Entries In This Wheel'

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'absolute',
        left: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 300,
        maxHeight: 500,
        zIndex: 20,
        pointerEvents: open ? undefined : 'none',
        opacity: open ? 1 : 0,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        transformOrigin: 'left center',
      }}
    >
      <div
        className="flex flex-col rounded-xl border border-[var(--border-mid)] overflow-hidden"
        style={{
          background: 'rgba(10, 8, 20, 0.78)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          maxHeight: 500,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-mid)] flex-shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold)]">
            {heading}
          </h2>
          {!readOnly && (
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="text-[var(--muted)] hover:text-[var(--gold)] transition-colors text-lg leading-none -mr-0.5"
            >
              ×
            </button>
          )}
        </div>

        {/* Entry list */}
        <div ref={scrollRef} onScroll={handleScroll} className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-xs text-[var(--muted)] text-center">No entries yet.</p>
          ) : (
            <ul>
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-mid)] last:border-b-0"
                >
                  {entry.imageUrl ? (
                    <img
                      src={entry.imageUrl}
                      alt=""
                      aria-hidden="true"
                      className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold text-[var(--muted)]"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-[var(--text)] leading-snug truncate">
                    {entry.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — total count */}
        <div className="px-4 py-2 border-t border-[var(--border-mid)] flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] text-right">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>
    </div>
  )
}
