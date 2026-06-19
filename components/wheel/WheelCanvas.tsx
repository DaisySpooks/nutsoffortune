'use client'

import { useEffect, useRef, useCallback } from 'react'
import { WheelEntry, DisplayMode } from '@/types/wheel'
import { ThemePreset } from '@/types/wheel'
import { sliceDegrees, degreesToRadians } from '@/lib/wheelMath'
import { getSliceColor } from '@/lib/colorUtils'

interface Props {
  entries: WheelEntry[]
  currentAngle: number
  theme: ThemePreset
  displayMode: DisplayMode
  winnerIndex: number | null
  backgroundUrl?: string | null
}

const CENTER_CIRCLE_RADIUS = 24
const FONT_SIZE_MAX = 18
const FONT_SIZE_MIN = 10

// ─── image-text mode layout ───────────────────────────────────────────────────
// All values are fractions of the wheel radius unless noted.
// Adjust these after visual testing — they are the only numbers that control
// the image-text layout; nothing else in the renderer is hard-coded for it.
const IT_TEXT_DIST_RATIO    = 0.58  // radial position of text centre (centre → rim)
const IT_THUMB_DIST_RATIO   = 0.76  // radial position of thumbnail centre
const IT_THUMB_WIDTH_FACTOR = 0.65  // how much of the available chord width to use (0–1)
const IT_THUMB_MAX_WIDTH    = 0.16  // hard cap on thumb width (prevents huge thumbs at low entry counts)
const IT_THUMB_ASPECT       = 1.25  // height ÷ width  (> 1 = portrait, like a card)
const IT_THUMB_CORNER       = 0.20  // corner radius as a fraction of thumb width
// ─────────────────────────────────────────────────────────────────────────────

