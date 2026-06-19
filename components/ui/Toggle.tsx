'use client'

import { clsx } from 'clsx'

interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}

export default function Toggle({ checked, onChange, label }: Props) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-10 h-6 rounded-full transition-colors',
          checked
            ? 'bg-[var(--accent)] shadow-[0_0_12px_-2px_var(--glow)]'
            : 'bg-[var(--panel-raised)] border border-[var(--border-mid)]'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 left-1 w-4 h-4 rounded-full bg-[#fdf3e0] shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </div>
      {label && <span className="text-sm text-[var(--text)]">{label}</span>}
    </label>
  )
}
