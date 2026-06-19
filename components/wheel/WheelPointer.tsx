'use client'

interface Props {
  color?: string
}

export default function WheelPointer({ color = '#e74c3c' }: Props) {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 pointer-events-none">
      <svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#f0892c" floodOpacity="0.5" />
        </filter>
        <polygon
          points="14,36 2,4 26,4"
          fill={color}
          stroke="#f7e6c4"
          strokeWidth="2"
          strokeLinejoin="round"
          filter="url(#shadow)"
        />
        <circle cx="14" cy="4" r="4" fill="#f0cd86" stroke="#2a1606" strokeWidth="0.75" />
      </svg>
    </div>
  )
}
