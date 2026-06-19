'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWheelStore } from '@/store/wheelStore'
import { WheelEntry } from '@/types/wheel'
import { clsx } from 'clsx'

interface Props {
  entry: WheelEntry
  index: number
}

export default function EntryItem({ entry, index }: Props) {
  const { updateEntry, removeEntry } = useWheelStore()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 bg-[var(--row)] border border-[var(--border)] hover:border-[var(--border-mid)] transition-shadow',
        isDragging && 'opacity-60 border-[var(--border-accent)] shadow-xl z-50'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[var(--muted-dim)] hover:text-[var(--gold)] shrink-0 touch-none"
        aria-label="Drag to reorder"
        tabIndex={-1}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="5" cy="4" r="1.2" />
          <circle cx="11" cy="4" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="11" cy="12" r="1.2" />
        </svg>
      </button>

      {/* Image thumbnail / placeholder */}
      <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-[var(--panel-raised)] border border-[var(--border)] flex items-center justify-center">
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[var(--muted-dim)] text-xs font-mono">{index + 1}</span>
        )}
      </div>

      {/* Name input */}
      <input
        type="text"
        value={entry.name}
        onChange={e => updateEntry(entry.id, { name: e.target.value })}
        placeholder="Entry name"
        className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder-[var(--muted-dim)] outline-none min-w-0"
      />

      {/* Remove image button (only when image present) */}
      {entry.imageUrl && (
        <button
          onClick={() => {
            URL.revokeObjectURL(entry.imageUrl!)
            updateEntry(entry.id, { imageUrl: null, imageId: null })
          }}
          className="text-[var(--muted-dim)] hover:text-[var(--gold)] shrink-0 transition-colors"
          aria-label="Remove image"
          title="Remove image"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
          </svg>
        </button>
      )}

      {/* Delete entry */}
      <button
        onClick={() => {
          if (entry.imageUrl) URL.revokeObjectURL(entry.imageUrl)
          removeEntry(entry.id)
        }}
        className="text-[var(--muted-dim)] hover:text-red-400 shrink-0 text-lg leading-none transition-colors"
        aria-label="Delete entry"
      >
        ×
      </button>
    </div>
  )
}
