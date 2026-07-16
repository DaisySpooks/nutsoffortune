'use client'

import { PublicWinner } from '@/lib/liveRoom'

interface Props {
  winners: PublicWinner[]
}

/**
 * Read-only Recent Winners list for desktop live viewers. Shown only when the
 * host enables "Show Winners on Live View" — viewers cannot close, edit, or
 * otherwise interact with it, and it never receives host-only notes.
 */
export default function RecentWinnersPanel({ winners }: Props) {
  if (winners.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        right: 20,
        top: 20,
        width: 240,
        maxHeight: 280,
        zIndex: 20,
      }}
    >
      <div
        className="flex flex-col rounded-xl border border-[var(--border-mid)] overflow-hidden"
        style={{
          background: 'rgba(10, 8, 20, 0.78)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          maxHeight: 280,
        }}
      >
        <div className="px-4 py-3 border-b border-[var(--border-mid)] flex-shrink-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold)]">
            Recent Winners
          </h2>
        </div>

        <ul className="overflow-y-auto" style={{ maxHeight: 232 }}>
          {winners.map((w, i) => (
            <li
              key={`${w.timestamp}-${i}`}
              className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[var(--border-mid)] last:border-b-0"
            >
              <span className="text-sm text-[var(--text)] leading-snug truncate">
                {w.name.trim() || 'Unnamed entry'}
              </span>
              <span className="text-[10px] text-[var(--muted)] shrink-0">
                {new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
