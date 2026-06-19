'use client'

import { clsx } from 'clsx'
import { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export default function Button({ variant = 'secondary', size = 'md', className, children, ...props }: Props) {
  return (
    <button
      {...props}
      className={clsx(
        'rounded-lg font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hi)] disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-gradient-to-b from-[var(--accent-hi)] to-[var(--accent-deep)] text-[#2a1606] shadow-[0_2px_14px_-2px_var(--glow)] hover:brightness-110 active:brightness-95',
        variant === 'secondary' && 'bg-[var(--panel-raised)] border border-[var(--border-mid)] text-[var(--text)] hover:border-[var(--border-accent)] hover:text-[var(--text-strong)]',
        variant === 'ghost' && 'text-[var(--muted)] hover:bg-[var(--panel-raised)] hover:text-[var(--gold)]',
        variant === 'danger' && 'bg-red-950/50 border border-red-800/40 hover:bg-red-900/60 text-red-300',
        className
      )}
    >
      {children}
    </button>
  )
}
