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
import PrizePreviewPanel from '@/components/presentation/PrizePreviewPanel'
import { broadcastIntroEvent, broadcastWheelState } from '@/lib/liveRoom'

// Cover-stage width — matches how object-fit:cover scales the 16:9 background.
const STAGE_W = 'max(100vw, calc(100vh * 16 / 9))'

// On ultrawide the stage would equal 100vw and the cover-scaled background circle
// inflates to fill the full width. Instead, pin everything to a 16:9 safe stage
// that is exactly as wide as the background at viewport height.
const SAFE_STAGE_W = 'calc(100vh * 16 / 9)'

// Circle center X: 59.896% of stage from its left edge.
// In viewport coords: (vw − stage)/2 + 59.896% × stage = 50vw + 9.896% × stage.
// At 1920×1080: 960 + 0.09896 × 1920 = 960 + 190 = 1150px (same as old hardcoded value).
const PM_LEFT = `calc(50vw + 0.12 * (${STAGE_W}))`
// Ultrawide variant: same formula but clamped to the safe 16:9 stage.
const PM_LEFT_UW = `calc(50vw + 0.12 * (${SAFE_STAGE_W}))`

// Y stays at 38.5% of section height (= 38.5vh in desktop). Exact at 16:9;
// minor drift at extreme ARs but not worth the complexity to fix.
const PM_TOP = '38.5%'

// Wheel container diameter: 29.167% of stage (= 560px at 1920px stage).
// Stage-relative so the wheel scales with the circular background frame.
const PM_WHEEL_SIZE = '560px'

// Half the visual wheel (container × scale(0.923) / 2 = 0.1346 × stage).
// Used to anchor the spin button just below the wheel bottom.
const PM_HALF_WHEEL = '260px'

export default function Home() {
  const { config, currentAngle, winner, isSpinning, reorderEntries, wheelMode } = useWheelStore()
  const theme = getTheme(config.themeId)
  const { spin } = useSpin()

  // Phase 6 — rehydrate the active wheel from IndexedDB and autosave changes.
  usePersistence()

  // Desktop direct-wheel editing — desktop only, never while spinning.
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isWideDesktop = useMediaQuery('(min-width: 1600px)')
  // Ultrawide: viewport is wider than 16:9 at its current height.
  // On these screens the cover-scaled background inflates to fill the full width,
  // breaking the wheel/circle alignment. We constrain presentation to a safe stage.
  const isUltrawide = useMediaQuery('(min-aspect-ratio: 16/9) and (min-width: 1024px)')
  // Two-stage cramped-desktop fallback (only applies when isDesktop is true).
  // Cramped: narrow (1024–1199px wide) AND short (600–699px tall).
  // Wide screens (≥1200px) never enter drawer mode regardless of height.
  const isDesktopCramped = useMediaQuery('(min-width: 1024px) and (max-width: 1199px) and (max-height: 699px)')
  // Too small: width < 1050px OR height < 600px — show blocking warning.
  const isDesktopTooNarrow = useMediaQuery('(min-width: 1024px) and (max-width: 1049px)')
  const isDesktopTooShort = useMediaQuery('(min-width: 1024px) and (max-height: 599px)')
  const isDesktopTooSmall = isDesktopTooNarrow || isDesktopTooShort
  // When cramped, the aside stays at width 0; the editor surfaces as an overlay instead.
  const [crampedEditorOpen, setCrampedEditorOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const [prizesPanelOpen, setPrizesPanelOpen] = useState(false)
  const [prizePageIndex, setPrizePageIndex] = useState(0)
  // Pick the ultrawide-safe PM_LEFT when in presentation on a wider-than-16:9 viewport.
  const pmLeftActive = (isUltrawide && presentationMode) ? PM_LEFT_UW : PM_LEFT
  const [videoLoaded, setVideoLoaded] = useState(false)
  const canEdit = editMode && isDesktop && !isSpinning

  const introAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isIntroPlaying, setIsIntroPlaying] = useState(false)
  const introVolume = config.sounds.introMusicVolume ?? 0.8

  // Lock the document from scrolling while in presentation mode.
  // This prevents body-level scrollbars caused by 100vh/min-h quirks on ultrawide.
  useEffect(() => {
    if (!isDesktop || !presentationMode) {
      document.documentElement.style.overflow = ''
      return
    }
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = '' }
  }, [presentationMode, isDesktop])

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
    setPrizePageIndex(0)
    const s = useWheelStore.getState()
    broadcastWheelState({ config: s.config, wheelMode: s.wheelMode, autoRemoveWinner: s.autoRemoveWinner, showPrizePreview: false })
  }

  function exitPresentation() {
    if (introAudioRef.current && isIntroPlaying) {
      introAudioRef.current.pause()
      introAudioRef.current.currentTime = 0
      setIsIntroPlaying(false)
    }
    setPresentationMode(false)
    setPrizesPanelOpen(false)
    setPrizePageIndex(0)
  }

  const entries = config.entries
  const winnerIndex = winner
    ? entries.findIndex(e => e.id === winner.id)
    : null

  // Derived: treat editor as hidden when presentation mode OR cramped-and-collapsed
  // The aside panel is always width-0 when cramped (overlay takes over) or in presentation mode.
  const editorHidden = presentationMode || isDesktopCramped

  return (
    <main
      className="flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden"
      style={presentationMode ? { height: '100dvh', overflow: 'hidden' } : undefined}
    >
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
          // Lock the section to the dynamic viewport height in presentation mode.
          // This beats the min-h-[55vw] Tailwind class (which on ultrawide can
          // exceed 100vh and create document-level scrollbars) and corrects any
          // 100vh vs 100dvh discrepancy from h-screen on the parent main.
          ...(presentationMode ? { height: '100dvh', minHeight: 0, overflow: 'hidden' } : {}),
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
              left: presentationMode ? pmLeftActive : 'calc(50vw - 210px)',
              top: presentationMode ? PM_TOP : 'calc(50% - 31px)',
              width: presentationMode ? PM_WHEEL_SIZE : 'min(90vw, 90vh, 560px)',
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.6s cubic-bezier(0.22, 1, 0.36, 1), top 0.6s cubic-bezier(0.22, 1, 0.36, 1), width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
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
            {/* Prize preview panel — left side, desktop only */}
            <PrizePreviewPanel
              open={prizesPanelOpen}
              onClose={() => { setPrizesPanelOpen(false); setPrizePageIndex(0) }}
              entries={entries}
              wheelMode={wheelMode}
              isSpinning={isSpinning}
              pageIndex={prizePageIndex}
              onPageChange={setPrizePageIndex}
            />

            {/* Spin button anchored just below the wheel */}
            <div
              className="absolute"
              style={{
                left: pmLeftActive,
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

            {/* Bottom-left controls row */}
            <div className="hidden lg:flex absolute bottom-5 left-5 items-center gap-2">
              {/* View Prizes / View Entries toggle */}
              <button
                onClick={() => setPrizesPanelOpen(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
              >
                {prizesPanelOpen
                  ? (wheelMode === 'spin-for-prize' ? 'Hide Prizes' : 'Hide Entries')
                  : (wheelMode === 'spin-for-prize' ? 'View Prizes' : 'View Entries')}
              </button>

              {/* Play/Stop Intro */}
              <button
                onClick={toggleIntro}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border border-[var(--border-mid)] text-[var(--muted)] bg-black/40 hover:text-[var(--gold)] hover:border-[var(--border-accent)] transition-colors"
              >
                {isIntroPlaying ? 'Stop Intro' : 'Play Intro'}
              </button>
            </div>

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
