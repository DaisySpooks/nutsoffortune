'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTheme } from '@/lib/colorUtils'
import { SpinEvent, WheelSnapshot } from '@/lib/liveRoom'
import { easeOutCubic } from '@/lib/wheelMath'
import WheelCanvas from '@/components/wheel/WheelCanvas'
import WheelPointer from '@/components/wheel/WheelPointer'

type Status = 'loading' | 'not-found' | 'ready'

export default function LiveRoomView() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('room') ?? ''

  const [status, setStatus] = useState<Status>('loading')
  const [snapshot, setSnapshot] = useState<WheelSnapshot | null>(null)
  const [currentEvent, setCurrentEvent] = useState<Record<string, unknown> | null>(null)
  const [connected, setConnected] = useState(false)

  // Viewer-side spin animation state
  const [viewerAngle, setViewerAngle] = useState(0)
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)
  // Deduplication: only replay each event once, keyed by timestamp
  const lastReplayedTimestampRef = useRef<number | null>(null)
  // Ignore spin events that were stored before this viewer opened — they are
  // historical state, not live events the audience should see replayed.
  const mountTimeRef = useRef(Date.now())

  // Load room + subscribe to realtime updates
  useEffect(() => {
    if (!roomCode) {
      setStatus('not-found')
      return
    }

    async function load() {
      const { data, error } = await supabase
        .from('live_draw_rooms')
        .select('wheel_state, current_event')
        .eq('room_code', roomCode)
        .single()

      if (error || !data) {
        console.error('[LiveRoomView] fetch error:', error, '| data:', data)
        setStatus('not-found')
        return
      }

      setSnapshot(data.wheel_state as WheelSnapshot)
      setCurrentEvent((data.current_event as Record<string, unknown>) ?? null)
      setStatus('ready')
    }

    load()

    const channel = supabase
      .channel(`live_room_${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_draw_rooms',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          const row = payload.new as { wheel_state: WheelSnapshot | null; current_event: Record<string, unknown> | null }
          // wheel_state can be absent from the payload if the UPDATE only touched
          // current_event — keep the existing snapshot rather than overwriting with null.
          if (row.wheel_state != null) setSnapshot(row.wheel_state)
          setCurrentEvent(row.current_event ?? null)
        }
      )
      .subscribe((s) => {
        setConnected(s === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomCode])

  // Cancel any in-progress animation on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Replay spin events from the host
  useEffect(() => {
    if (!currentEvent || currentEvent.type !== 'spin' || !snapshot) return

    const event = currentEvent as unknown as SpinEvent

    // Skip events that predate this viewer session — they are persisted history,
    // not live spins the audience should see replayed on load.
    if (event.timestamp < mountTimeRef.current) return

    // Skip if this is the same event we already played
    if (event.timestamp === lastReplayedTimestampRef.current) return
    lastReplayedTimestampRef.current = event.timestamp

    // Cancel any previous animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setWinnerIndex(null)

    const { startAngle, targetAngle, duration } = event
    const startTime = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      setViewerAngle(startAngle + (targetAngle - startAngle) * easeOutCubic(t))

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
        setViewerAngle(targetAngle)
        const idx = snapshot.config.entries.findIndex(e => e.id === event.winnerId)
        setWinnerIndex(idx !== -1 ? idx : null)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [currentEvent, snapshot])

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
          {roomCode
            ? <>The room code <span className="font-mono tracking-widest">{roomCode}</span> does not exist or has expired.</>
            : 'No room code provided. Use a shared link to join a live draw.'}
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
          currentAngle={viewerAngle}
          theme={theme}
          displayMode={config.displayMode}
          winnerIndex={winnerIndex}
          backgroundUrl={null}
          editMode={false}
          onReorder={() => {}}
        />
      </div>

      {/* Connection indicator */}
      <div className="relative z-10 mt-6 flex items-center gap-2">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-[var(--muted)] opacity-40'}`}
          aria-hidden="true"
        />
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {connected ? 'Live' : 'Connecting'} · {roomCode}
        </p>
      </div>
    </main>
  )
}
