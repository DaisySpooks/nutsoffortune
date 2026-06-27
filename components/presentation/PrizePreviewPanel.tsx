'use client'

import { useEffect, useRef, useState } from 'react'
import { WheelEntry, WheelMode } from '@/types/wheel'

interface Props {
  open: boolean
  onClose: () => void
  entries: WheelEntry[]
  wheelMode: WheelMode
  isSpinning: boolean
  readOnly?: boolean
  pageIndex?: number
  onPageChange?: (index: number) => void
}

export default function PrizePreviewPanel({
  open, onClose, entries, wheelMode, isSpinning,
  readOnly = false, pageIndex = 0, onPageChange,
}: Props) {
  const prevSpinning = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [maxPage, setMaxPage] = useState(0)

  // Auto-close when a spin starts.
  useEffect(() => {
    if (!prevSpinning.current && isSpinning && open) onClose()
    prevSpinning.current = isSpinning
  }, [isSpinning, open, onClose])

  // Recompute how many pages exist whenever entries or open state changes.
  // Runs after paint so clientHeight/scrollHeight are current.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const h = el.clientHeight
    setMaxPage(h > 0 ? Math.max(0, Math.ceil((el.scrollHeight - h) / h)) : 0)
  }, [entries, open])

  // Apply the current page as a smooth native scroll.
  // Deps include `open` so viewers who join with pageIndex already > 0 scroll correctly.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    console.log('[prize-panel] scroll effect — pageIndex:', pageIndex, 'clientH:', el.clientHeight, 'scrollH:', el.scrollHeight)
    el.scrollTop = pageIndex * el.clientHeight
  }, [pageIndex, open])

  const isPrizeMode = wheelMode === 'spin-for-prize'
  const heading = isPrizeMode ? 'Prizes In This Wheel' : 'Entries In This Wheel'
  const canGoPrev = pageIndex > 0
  const canGoNext = pageIndex < maxPage

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
        transition: 'opacity 0.25s ease',
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

        {/* Entry list — always scrollable and pointer-event-enabled so scrollTo works */}
        <div
          ref={scrollRef}
          className="flex-1"
          style={{
            minHeight: 0,
            // Cap the scroll container so entries can overflow and be scrollable.
            // Without this, flex-1 in a maxHeight-only container expands to full
            // content height, making clientHeight === scrollHeight with no room to scroll.
            maxHeight: 412,
            overflowY: readOnly ? 'scroll' : 'auto',
            scrollBehavior: 'smooth',
          }}
        >
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

        {/* Footer — entry count + page controls (controls hidden for read-only viewers) */}
        <div className="px-3 py-2 border-t border-[var(--border-mid)] flex-shrink-0 flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                onClick={() => onPageChange?.(pageIndex - 1)}
                disabled={!canGoPrev}
                aria-label="Previous page"
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--gold)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-xs"
              >
                ‹
              </button>
              <button
                onClick={() => onPageChange?.(pageIndex + 1)}
                disabled={!canGoNext}
                aria-label="Next page"
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--gold)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-xs"
              >
                ›
              </button>
            </>
          )}
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] ml-auto">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>
    </div>
  )
}
