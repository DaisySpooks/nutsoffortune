import { WheelEntry } from '@/types/wheel'

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Total weight of all entries */
export function totalWeight(entries: WheelEntry[]): number {
  return entries.reduce((sum, e) => sum + e.weight, 0)
}

/** Angle (in degrees) that each entry occupies */
export function sliceDegrees(entries: WheelEntry[]): number[] {
  const total = totalWeight(entries)
  return entries.map(e => (e.weight / total) * 360)
}

/** Detect which entry the pointer (top, 270° from 0) lands on given currentAngle */
export function detectWinner(currentAngle: number, entries: WheelEntry[]): WheelEntry {
  if (entries.length === 0) return entries[0]
  const degrees = sliceDegrees(entries)
  // Normalize angle so pointer at top (270°) is 0
  const normalized = ((currentAngle % 360) + 360) % 360
  // Pointer is at top = 270 degrees from canvas 0 (right)
  // Wheel draws slices starting at -90 (top), so we just use normalized directly
  const pointerAngle = (360 - normalized) % 360

  let cumulative = 0
  for (let i = 0; i < entries.length; i++) {
    cumulative += degrees[i]
    if (pointerAngle < cumulative) return entries[i]
  }
  return entries[entries.length - 1]
}

/** Starting angle of a given entry index (in degrees from top) */
export function entryStartAngle(index: number, entries: WheelEntry[]): number {
  const degrees = sliceDegrees(entries)
  return degrees.slice(0, index).reduce((sum, d) => sum + d, 0)
}

/**
 * Calculate the final wheel angle needed to land on a specific entry.
 * Adds enough full rotations to feel satisfying.
 */
export function targetAngleForEntry(
  currentAngle: number,
  entryIndex: number,
  entries: WheelEntry[],
  minSpins = 5
): number {
  const degrees = sliceDegrees(entries)
  const startDeg = entryStartAngle(entryIndex, entries)
  const midDeg = startDeg + degrees[entryIndex] / 2

  // We want pointer (at top) to point to midpoint of the slice.
  // Canvas starts drawing at -90° (top). Rotation is clockwise.
  // Final angle mod 360 should equal (360 - midDeg) % 360
  const targetMod = (360 - midDeg + 360) % 360
  const currentMod = ((currentAngle % 360) + 360) % 360

  let delta = targetMod - currentMod
  if (delta <= 0) delta += 360
  delta += minSpins * 360

  return currentAngle + delta
}

/** Random target angle (random winner) */
export function randomTargetAngle(currentAngle: number, minSpins = 5): number {
  const extraRotation = minSpins * 360 + Math.random() * 360
  return currentAngle + extraRotation
}