export default function WheelCanvas({
  entries,
  currentAngle,
  theme,
  displayMode,
  winnerIndex,
  backgroundUrl,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const bgImageRef = useRef<HTMLImageElement | null>(null)

  // Load images when entries change
  useEffect(() => {
    const map = imagesRef.current
    entries.forEach(entry => {
      if (entry.imageUrl && !map.has(entry.id)) {
        const img = new Image()
        img.src = entry.imageUrl
        img.onload = () => draw()
        map.set(entry.id, img)
      }
    })
    // Remove stale entries
    const ids = new Set(entries.map(e => e.id))
    Array.from(map.keys()).forEach(key => {
      if (!ids.has(key)) map.delete(key)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  // Load background image
  useEffect(() => {
    if (!backgroundUrl) { bgImageRef.current = null; draw(); return }
    const img = new Image()
    img.src = backgroundUrl
    img.onload = () => { bgImageRef.current = img; draw() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundUrl])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 4

    ctx.clearRect(0, 0, size, size)

    // Background
    if (bgImageRef.current) {
      ctx.save()
      ctx.drawImage(bgImageRef.current, 0, 0, size, size)
      ctx.restore()
    } else {
      // App-chrome backdrop behind the wedges (warm near-black) — NOT a slice color.
      ctx.fillStyle = '#160e09'
      ctx.fillRect(0, 0, size, size)
    }

    if (entries.length === 0) {
      ctx.fillStyle = '#8a755a'
      ctx.font = '16px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Add entries to spin!', cx, cy)
      return
    }

    const degrees = sliceDegrees(entries)
    const angleOffset = degreesToRadians(currentAngle - 90) // start at top

    let startAngle = angleOffset

    degrees.forEach((deg, i) => {
      const endAngle = startAngle + degreesToRadians(deg)
      const entry = entries[i]
      const isWinner = winnerIndex === i
      const color = entry.color ?? getSliceColor(theme, i)

      // Slice fill
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()

      // Winner glow
      if (isWinner) {
        ctx.shadowColor = '#fbbf24'
        ctx.shadowBlur = 24
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 4
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Border
      ctx.strokeStyle = theme.borderColor
      ctx.lineWidth = isWinner ? 0 : 1.5
      ctx.stroke()
      ctx.restore()

      // Content: image and/or text
      const midAngle = startAngle + degreesToRadians(deg / 2)
      drawSliceContent(ctx, entry, i, cx, cy, radius, midAngle, deg, displayMode, theme, imagesRef.current, isWinner)

      startAngle = endAngle
    })

    // Center circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = '#160e09' // warm near-black hub — app chrome, not a slice color
    ctx.fill()
    ctx.strokeStyle = theme.borderColor
    ctx.lineWidth = 2
    ctx.stroke()

    // Center dot
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fillStyle = theme.pointerColor
    ctx.fill()
    ctx.restore()
  }, [entries, currentAngle, theme, displayMode, winnerIndex])

  useEffect(() => {
    draw()
  }, [draw])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ro = new ResizeObserver(() => {
      const size = Math.min(parent.clientWidth, parent.clientHeight)
      canvas.width = size
      canvas.height = size
      draw()
    })
    ro.observe(parent)
    return () => ro.disconnect()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
}

function drawSliceContent(
  ctx: CanvasRenderingContext2D,
  entry: WheelEntry,
  index: number,
  cx: number,
  cy: number,
  radius: number,
  midAngle: number,
  sliceDeg: number,
  displayMode: DisplayMode,
  theme: ThemePreset,
  images: Map<string, HTMLImageElement>,
  isWinner: boolean,
) {
  const img = entry.imageUrl ? images.get(entry.id) : null
  const hasImage = !!img && img.complete && img.naturalWidth > 0
  const hasName = !!entry.name.trim()

  if (displayMode === 'text-only' || !hasImage) {
    if (!hasName) return
    drawText(ctx, entry.name, cx, cy, radius, midAngle, sliceDeg, theme, isWinner)
    return
  }

  if (displayMode === 'image-full' || displayMode === 'image-full-text') {
    if (hasImage) drawFullImage(ctx, img!, cx, cy, radius, midAngle, sliceDeg, index)
    if (displayMode === 'image-full-text' && hasName) {
      drawTextWithShadow(ctx, entry.name, cx, cy, radius, midAngle, sliceDeg, theme, isWinner)
    }
    return
  }

  // image-text: circular thumbnail + text
  if (displayMode === 'image-text') {
    if (hasImage) drawThumbnail(ctx, img!, cx, cy, radius, midAngle, sliceDeg)
    if (hasName) drawText(ctx, entry.name, cx, cy, radius * IT_TEXT_DIST_RATIO, midAngle, sliceDeg, theme, isWinner)
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number, cy: number,
  radius: number,
  midAngle: number,
  sliceDeg: number,
  theme: ThemePreset,
  isWinner: boolean,
) {
  const textRadius = radius * 0.62
  const tx = cx + Math.cos(midAngle) * textRadius
  const ty = cy + Math.sin(midAngle) * textRadius

  const fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, sliceDeg * 0.6))

  ctx.save()
  ctx.translate(tx, ty)
  ctx.rotate(midAngle) // radial: text runs centre → rim
  ctx.font = `${isWinner ? 'bold ' : ''}${fontSize}px ${theme.fontFamily}`
  ctx.fillStyle = theme.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const maxWidth = radius * 0.55
  const label = truncateText(ctx, name, maxWidth)
  ctx.fillText(label, 0, 0)
  ctx.restore()
}

function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number, cy: number,
  radius: number,
  midAngle: number,
  sliceDeg: number,
  theme: ThemePreset,
  isWinner: boolean,
) {
  const textRadius = radius * 0.62
  const tx = cx + Math.cos(midAngle) * textRadius
  const ty = cy + Math.sin(midAngle) * textRadius
  const fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, sliceDeg * 0.6))

  ctx.save()
  ctx.translate(tx, ty)
  ctx.rotate(midAngle) // radial: text runs centre → rim
  ctx.font = `bold ${fontSize}px ${theme.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 4

  const maxWidth = radius * 0.55
  const label = truncateText(ctx, name, maxWidth)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, 0, 0)
  ctx.restore()
}

function drawFullImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number, cy: number,
  radius: number,
  midAngle: number,
  sliceDeg: number,
  index: number,
) {
  ctx.save()
  // Clip to the wedge
  ctx.beginPath()
  const halfDeg = degreesToRadians(sliceDeg / 2)
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, radius - 2, midAngle - halfDeg, midAngle + halfDeg)
  ctx.closePath()
  ctx.clip()

  // Translate to slice centre; +π/2 makes the image's vertical axis align with the
  // radial direction (centre → rim), so the image stands upright inside the wedge.
  const imgRadius = radius * 0.6
  const ix = cx + Math.cos(midAngle) * imgRadius
  const iy = cy + Math.sin(midAngle) * imgRadius
  const imgSize = radius * 0.75
  ctx.translate(ix, iy)
  ctx.rotate(midAngle + Math.PI / 2)
  drawImageCover(ctx, img, -imgSize / 2, -imgSize / 2, imgSize, imgSize)
  ctx.restore()
}

function drawThumbnail(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number, cy: number,
  radius: number,
  midAngle: number,
  sliceDeg: number,
) {
  const halfSliceRad = degreesToRadians(sliceDeg / 2)
  const sliceStart   = midAngle - halfSliceRad
  const sliceEnd     = midAngle + halfSliceRad

  // Radial centre of the thumbnail
  const thumbDist = radius * IT_THUMB_DIST_RATIO

  // Width: fraction of the chord available at thumbDist, capped by hard max
  const chord      = 2 * thumbDist * Math.sin(halfSliceRad)
  const thumbW     = Math.min(chord * IT_THUMB_WIDTH_FACTOR, radius * IT_THUMB_MAX_WIDTH)
  const thumbH     = thumbW * IT_THUMB_ASPECT
  const cornerR    = thumbW * IT_THUMB_CORNER

  // Skip if too small to be visible
  if (thumbW < 4) return

  const tx = cx + Math.cos(midAngle) * thumbDist
  const ty = cy + Math.sin(midAngle) * thumbDist

  ctx.save()

  // Clip 1: wedge boundary (in canvas coords) — thumbnail can never bleed into neighbours
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, radius - 2, sliceStart, sliceEnd)
  ctx.closePath()
  ctx.clip()

  // Move to slice-local coordinate system; +π/2 makes the image stand upright
  // (image's vertical axis = radial direction, top toward rim)
  ctx.translate(tx, ty)
  ctx.rotate(midAngle + Math.PI / 2)

  // Clip 2: rounded rectangle in local coords (-w/2, -h/2, w, h)
  ctx.beginPath()
  roundedRect(ctx, -thumbW / 2, -thumbH / 2, thumbW, thumbH, cornerR)
  ctx.clip()

  drawImageCover(ctx, img, -thumbW / 2, -thumbH / 2, thumbW, thumbH)
  ctx.restore()
}

/**
 * Draws `img` into the destination rect (dx, dy, dw, dh) with object-fit: cover
 * behaviour — the image keeps its original aspect ratio and is centre-cropped
 * to fill the rect, so it is never stretched or squashed. The source crop is
 * computed from the image's natural dimensions; everything outside the rect is
 * already constrained by the caller's wedge / rounded-rect clip.
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number,
  dw: number, dh: number,
) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return

  // Scale so the image fully covers the destination, then sample the centred
  // portion of the source that maps onto it.
  const scale = Math.max(dw / iw, dh / ih)
  const sw = dw / scale
  const sh = dh / scale
  const sx = (iw - sw) / 2
  const sy = (ih - sh) / 2

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

// Draws a rounded rectangle path. Uses the native ctx.roundRect when available
// (Chrome 99+, Firefox 112+, Safari 15.4+) and falls back to arcTo otherwise.
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
) {
  const cr = Math.min(r, w / 2, h / 2) // clamp so corners never exceed half a side
  if (typeof (ctx as { roundRect?: unknown }).roundRect === 'function') {
    ctx.roundRect(x, y, w, h, cr)
    return
  }
  // arcTo fallback
  ctx.moveTo(x + cr, y)
  ctx.lineTo(x + w - cr, y)
  ctx.arcTo(x + w, y,     x + w, y + cr,     cr)
  ctx.lineTo(x + w, y + h - cr)
  ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr)
  ctx.lineTo(x + cr, y + h)
  ctx.arcTo(x,     y + h, x,     y + h - cr, cr)
  ctx.lineTo(x,     y + cr)
  ctx.arcTo(x,     y,     x + cr, y,          cr)
  ctx.closePath()
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = text
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}
