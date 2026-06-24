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

  // Strip runtime imageUrls — they are session-only object URLs, not serialisable
  const safeSnapshot: WheelSnapshot = {
    ...snapshot,
    config: {
      ...snapshot.config,
      entries: snapshot.config.entries.map(e => ({ ...e, imageUrl: null })),
    },
  }

  const { error } = await supabase.rpc('create_live_room', {
    p_id: uuid(),
    p_room_code: roomCode,
    p_host_token: hostToken,
    p_wheel_state: safeSnapshot,
  })

  if (error) throw new Error(error.message)

  localStorage.setItem(HOST_TOKEN_KEY(roomCode), hostToken)
  localStorage.setItem(ACTIVE_ROOM_KEY, roomCode)
  console.log('[liveRoom] Room created, active room set to:', roomCode)
  return { roomCode }
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
