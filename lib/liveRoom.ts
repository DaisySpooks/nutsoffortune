import { v4 as uuid } from 'uuid'
import { supabase } from './supabase'
import { WheelConfig, WheelMode } from '@/types/wheel'

// Unambiguous chars — no I/O/1/0 to avoid misreads when sharing verbally
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return code
}

export interface WheelSnapshot {
  config: WheelConfig
  wheelMode: WheelMode
  autoRemoveWinner: boolean
}

export interface SpinEvent {
  type: 'spin'
  startAngle: number
  targetAngle: number
  duration: number   // ms
  winnerId: string
  winnerName: string
  timestamp: number
}

export interface IntroEvent {
  type: 'intro'
  playing: boolean
  timestamp: number
  startedAt?: number
}

const HOST_TOKEN_KEY = (roomCode: string) => `live_host_token_${roomCode}`
const ACTIVE_ROOM_KEY = 'live_active_room_code'

export function getStoredHostToken(roomCode: string): string | null {
  return localStorage.getItem(HOST_TOKEN_KEY(roomCode))
}

export function getActiveRoomCode(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_ROOM_KEY)
}

export async function createLiveRoom(snapshot: WheelSnapshot): Promise<{ roomCode: string }> {
  const roomCode = generateRoomCode()
  const hostToken = uuid()

  const safeSnapshot = safeEntries(snapshot)

  const withImages = safeSnapshot.config.entries.filter(e => e.imageUrl)
  console.log('[liveRoom] createLiveRoom: entries:', safeSnapshot.config.entries.length, '| with public imageUrl:', withImages.length)

  const { error } = await supabase.rpc('create_live_room', {
    p_id: uuid(),
    p_room_code: roomCode,
    p_host_token: hostToken,
    p_wheel_state: safeSnapshot,
  })

  if (error) throw new Error(error.message)

  // Best-effort cleanup of rooms older than 24 hours — does not block creation.
  void supabase.rpc('cleanup_expired_live_rooms')

  localStorage.setItem(HOST_TOKEN_KEY(roomCode), hostToken)
  localStorage.setItem(ACTIVE_ROOM_KEY, roomCode)
  console.log('[liveRoom] Room created, active room set to:', roomCode)
  return { roomCode }
}

function safeEntries(snapshot: WheelSnapshot): WheelSnapshot {
  return {
    ...snapshot,
    config: {
      ...snapshot.config,
      entries: snapshot.config.entries.map(e => ({
        ...e,
        imageUrl: e.imageUrl?.startsWith('blob:') ? null : (e.imageUrl ?? null),
      })),
    },
  }
}

// Push an updated wheel state to all viewers (e.g. after a winner is removed).
// Token validation happens server-side inside the security definer function.
export async function broadcastWheelState(snapshot: WheelSnapshot): Promise<void> {
  const roomCode = getActiveRoomCode()
  if (!roomCode) return
  const hostToken = getStoredHostToken(roomCode)
  if (!hostToken) return

  const { error } = await supabase.rpc('broadcast_wheel_state', {
    p_room_code: roomCode,
    p_host_token: hostToken,
    p_wheel_state: safeEntries(snapshot),
  })
  if (error) {
    console.error('[liveRoom] broadcastWheelState: RPC error', error)
  }
}

// Notify viewers that the host started or stopped intro music.
// Reuses the broadcast_spin_event RPC — it writes arbitrary JSON to current_event.
// Viewers guard on event.type so spin and intro events don't interfere.
export async function broadcastIntroEvent(playing: boolean): Promise<void> {
  const roomCode = getActiveRoomCode()
  if (!roomCode) return

  const hostToken = getStoredHostToken(roomCode)
  if (!hostToken) return

  const now = Date.now()

  const event: IntroEvent = {
    type: 'intro',
    playing,
    timestamp: now,
    startedAt: playing ? now : undefined,
  }

  const { error } = await supabase.rpc('broadcast_spin_event', {
    p_room_code: roomCode,
    p_host_token: hostToken,
    p_event: event,
  })

  if (error) console.error('[liveRoom] broadcastIntroEvent: RPC error', error)
}

// Fire-and-forget: write a spin event to current_event so viewers can replay it.
// Token validation happens server-side inside the security definer function.
export async function broadcastSpinEvent(event: SpinEvent): Promise<void> {
  const roomCode = getActiveRoomCode()
  if (!roomCode) {
    console.log('[liveRoom] broadcastSpinEvent: no active room in localStorage, skipping')
    return
  }
  const hostToken = getStoredHostToken(roomCode)
  if (!hostToken) {
    console.log('[liveRoom] broadcastSpinEvent: no host token for room', roomCode, '— skipping')
    return
  }

  console.log('[liveRoom] broadcastSpinEvent: sending to room', roomCode)
  const { error } = await supabase.rpc('broadcast_spin_event', {
    p_room_code: roomCode,
    p_host_token: hostToken,
    p_event: event,
  })
  if (error) {
    console.error('[liveRoom] broadcastSpinEvent: RPC error for room', roomCode, error)
  }
}
