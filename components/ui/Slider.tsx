'use client'

interface Props {
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
  label?: string
  formatValue?: (v: number) => string
}

export default function Slider({ min, max, step = 1, value, onChange, label, formatValue }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">{label}</span>
          <span className="text-[var(--gold)] font-medium">{formatValue ? formatValue(value) : value}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)] cursor-pointer"
      />
    </div>
  )
}
