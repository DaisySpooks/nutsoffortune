'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTheme } from '@/lib/colorUtils'
import { WheelSnapshot } from '@/lib/liveRoom'
import WheelCanvas from '@/components/wheel/WheelCanvas'
import WheelPointer from '@/components/wheel/WheelPointer'

type Status = 'loading' | 'not-found' | 'ready'

export default function LiveRoomView() {
  // usePathname gives the real browser URL even though the shell was pre-rendered
  // for roomCode='index'. Extract the actual room code from the live pathname.
  const pathname = usePathname()
  const roomCode = pathname.split('/').filter(Boolean).at(-1) ?? ''

  const [status, setStatus] = useState<Status>('loading')
  const [snapshot, setSnapshot] = useState<WheelSnapshot | null>(null)

  useEffect(() => {
    if (!roomCode) return

    async function load() {
      const { data, error } = await supabase
        .from('live_draw_rooms')
        .select('wheel_state')
        .eq('room_code', roomCode)
        .single()

      if (error || !data) {
        setStatus('not-found')
        return
      }

      setSnapshot(data.wheel_state as WheelSnapshot)
      setStatus('ready')
    }

    load()
  }, [roomCode])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0e0905]">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)] animate-pulse">
          Loading room…
        </p>
      </div>
    )
  }

  if (status === 'not-found' || !snapshot) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0e0905]">
        <p className="text-lg font-semibold text-[var(--gold)]">Room not found</p>
        <p className="text-sm text-[var(--muted)]">
          The room code <span className="font-mono tracking-widest">{roomCode}</span> does not exist or has expired.
        </p>
      </div>
    )
  }

  const { config } = snapshot
  const theme = getTheme(config.themeId)

  return (
    <main
      className="flex h-screen flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/backgrounds/wheel-room.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      <h1 className="relative z-10 text-2xl font-bold text-[var(--gold)] mb-8 tracking-[0.12em] uppercase text-glow">
        {config.name}
      </h1>

      <div
        className="relative z-10 wheel-seat glow-ring rounded-full p-1.5"
        style={{ width: 'min(90vw, 90vh, 560px)', aspectRatio: '1 / 1' }}
      >
        <WheelPointer color={theme.pointerColor} />
        <WheelCanvas
          entries={config.entries}
          currentAngle={0}
          theme={theme}
          displayMode={config.displayMode}
          winnerIndex={null}
          backgroundUrl={null}
          editMode={false}
          onReorder={() => {}}
        />
      </div>

      <p className="relative z-10 mt-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Live · {roomCode}
      </p>
    </main>
  )
}
