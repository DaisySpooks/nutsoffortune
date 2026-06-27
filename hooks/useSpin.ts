'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useWheelStore } from '@/store/wheelStore'
import {
  easeOutCubic,
  detectWinner,
  targetAngleForEntry,
  randomTargetAngle,
} from '@/lib/wheelMath'
import { broadcastSpinEvent, broadcastWheelState } from '@/lib/liveRoom'
import { v4 as uuid } from 'uuid'

function createTickAudio() {
  if (typeof window === 'undefined') return null
  const audio = new Audio('/sounds/wheel-tick.mp3')
  audio.volume = 0.15
  audio.preload = 'auto'
  return audio
}

function createClapAudio() {
  if (typeof window === 'undefined') return null
  const audio = new Audio('/sounds/golf-clap.mp3')
  audio.volume = 0.3
  audio.preload = 'auto'
  return audio
}

/**
 * Phase 3 — drives the wheel spin animation.
 *
 * Reads the spin parameters from the store, animates `currentAngle` from its
 * current value to a target angle with an ease-out curve, then resolves the
 * winner via the pure helpers in lib/wheelMath. All wheel-landing math lives in
 * wheelMath; this hook only owns the animation loop and the result side-effects.
 */
// Minimum ms between ticks — caps the rate when there are many entries so
// slice crossings don't create machine-gun bursts at high speed.
const MIN_TICK_MS = 60

export function useSpin() {
  const rafRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const clapAudioRef = useRef<HTMLAudioElement | null>(null)
  const lastSliceIdRef = useRef<string | null>(null)
  const lastTickTimeRef = useRef<number>(0)

  useEffect(() => {
    audioRef.current = createTickAudio()
    clapAudioRef.current = createClapAudio()
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const finishSpin = useCallback((finalAngle: number) => {
    const store = useWheelStore.getState()
    const entries = store.config.entries
    if (entries.length === 0) {
      store.setIsSpinning(false)
      return
    }

    const winner = detectWinner(finalAngle, entries)
    store.setIsSpinning(false)
    store.setWinner(winner)

    if (!winner) return

    if (store.config.sounds.enabled) {
      const clap = clapAudioRef.current
      if (clap) {
        clap.currentTime = 0
        clap.play().catch(() => { })
      }
    }

    // Announce the result.
    store.setShowWinnerModal(true)

    store.addToHistory({
      id: uuid(),
      entryId: winner.id,
      name: winner.name,
      imageUrl: winner.imageUrl,
      timestamp: Date.now(),
    })

    // Auto-remove resolves exactly once, here, the moment the spin lands. The
    // modal reads the wheel's contents to decide its UI, so it never offers a
    // second (duplicate) removal. When auto-remove is off the winner stays on
    // the wheel (and highlighted) until the user removes it from the modal.
    if (store.autoRemoveWinner) {
      store.autoRemoveEntry(winner.id)
      const updated = useWheelStore.getState()
      broadcastWheelState({
        config: updated.config,
        wheelMode: updated.wheelMode,
        autoRemoveWinner: updated.autoRemoveWinner,
      })
    }
  }, [])

  const spin = useCallback(() => {
    const store = useWheelStore.getState()
    const { config, isSpinning, currentAngle, isPredeterminedMode, predeterminedWinnerId } = store
    const entries = config.entries

    // Guard: need at least two entries and no spin already running.
    if (isSpinning || entries.length < 2) return

    // A fresh spin clears the previous result.
    store.setWinner(null)
    store.setShowWinnerModal(false)
    store.setIsSpinning(true)

    const startAngle = currentAngle
    lastSliceIdRef.current = null
    lastTickTimeRef.current = 0

    // Decide where to land. Predetermined mode steers to a specific entry;
    // otherwise the landing angle is random.
    let targetAngle: number
    if (isPredeterminedMode && predeterminedWinnerId) {
      const idx = entries.findIndex(e => e.id === predeterminedWinnerId)
      targetAngle =
        idx !== -1
          ? targetAngleForEntry(currentAngle, idx, entries)
          : randomTargetAngle(currentAngle)
    } else {
      targetAngle = randomTargetAngle(currentAngle)
    }
    const { minDuration, maxDuration } = config.spin
    const span = Math.max(0, maxDuration - minDuration)
    const duration = Math.max(1, minDuration + Math.random() * span)

    // Broadcast to live viewers immediately — all spin params are known now.
    // Winner is deterministic: detectWinner(targetAngle) == detectWinner(finalAngle)
    // because entries don't change during a spin.
    const liveWinner = detectWinner(targetAngle, entries)
    broadcastSpinEvent({
      type: 'spin',
      startAngle,
      targetAngle,
      duration,
      winnerId: liveWinner.id,
      winnerName: liveWinner.name,
      timestamp: Date.now(),
    })

    const startTime = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const angle = startAngle + (targetAngle - startAngle) * easeOutCubic(t)
      useWheelStore.getState().setCurrentAngle(angle)

      // Tick sound: fire on each new slice boundary, capped at MIN_TICK_MS so
      // many entries don't produce machine-gun bursts at high speed.
      const currentEntries = useWheelStore.getState().config.entries
      if (currentEntries.length > 0) {
        const sliceId = detectWinner(angle, currentEntries).id
        if (sliceId !== lastSliceIdRef.current && now - lastTickTimeRef.current > MIN_TICK_MS) {
          lastSliceIdRef.current = sliceId
          lastTickTimeRef.current = now
          const audio = audioRef.current
          if (audio) {
            audio.currentTime = 0
            audio.play().catch(() => { /* autoplay blocked — silently skip */ })
          }
        }
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
        finishSpin(targetAngle)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [finishSpin])

  return { spin }
}
