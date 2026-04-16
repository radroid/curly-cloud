export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// Response headers that prevent both browser and Cloudflare edge from
// caching the response. Without these, the Recently Played list can get
// stuck on a stale copy from the first request even though the client
// polls every 10s.
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
} as const

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_CACHE_HEADERS })
}

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    return json({ error: 'Spotify env vars not configured', isPlaying: false, track: null })
  }

  // 1. Exchange refresh token for access token
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!tokenRes.ok) {
    return json({ error: 'Spotify token refresh failed', isPlaying: false, track: null })
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

  // 2. Fetch currently playing
  const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: 'no-store',
  })

  // 204 = nothing playing, 202 = processing
  if (nowRes.status === 204 || nowRes.status === 202) {
    // Fall back to most recent track
    const recentRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: 'no-store',
    })
    if (!recentRes.ok) {
      return json({ isPlaying: false, track: null, recent: [] })
    }
    const data = await recentRes.json() as any
    const items = (data.items ?? []).map((item: any) => ({
      name: item.track?.name ?? 'Unknown',
      artist: (item.track?.artists ?? []).map((a: any) => a.name).join(', '),
      album: item.track?.album?.name ?? '',
      albumArt: item.track?.album?.images?.[0]?.url ?? null,
      spotifyUrl: item.track?.external_urls?.spotify ?? null,
      playedAt: item.played_at,
    }))
    return json({
      isPlaying: false,
      track: items[0] ?? null,
      recent: items,
    })
  }

  if (!nowRes.ok) {
    return json({ error: 'Spotify currently-playing failed', isPlaying: false, track: null })
  }

  const nowData = await nowRes.json() as any
  const item = nowData?.item
  if (!item) {
    return json({ isPlaying: false, track: null, recent: [] })
  }

  // 3. Also grab recent tracks for the playlist column
  const recentRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: 'no-store',
  })
  let recent: any[] = []
  if (recentRes.ok) {
    const recentData = await recentRes.json() as any
    recent = (recentData.items ?? []).map((r: any) => ({
      name: r.track?.name ?? 'Unknown',
      artist: (r.track?.artists ?? []).map((a: any) => a.name).join(', '),
      album: r.track?.album?.name ?? '',
      albumArt: r.track?.album?.images?.[0]?.url ?? null,
      spotifyUrl: r.track?.external_urls?.spotify ?? null,
      playedAt: r.played_at,
    }))
  }

  return json({
    isPlaying: nowData.is_playing === true,
    track: {
      name: item.name ?? 'Unknown',
      artist: (item.artists ?? []).map((a: any) => a.name).join(', '),
      album: item.album?.name ?? '',
      albumArt: item.album?.images?.[0]?.url ?? null,
      spotifyUrl: item.external_urls?.spotify ?? null,
      progressMs: nowData.progress_ms ?? 0,
      durationMs: item.duration_ms ?? 0,
    },
    recent,
  })
}
