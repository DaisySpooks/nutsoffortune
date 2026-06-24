import { Suspense } from 'react'
import LiveRoomView from './LiveRoomView'

export default function LivePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0e0905]">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)] animate-pulse">
          Loading room…
        </p>
      </div>
    }>
      <LiveRoomView />
    </Suspense>
  )
}
