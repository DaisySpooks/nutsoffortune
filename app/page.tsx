'use client'

import { useState, useRef, useEffect } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import { getTheme } from '@/lib/colorUtils'
import { useSpin } from '@/hooks/useSpin'
import { usePersistence } from '@/hooks/usePersistence'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { clsx } from 'clsx'
import WheelCanvas from '@/components/wheel/WheelCanvas'
import WheelPointer from '@/components/wheel/WheelPointer'
import SpinButton from '@/components/wheel/SpinButton'
import EditorPanel from '@/components/editor/EditorPanel'
import WinnerModal from '@/components/modals/WinnerModal'
import { broadcastIntroEvent, broadcastWheelState } from '@/lib/liveRoom'

// Presentation-mode focal point — lounge circle center as fractions of the
// wheel stage. X is (50% + 190px) because the circle sits 190px right of the
// section center when the background is cover+center. Y is 38.5% because
// height drives cover at all desktop viewports, keeping the circle at a
// constant fraction of section height regardless of viewport width.
const PM_LEFT = 'calc(50vw + 190px)'
const PM_TOP = '38.5%'
// Half-wheel width, matching the min() size rule — used to place the spin
// button just below the wheel bottom.
const PM_HALF_WHEEL = 'min(24vw, 33vh, 260px)'

