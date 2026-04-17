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

function json(body: unknown) {
  return Response.json(body, { headers: NO_CACHE_HEADERS })
}

interface TopData {
  genres: { name: string; count: number }[]
  artists: { name: string; image: string | null; spotifyUrl: string | null }[]
}

function makeTrack(item: any, nowPlaying?: { progressMs: number }) {
  return {
    name: item.name ?? 'Unknown',
    artist: (item.artists ?? []).map((a: any) => a.name).join(', '),
    album: item.album?.name ?? '',
    albumArt: item.album?.images?.[0]?.url ?? null,
    spotifyUrl: item.external_urls?.spotify ?? null,
    ...(nowPlaying && { progressMs: nowPlaying.progressMs, durationMs: item.duration_ms ?? 0 }),
  }
}

async function fetchTopData(accessToken: string): Promise<TopData> {
  try {
    const opts = { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' as const }
    // Two separate calls: short_term for genres (recent listening), long_term for artists (all time)
    const [genreRes, artistRes] = await Promise.all([
      fetch('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=short_term', opts),
      fetch('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=long_term', opts),
    ])

    // Top 10 artists from long_term
    let artists: TopData['artists'] = []
    if (artistRes.ok) {
      const data = await artistRes.json() as any
      artists = (data.items ?? []).slice(0, 10).map((a: any) => ({
        name: a.name ?? 'Unknown',
        image: a.images?.[0]?.url ?? null,
        spotifyUrl: a.external_urls?.spotify ?? null,
      }))
    }

    // Top 10 genres from short_term, deduplicated
    let genres: TopData['genres'] = []
    if (genreRes.ok) {
      const data = await genreRes.json() as any
      const items: any[] = data.items ?? []

      const raw = new Map<string, number>()
      for (const artist of items) {
        for (const genre of artist.genres ?? []) {
          const key = genre.toLowerCase()
          raw.set(key, (raw.get(key) ?? 0) + 1)
        }
      }

      // Merge entries where one is the other + trailing "s"
      const merged = new Map<string, number>()
      const keys = Array.from(raw.keys()).sort((a, b) => (raw.get(b) ?? 0) - (raw.get(a) ?? 0))
      const consumed = new Set<string>()
      for (const key of keys) {
        if (consumed.has(key)) continue
        let count = raw.get(key) ?? 0
        const singular = key.endsWith('s') ? key.slice(0, -1) : null
        const plural = key + 's'
        if (singular && raw.has(singular) && !consumed.has(singular)) {
          count += raw.get(singular) ?? 0
          consumed.add(singular)
        }
        if (raw.has(plural) && !consumed.has(plural)) {
          count += raw.get(plural) ?? 0
          consumed.add(plural)
        }
        consumed.add(key)
        const label = key.charAt(0).toUpperCase() + key.slice(1)
        merged.set(label, count)
      }

      genres = Array.from(merged.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    }

    return { genres, artists }
  } catch {
    return { genres: [], artists: [] }
  }
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
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })

  if (!tokenRes.ok) return json({ error: 'Spotify token refresh failed', isPlaying: false, track: null })

  const { access_token } = await tokenRes.json() as { access_token: string }

  // 2. Fetch currently playing
  const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${access_token}` }, cache: 'no-store',
  })

  // Fetch top genres in parallel with the currently-playing check
  const topPromise = fetchTopData(access_token)

  // 204 = nothing playing, 202 = processing
  if (nowRes.status === 204 || nowRes.status === 202) {
    const recentRes = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
      headers: { Authorization: `Bearer ${access_token}` }, cache: 'no-store',
    })
    let lastTrack: any = null
    if (recentRes.ok) {
      const data = await recentRes.json() as any
      const first = (data.items ?? [])[0]
      if (first?.track) lastTrack = makeTrack(first.track)
    }
    return json({ isPlaying: false, track: lastTrack, ...await topPromise })
  }

  if (!nowRes.ok) {
    const top = await topPromise
    return json({ error: 'Spotify currently-playing failed', isPlaying: false, track: null, ...top })
  }

  const nowData = await nowRes.json() as any
  const item = nowData?.item
  if (!item) {
    const top2 = await topPromise
    return json({ isPlaying: false, track: null, ...top2 })
  }

  return json({
    isPlaying: nowData.is_playing === true,
    track: makeTrack(item, { progressMs: nowData.progress_ms ?? 0 }),
    ...await topPromise,
  })
}
