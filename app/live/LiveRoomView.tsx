'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { supabase } from '@/lib/supabase'
import { getTheme } from '@/lib/colorUtils'
import { IntroEvent, SpinEvent, WheelSnapshot } from '@/lib/liveRoom'
import { detectWinner, easeOutCubic } from '@/lib/wheelMath'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import WheelCanvas from '@/components/wheel/WheelCanvas'
import WheelPointer from '@/components/wheel/WheelPointer'
import PrizePreviewPanel from '@/components/presentation/PrizePreviewPanel'

// Must match useSpin.ts — caps tick rate when there are many entries.
const MIN_TICK_MS = 60

type Status = 'loading' | 'not-found' | 'expired' | 'ready'

const ROOM_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

interface ViewerWinner {
  name: string
  imageUrl: string | null
}

export default function LiveRoomView() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('room') ?? ''
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isMobileLandscape = useMediaQuery('(orientation: landscape) and (max-width: 1023px)')

  const [status, setStatus] = useState<Status>('loading')
  const [snapshot, setSnapshot] = useState<WheelSnapshot | null>(null)
  const [currentEvent, setCurrentEvent] = useState<Record<string, unknown> | null>(null)
  const [connected, setConnected] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Viewer-side spin animation state
  const [viewerAngle, setViewerAngle] = useState(0)
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)
  const [viewerWinner, setViewerWinner] = useState<ViewerWinner | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastReplayedTimestampRef = useRef<number | null>(null)
  const mountTimeRef = useRef(Date.now())

  // Live viewer's own panel state — not synced from host
  const [livePreviewOpen, setLivePreviewOpen] = useState(false)
  const [livePreviewPage, setLivePreviewPage] = useState(0)
  const [isViewerSpinning, setIsViewerSpinning] = useState(false)

  // Sound state — refs are used in RAF closures (always current value);
  // the soundEnabled boolean drives the button UI only.
  const [soundEnabled, setSoundEnabled] = useState(false)
  const soundEnabledRef = useRef(false)
  const tickAudioRef = useRef<HTMLAudioElement | null>(null)
  const introAudioRef = useRef<HTMLAudioElement | null>(null)
  const clapAudioRef = useRef<HTMLAudioElement | null>(null)
  const lastSliceIdRef = useRef<string | null>(null)
  const lastTickTimeRef = useRef<number>(0)

  // Load room + subscribe to realtime updates
  useEffect(() => {
    if (!roomCode) {
      setStatus('not-found')
      return
    }

    async function load() {
      const { data, error } = await supabase
        .from('live_draw_rooms')
        .select('wheel_state, current_event, created_at')
        .eq('room_code', roomCode)
        .single()

      if (error || !data) {
        console.error('[LiveRoomView] fetch error:', error, '| data:', data)
        setStatus('not-found')
        return
      }

      if (Date.now() - new Date(data.created_at as string).getTime() > ROOM_TTL_MS) {
        setStatus('expired')
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
            // Clear wheel-slice highlight whenever entries may have changed.
            // Do NOT clear viewerWinner — Supabase sends the full row on every
            // UPDATE so clearing here would race against the reveal the animation
            // just set. viewerWinner is cleared only at the start of the next spin.
            setWinnerIndex(null)
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

  // Cancel any in-flight RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      introAudioRef.current?.pause()
    }
  }, [])

  // Replay spin events from the host — also drives tick sounds via the RAF loop
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
    setIsViewerSpinning(true)

    const { startAngle, targetAngle, duration } = event
    const elapsed = Math.max(0, Date.now() - event.timestamp)
    const snap = snapshot  // captured non-null for use in closures

    // Seed tick refs at the compensated start position so that:
    // (a) the first RAF frame does not fire a spurious immediate tick for the
    //     slice that was already under the pointer before animation begins, and
    // (b) enabling sound mid-spin cannot unconditionally fire a tick because
    //     lastTickTimeRef starts at now rather than 0.
    const initialT = Math.min(elapsed / duration, 1)
    const initialAngle = startAngle + (targetAngle - startAngle) * easeOutCubic(initialT)
    lastSliceIdRef.current = snap.config.entries.length > 0
      ? detectWinner(initialAngle, snap.config.entries).id
      : null
    lastTickTimeRef.current = performance.now()

    function finishNow() {
      setIsViewerSpinning(false)
      setViewerAngle(targetAngle)
      const idx = snap.config.entries.findIndex(e => e.id === event.winnerId)
      setWinnerIndex(idx !== -1 ? idx : null)
      const entry = idx !== -1 ? snap.config.entries[idx] : null
      setViewerWinner({ name: event.winnerName, imageUrl: entry?.imageUrl ?? null })
      if (soundEnabledRef.current && clapAudioRef.current) {
        clapAudioRef.current.currentTime = 0
        clapAudioRef.current.play().catch(() => { })
      }
    }

    if (elapsed >= duration) {
      finishNow()
      return
    }

    const startTime = performance.now() - elapsed

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const angle = startAngle + (targetAngle - startAngle) * easeOutCubic(t)
      setViewerAngle(angle)

      // Tick sound — same slice-boundary detection and throttle as useSpin.ts
      if (soundEnabledRef.current && tickAudioRef.current && snap.config.entries.length > 0) {
        const sliceId = detectWinner(angle, snap.config.entries).id
        if (sliceId !== lastSliceIdRef.current && now - lastTickTimeRef.current > MIN_TICK_MS) {
          lastSliceIdRef.current = sliceId
          lastTickTimeRef.current = now
          tickAudioRef.current.currentTime = 0
          tickAudioRef.current.play().catch(() => { })
        }
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
        finishNow()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [currentEvent, snapshot])

  // React to intro events from the host
  useEffect(() => {
    if (!currentEvent || currentEvent.type !== 'intro') return
    const event = currentEvent as unknown as IntroEvent
    if (event.timestamp < mountTimeRef.current) return // stale — ignore

    if (event.playing) {
      if (soundEnabledRef.current && introAudioRef.current) {
        const startedAt = event.startedAt ?? event.timestamp
        const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000)

        if (
          Number.isFinite(introAudioRef.current.duration) &&
          elapsedSeconds >= introAudioRef.current.duration
        ) {
          introAudioRef.current.pause()
          introAudioRef.current.currentTime = 0
          return
        }

        introAudioRef.current.currentTime = elapsedSeconds
        introAudioRef.current.play().catch(() => { })
      }
    } else {
      if (introAudioRef.current) {
        introAudioRef.current.pause()
        introAudioRef.current.currentTime = 0
      }
    }
  }, [currentEvent])


  // Toggles viewer sound on/off. The first enable is the browser user-gesture
  // that unlocks autoplay; subsequent toggles reuse the already-created objects.
  function toggleSound() {
    if (!soundEnabled) {
      // ── Enable ──────────────────────────────────────────────────────────────
      if (!tickAudioRef.current) {
        // First time: create audio and do a silent play to unlock the audio
        // context (iOS Safari requires an actual play call, not just construction).
        const a = new Audio('/sounds/wheel-tick.mp3')
        a.volume = 0.15
        a.preload = 'auto'
        a.play().catch(() => { })
        tickAudioRef.current = a
      }
      if (!introAudioRef.current) {
        const a = new Audio('/sounds/nuts-of-fortune-intro.mp3')
        a.volume = snapshot?.config.sounds.introMusicVolume ?? 0.8
        a.loop = false
        introAudioRef.current = a
      }
      if (!clapAudioRef.current) {
        const a = new Audio('/sounds/golf-clap.mp3')
        a.volume = 0.3
        a.preload = 'auto'
        clapAudioRef.current = a
      }
      soundEnabledRef.current = true
      setSoundEnabled(true)
      // If the host's intro is currently playing, resume at the correct position.
      if (
        currentEvent?.type === 'intro' &&
        (currentEvent as unknown as IntroEvent).playing &&
        (currentEvent as unknown as IntroEvent).timestamp >= mountTimeRef.current
      ) {
        const event = currentEvent as unknown as IntroEvent
        const startedAt = event.startedAt ?? event.timestamp
        const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000)
        const audio = introAudioRef.current
        if (
          Number.isFinite(audio.duration) &&
          elapsedSeconds >= audio.duration
        ) {
          // Intro already finished — don't restart it.
        } else {
          audio.currentTime = elapsedSeconds
          audio.play().catch(() => { })
        }
      }
    } else {
      // ── Disable ─────────────────────────────────────────────────────────────
      soundEnabledRef.current = false
      setSoundEnabled(false)
      // Stop intro music immediately; tick sounds stop naturally since the RAF
      // loop checks soundEnabledRef.current before each play() call.
      if (introAudioRef.current) {
        introAudioRef.current.pause()
        introAudioRef.current.currentTime = 0
      }
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0e0905]">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)] animate-pulse">
          Loading room…
        </p>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0e0905]">
        <p className="text-lg font-semibold text-[var(--gold)]">Room expired</p>
        <p className="text-sm text-[var(--muted)]">
          Live rooms are only available for 24 hours. Ask the host to start a new live room.
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

  const bgOverlay = (
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

  // Sound toggle — bottom-left corner, same pill style as the host's "Play Intro" button.
  // First click is the browser user-gesture that unlocks autoplay; subsequent clicks toggle.
  const soundControl = (
    <button
      onClick={toggleSound}
      className="absolute bottom-5 left-5 z-30 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
      aria-pressed={soundEnabled}
    >
      {soundEnabled ? 'Disable Sound' : 'Enable Sound'}
    </button>
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
        onReorder={() => { }}
      />
    </div>
  )

  // Desktop: title pinned to the left safe zone (wheel occupies right half from ~50vw−68px).
  // Mobile: full-width centered (wheel is below in flex flow, no horizontal overlap).
  const title = (
    <h1 className={clsx(
      'absolute top-5 z-10 text-2xl font-bold text-[var(--gold)] tracking-[0.12em] uppercase text-glow pointer-events-none text-center',
      isDesktop
        ? 'left-4 right-[calc(50vw+100px)]'
        : 'w-full'
    )}>
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
        {bgOverlay}
        {title}

        {/* Cover stage — mirrors object-fit:cover scaling of the 16:9 video so the
            wheel position tracks the circular frame at any viewport aspect ratio. */}
        <div
          style={{
            position: 'absolute',
            width: 'max(100vw, calc(100vh * 16 / 9))',
            height: 'max(100vh, calc(100vw * 9 / 16))',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '63%',
              top: '38.5%',
              width: '36%',
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              zIndex: 10,
            }}
          >
            {wheelRing}
          </div>
        </div>

        {/* Prize/Entries preview panel — viewer-controlled */}
        <PrizePreviewPanel
          open={livePreviewOpen}
          onClose={() => { setLivePreviewOpen(false); setLivePreviewPage(0) }}
          entries={config.entries}
          wheelMode={wheelMode}
          isSpinning={isViewerSpinning}
          pageIndex={livePreviewPage}
          onPageChange={setLivePreviewPage}
        />

        {resultReveal}
        {bottomResult}

        {/* Bottom-left controls: sound + prizes toggle */}
        <div className="absolute bottom-5 left-5 z-30 flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? 'Disable Sound' : 'Enable Sound'}
          </button>
          <button
            onClick={() => setLivePreviewOpen(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
          >
            {livePreviewOpen
              ? (isPrizeMode ? 'Hide Prizes' : 'Hide Entries')
              : (isPrizeMode ? 'View Prizes' : 'View Entries')}
          </button>
        </div>

        {connectionIndicator}
      </main>
    )
  }

  // ── Mobile landscape guard ───────────────────────────────────────────────
  if (isMobileLandscape) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0e0905] px-8 text-center">
        <p className="text-lg font-bold text-[var(--gold)] tracking-[0.08em] uppercase text-glow">
          Rotate your phone back to portrait mode
        </p>
        <p className="text-sm text-[var(--muted)]">
          Nuts of Fortune works best upright.
        </p>
      </div>
    )
  }

  // ── Mobile layout ────────────────────────────────────────────────────────
  // Title, wheel, and bottom controls are all in-flow (no absolute positioning)
  // so nothing overlaps or hides behind browser chrome.
  return (
    <main
      className="relative flex flex-col items-center overflow-hidden"
      style={{
        height: '100svh',
        backgroundImage: 'url(/backgrounds/wheel-room-mobile.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 52%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {bgOverlay}

      {/* Title — in-flow so it can't overlap the wheel */}
      <h1 className="relative z-10 w-full shrink-0 px-4 pt-4 pb-1 text-xl font-bold text-[var(--gold)] tracking-[0.12em] uppercase text-glow text-center">
        {config.name}
      </h1>

      {/* Wheel — fills remaining space between title and bottom bar */}
      <div className="relative z-10 flex flex-1 min-h-0 w-full items-center justify-center py-2">
        <div style={{ width: 'min(88vw, 65svh)', aspectRatio: '1 / 1' }}>
          {wheelRing}
        </div>
      </div>

      {/* Winner strip — always rendered so it reserves space and the wheel
          position stays fixed against the background in all states */}
      <div className="relative z-30 w-full shrink-0 text-center pointer-events-none px-4 pb-1 min-h-[3rem]">
        {viewerWinner && (
          <>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {isPrizeMode ? 'Prize' : 'Winner'}
            </p>
            <p className="text-lg font-bold text-[var(--gold)] text-glow break-words leading-tight">
              {viewerWinner.name}
            </p>
          </>
        )}
      </div>

      {/* Bottom bar — in-flow with safe-area padding so it clears browser chrome */}
      <div
        className="relative z-30 w-full shrink-0 flex items-center justify-between px-4 pt-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)' }}
      >
        <button
          onClick={toggleSound}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
          aria-pressed={soundEnabled}
        >
          {soundEnabled ? 'Disable Sound' : 'Enable Sound'}
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-[var(--muted)] opacity-40'}`}
            aria-hidden="true"
          />
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {connected ? 'Live' : 'Connecting'} · {roomCode}
          </p>
        </div>
      </div>

      {/* Full-screen winner overlay (centered, above the flex flow) */}
      {resultReveal}
    </main>
  )
}
