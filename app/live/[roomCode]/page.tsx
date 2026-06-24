import LiveRoomView from './LiveRoomView'

// Static export requires generateStaticParams for dynamic routes.
// Room codes are created at runtime, so we generate one shell page ('index')
// and rely on a Cloudflare Pages _redirects rewrite to serve it for any /live/* path.
export function generateStaticParams() {
  return [{ roomCode: 'index' }]
}

export default function LiveRoomPage() {
  return <LiveRoomView />
}