export default function Home() {
  const { config, currentAngle, winner, isSpinning, reorderEntries, wheelMode } = useWheelStore()
  const theme = getTheme(config.themeId)
  const { spin } = useSpin()

  // Phase 6 — rehydrate the active wheel from IndexedDB and autosave changes.
  usePersistence()

  // Desktop direct-wheel editing — desktop only, never while spinning.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isWideDesktop = useMediaQuery('(min-width: 1600px)')
  // Two-stage cramped-desktop fallback (only applies when isDesktop is true).
  const isDesktopCramped = useMediaQuery('(min-width: 1024px) and (max-height: 599px)')
  // "Too small" fires when the desktop viewport is narrower than 1200px or shorter than 700px.
  const isDesktopTooNarrow = useMediaQuery('(min-width: 1024px) and (max-width: 1199px)')
  const isDesktopTooShort  = useMediaQuery('(min-width: 1024px) and (max-height: 699px)')
  const isDesktopTooSmall  = isDesktopTooNarrow || isDesktopTooShort
  // When cramped, the aside stays at width 0; the editor surfaces as an overlay instead.
  const [crampedEditorOpen, setCrampedEditorOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const canEdit = editMode && isDesktop && !isSpinning

  const introAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isIntroPlaying, setIsIntroPlaying] = useState(false)
  const introVolume = config.sounds.introMusicVolume ?? 0.8

  // Close the cramped overlay whenever the viewport recovers to normal desktop size.
  useEffect(() => {
    if (!isDesktopCramped) setCrampedEditorOpen(false)
  }, [isDesktopCramped])

  // Keep the audio volume in sync with the persisted setting.
  useEffect(() => {
    if (introAudioRef.current) {
      introAudioRef.current.volume = introVolume
    }
  }, [introVolume])

  function getIntroAudio(): HTMLAudioElement {
    if (!introAudioRef.current) {
      const audio = new Audio('/sounds/nuts-of-fortune-intro.mp3')
      audio.loop = false
      audio.volume = introVolume
      audio.addEventListener('ended', () => setIsIntroPlaying(false))
      introAudioRef.current = audio
    }
    return introAudioRef.current
  }

  function toggleIntro() {
    if (isIntroPlaying) {
      const audio = introAudioRef.current
      if (audio) { audio.pause(); audio.currentTime = 0 }
      setIsIntroPlaying(false)
      broadcastIntroEvent(false)
    } else {
      const audio = getIntroAudio()
      audio.currentTime = 0
      audio.play()
      setIsIntroPlaying(true)
      broadcastIntroEvent(true)
    }
  }

  function enterPresentation() {
    setEditMode(false)
    setPresentationMode(true)
    const s = useWheelStore.getState()
    broadcastWheelState({ config: s.config, wheelMode: s.wheelMode, autoRemoveWinner: s.autoRemoveWinner })
  }

  function exitPresentation() {
    if (introAudioRef.current && isIntroPlaying) {
      introAudioRef.current.pause()
      introAudioRef.current.currentTime = 0
      setIsIntroPlaying(false)
    }
    setPresentationMode(false)
  }

  const entries = config.entries
  const winnerIndex = winner
    ? entries.findIndex(e => e.id === winner.id)
    : null

  // Derived: treat editor as hidden when presentation mode OR cramped-and-collapsed
  // The aside panel is always width-0 when cramped (overlay takes over) or in presentation mode.
  const editorHidden = presentationMode || isDesktopCramped

  return (
    <main className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* ── Too-small desktop warning overlay ── */}
      {isDesktopTooSmall && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 text-center px-6">
          <p className="text-2xl font-bold text-[var(--gold)] tracking-[0.1em] uppercase mb-2">Window too small</p>
          <p className="text-sm text-[var(--muted)]">Please enlarge your browser window to use the editor.</p>
        </div>
      )}
      {/* Wheel section */}
      <section
        className={clsx(
          'wheel-stage relative flex flex-col items-center flex-1 min-h-[55vw] lg:min-h-0 lg:overflow-hidden',
          // Presentation mode: title floats at top with padding; no justify-center
          // since wheel and spin button are absolutely positioned.
          presentationMode ? 'pt-5' : 'justify-center p-6'
        )}
        style={{
          backgroundImage: 'url(/backgrounds/wheel-room.png)',
          backgroundSize: 'cover',
          backgroundPosition: editorHidden ? 'center' : 'calc((100vw - 420px) / 2 - 113.3vh) 80px',
        }}
      >
        {/* Animated video background — sits behind all content via DOM order */}
        <video
          src="/backgrounds/wheel-room-loop.mp4"
          poster="/backgrounds/wheel-room.png"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          onCanPlay={() => setVideoLoaded(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: editorHidden ? 'center' : 'calc((100vw - 420px) / 2 - 113.3vh) 80px',
            transition: 'opacity 0.6s ease, object-position 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            opacity: videoLoaded ? 1 : 0,
            pointerEvents: 'none',
          }}
        />
        {/* Dark radial overlay — sits above video, below all wheel content */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.72) 100%)',
            pointerEvents: 'none',
          }}
        />

        <h1 className={clsx(
          'text-2xl font-bold text-[var(--gold)] tracking-[0.12em] uppercase text-glow',
          presentationMode
            // Constrained to the left zone — wheel is at calc(50vw+190px) so its
            // left edge is ~50vw−68px; stopping at calc(50vw+100px) from the right
            // keeps the title safely clear of it.
            ? 'absolute top-5 left-4 right-[calc(50vw+100px)] z-10 text-center pointer-events-none'
            : 'mb-5'
        )}>
          {config.name}
        </h1>

        {/* ── Desktop: single wheel, always absolutely positioned, animates between anchors ── */}
        {isDesktop && (
          <div
            style={{
              position: 'absolute',
              left: presentationMode ? PM_LEFT : 'calc(50vw - 210px)',
              top: presentationMode ? PM_TOP : 'calc(50% - 31px)',
              width: 'min(90vw, 90vh, 560px)',
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.6s cubic-bezier(0.22, 1, 0.36, 1), top 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div
              className="wheel-seat glow-ring rounded-full p-1.5"
              style={{
                width: '100%',
                height: '100%',
                transform: presentationMode ? 'scale(0.923)' : isWideDesktop ? 'scale(0.857)' : 'scale(1)',
                transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                transformOrigin: 'center center',
              }}
            >
              <WheelPointer color={theme.pointerColor} />
              <WheelCanvas
                entries={entries}
                currentAngle={currentAngle}
                theme={theme}
                displayMode={config.displayMode}
                winnerIndex={winnerIndex}
                backgroundUrl={null}
                editMode={canEdit}
                onReorder={reorderEntries}
              />
            </div>
          </div>
        )}

        {/* ── Mobile: wheel in normal flex flow ── */}
        {!isDesktop && (
          <div
            className="wheel-seat glow-ring relative aspect-square w-full rounded-full p-1.5"
            style={{ maxWidth: 'min(90vw, 90vh, 560px)' }}
          >
            <WheelPointer color={theme.pointerColor} />
            <WheelCanvas
              entries={entries}
              currentAngle={currentAngle}
              theme={theme}
              displayMode={config.displayMode}
              winnerIndex={winnerIndex}
              backgroundUrl={null}
              editMode={false}
              onReorder={reorderEntries}
            />
          </div>
        )}

        {presentationMode ? (
          <>
            {/* Spin button anchored just below the wheel */}
            <div
              className="absolute"
              style={{
                left: PM_LEFT,
                top: `calc(${PM_TOP} + ${PM_HALF_WHEEL} + 20px)`,
                transform: 'translateX(-50%)',
              }}
            >
              <SpinButton
                isSpinning={isSpinning}
                disabled={entries.length < 2}
                onSpin={spin}
              />
            </div>

            {/* Play/Stop Intro — bottom-left corner */}
            <button
              onClick={toggleIntro}
              className="hidden lg:inline-flex absolute bottom-5 left-5 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
            >
              {isIntroPlaying ? 'Stop Intro' : 'Play Intro'}
            </button>

            {/* Show editor — bottom-right corner */}
            <button
              onClick={exitPresentation}
              className="hidden lg:inline-flex absolute bottom-5 right-5 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
            >
              Show editor
            </button>
          </>
        ) : (
          <>
            {/* Desktop placeholder — invisible, keeps flex flow spacing identical to before */}
            {isDesktop && (
              <div
                className="w-full"
                style={{ maxWidth: isWideDesktop ? 'min(90vw, 90vh, 480px)' : 'min(90vw, 90vh, 560px)', aspectRatio: '1 / 1', visibility: 'hidden', pointerEvents: 'none' }}
              />
            )}

            <SpinButton
              isSpinning={isSpinning}
              disabled={entries.length < 2}
              onSpin={spin}
            />

            {/* Cramped-desktop: open editor as overlay */}
            {isDesktopCramped && !crampedEditorOpen && (
              <button
                onClick={() => setCrampedEditorOpen(true)}
                className="absolute bottom-5 right-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
              >
                Show Editor
              </button>
            )}
          </>
        )}

        {/* Winner label — absolute so it never shifts the wheel position */}
        {winner && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{wheelMode === 'spin-for-prize' ? 'Prize' : 'Winner'}</p>
            <p className="text-xl font-bold text-[var(--gold)] text-glow whitespace-nowrap">{winner.name}</p>
          </div>
        )}
      </section>

      {/* ── Cramped-desktop editor overlay — slides in from the right, sits above the wheel ── */}
      {isDesktopCramped && (
        <div
          aria-hidden={!crampedEditorOpen}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            pointerEvents: crampedEditorOpen ? undefined : 'none',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setCrampedEditorOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              opacity: crampedEditorOpen ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />
          {/* Drawer panel */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '420px',
              maxWidth: '90vw',
              transform: crampedEditorOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              display: 'flex',
              flexDirection: 'column',
            }}
            className="bg-[var(--panel)] border-l border-[var(--border-mid)]"
          >
            {/* Drawer close button */}
            <div className="px-4 py-2 flex justify-end border-b border-[var(--border-mid)]">
              <button
                onClick={() => setCrampedEditorOpen(false)}
                className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
              >
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <EditorPanel
                editMode={editMode}
                canEdit={false}
                isDesktop={isDesktop}
                isSpinning={isSpinning}
                onToggleEdit={() => setEditMode(v => !v)}
                onHide={() => setCrampedEditorOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Editor aside — always mounted on desktop so width can animate smoothly */}
      <aside
        className="w-full lg:h-full border-t border-[var(--border-mid)] lg:border-t-0 lg:border-l border-[var(--border-mid)] bg-[var(--panel)] flex flex-col"
        style={isDesktop ? {
          width: editorHidden ? 0 : '420px',
          flexShrink: 0,
          overflow: 'hidden',
          pointerEvents: editorHidden ? 'none' : undefined,
          transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        } : undefined}
      >
        <div className="w-full lg:w-[420px] h-full flex flex-col min-h-0">
          <EditorPanel
            editMode={editMode}
            canEdit={canEdit}
            isDesktop={isDesktop}
            isSpinning={isSpinning}
            onToggleEdit={() => setEditMode(v => !v)}
            onHide={enterPresentation}
          />
        </div>
      </aside>

      {/* Spin result announcement */}
      <WinnerModal onSpinAgain={spin} />
    </main>
  )
}
