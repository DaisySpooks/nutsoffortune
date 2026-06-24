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

const HOST_TOKEN_KEY = (roomCode: string) => `live_host_token_${roomCode}`

export function getStoredHostToken(roomCode: string): string | null {
  return localStorage.getItem(HOST_TOKEN_KEY(roomCode))
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

  const { error } = await supabase.from('live_draw_rooms').insert({
    id: uuid(),
    room_code: roomCode,
    host_token: hostToken,
    wheel_state: safeSnapshot,
  })

  if (error) throw new Error(error.message)

  localStorage.setItem(HOST_TOKEN_KEY(roomCode), hostToken)
  return { roomCode }
}
