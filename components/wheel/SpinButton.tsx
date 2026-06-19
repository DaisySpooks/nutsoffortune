'use client'

interface Props {
  isSpinning: boolean
  disabled: boolean
  onSpin: () => void
}

export default function SpinButton({ isSpinning, disabled, onSpin }: Props) {
  return (
    <button
      onClick={onSpin}
      disabled={disabled || isSpinning}
      className="
        mt-5 px-12 py-3 rounded-full font-extrabold text-lg tracking-[0.18em] uppercase
        bg-gradient-to-b from-[var(--accent-hi)] to-[var(--accent-deep)]
        text-[#2a1606]
        ring-1 ring-inset ring-[#ffd9a0]/40
        shadow-[0_4px_28px_-4px_var(--glow),inset_0_1px_0_rgba(255,224,180,0.45)]
        hover:brightness-110
        active:scale-95 transition-all
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hi)]
      "
      aria-label={isSpinning ? 'Spinning…' : 'Spin the wheel'}
    >
      {isSpinning ? 'Spinning…' : 'SPIN'}
    </button>
  )
}
