'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getTheme } from '@/lib/colorUtils'
import { SpinEvent, WheelSnapshot } from '@/lib/liveRoom'
import { easeOutCubic } from '@/lib/wheelMath'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import WheelCanvas from '@/components/wheel/WheelCanvas'
import WheelPointer from '@/components/wheel/WheelPointer'

// Matches the host's presentation-mode constants exactly.
// The lounge circle in the background art sits 190px right of the section
// centre; 38.5% from the top matches its vertical position at all viewports.
const PM_LEFT = 'calc(50vw + 190px)'
const PM_TOP = '38.5%'

type Status = 'loading' | 'not-found' | 'ready'

interface ViewerWinner {
  name: string
  imageUrl: string | null
}

export default function LiveRoomView() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('room') ?? ''
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const [status, setStatus] = useState<Status>('loading')
  const [snapshot, setSnapshot] = useState<WheelSnapshot | null>(null)
  const [currentEvent, setCurrentEvent] = useState<Record<string, unknown> | null>(null)
  const [connected, setConnected] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Viewer-side spin animation state
  const [viewerAngle, setViewerAngle] = useState(0)
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)
  // Winner data for the result reveal overlay — cleared when the host removes the winner
  const [viewerWinner, setViewerWinner] = useState<ViewerWinner | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastReplayedTimestampRef = useRef<number | null>(null)
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
          if (row.wheel_state != null) {
            setSnapshot(row.wheel_state)
            // Winner was removed on the host — clear the result reveal
            setWinnerIndex(null)
            setViewerWinner(null)
          }
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

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Replay spin events from the host
  useEffect(() => {
    if (!currentEvent || currentEvent.type !== 'spin' || !snapshot) return

    const event = currentEvent as unknown as SpinEvent

    if (event.timestamp < mountTimeRef.current) return
    if (event.timestamp === lastReplayedTimestampRef.current) return
    lastReplayedTimestampRef.current = event.timestamp

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setWinnerIndex(null)
    setViewerWinner(null)

    const { startAngle, targetAngle, duration } = event
    const elapsed = Math.max(0, Date.now() - event.timestamp)
    const startTime = performance.now() - elapsed

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
        const entry = idx !== -1 ? snapshot.config.entries[idx] : null
        setViewerWinner({
          name: event.winnerName,
          imageUrl: entry?.imageUrl ?? null,
        })
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

  const { config, wheelMode } = snapshot
  const theme = getTheme(config.themeId)
  const isPrizeMode = wheelMode === 'spin-for-prize'

  // ── Shared elements ───────────────────────────────────────────────────────

  const backgroundVideo = (
    <video
      src="/backgrounds/wheel-room-loop.mp4"
      poster="/backgrounds/wheel-room.png"
      autoPlay muted loop playsInline
      aria-hidden="true"
      onCanPlay={() => setVideoLoaded(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        transition: 'opacity 0.6s ease',
        opacity: videoLoaded ? 1 : 0,
        pointerEvents: 'none',
      }}
    />
  )

  const overlay = (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%)',
        pointerEvents: 'none',
      }}
    />
  )

  // Result reveal — shown after the spin lands, cleared when host removes the winner.
  // No host controls (no Spin Again, no Remove Winner).
  const resultReveal = viewerWinner ? (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
      style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 65%)' }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {viewerWinner.imageUrl && (
          <img
            src={viewerWinner.imageUrl}
            alt=""
            className="w-28 h-28 rounded-xl object-cover border border-[var(--border-accent)] shadow-[0_0_24px_-6px_var(--glow)]"
          />
        )}
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {isPrizeMode ? 'You landed on' : 'We have a winner!'}
        </p>
        <p className="text-2xl font-extrabold text-[var(--gold)] text-glow break-words leading-tight max-w-xs px-4">
          {viewerWinner.name.trim() || 'Unnamed entry'}
        </p>
      </div>
    </div>
  ) : null

  // Bottom result label — mirrors presentation mode's winner display
  const bottomResult = viewerWinner ? (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {isPrizeMode ? 'Prize' : 'Winner'}
      </p>
      <p className="text-xl font-bold text-[var(--gold)] text-glow whitespace-nowrap">
        {viewerWinner.name}
      </p>
    </div>
  ) : null

  const connectionIndicator = (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-[var(--muted)] opacity-40'}`}
        aria-hidden="true"
      />
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {connected ? 'Live' : 'Connecting'} · {roomCode}
      </p>
    </div>
  )

  const wheelRing = (
    <div
      className="wheel-seat glow-ring rounded-full p-1.5"
      style={{ width: '100%', height: '100%', transform: 'scale(0.923)', transformOrigin: 'center center' }}
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
  )

  // Title — absolutely positioned so it can never intrude on the wheel's space
  const title = (
    <h1 className="absolute top-5 w-full z-10 text-center text-2xl font-bold text-[var(--gold)] tracking-[0.12em] uppercase text-glow pointer-events-none">
      {config.name}
    </h1>
  )

  if (isDesktop) {
    return (
      <main
        className="relative h-screen overflow-hidden"
        style={{
          backgroundImage: 'url(/backgrounds/wheel-room.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {backgroundVideo}
        {overlay}
        {title}

        <div
          style={{
            position: 'absolute',
            left: PM_LEFT,
            top: PM_TOP,
            width: 'min(90vw, 90vh, 560px)',
            aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}
        >
          {wheelRing}
        </div>

        {resultReveal}
        {bottomResult}
        {connectionIndicator}
      </main>
    )
  }

  return (
    <main
      className="relative flex h-screen flex-col items-center justify-center overflow-hidden gap-6"
      style={{
        backgroundImage: 'url(/backgrounds/wheel-room.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {backgroundVideo}
      {overlay}
      {title}

      <div
        className="relative z-10"
        style={{ width: 'min(90vw, 90vh, 560px)', aspectRatio: '1 / 1' }}
      >
        {wheelRing}
      </div>

      {resultReveal}
      {bottomResult}
      {connectionIndicator}
    </main>
  )
}
