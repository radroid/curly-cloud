export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    return Response.json(
      { error: 'Spotify env vars not configured', isPlaying: false, track: null },
      { status: 200 },
    )
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
    return Response.json(
      { error: 'Spotify token refresh failed', isPlaying: false, track: null },
      { status: 200 },
    )
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
      return Response.json({ isPlaying: false, track: null, recent: [] }, { status: 200 })
    }
    const data = await recentRes.json() as any
    const items = (data.items ?? []).map((item: any) => ({
      name: item.track?.name ?? 'Unknown',
      artist: (item.track?.artists ?? []).map((a: any) => a.name).join(', '),
      album: item.track?.album?.name ?? '',
      albumArt: item.track?.album?.images?.[0]?.url ?? null,
      playedAt: item.played_at,
    }))
    return Response.json({
      isPlaying: false,
      track: items[0] ?? null,
      recent: items,
    }, { status: 200 })
  }

  if (!nowRes.ok) {
    return Response.json(
      { error: 'Spotify currently-playing failed', isPlaying: false, track: null },
      { status: 200 },
    )
  }

  const nowData = await nowRes.json() as any
  const item = nowData?.item
  if (!item) {
    return Response.json({ isPlaying: false, track: null, recent: [] }, { status: 200 })
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
      playedAt: r.played_at,
    }))
  }

  return Response.json({
    isPlaying: nowData.is_playing === true,
    track: {
      name: item.name ?? 'Unknown',
      artist: (item.artists ?? []).map((a: any) => a.name).join(', '),
      album: item.album?.name ?? '',
      albumArt: item.album?.images?.[0]?.url ?? null,
      progressMs: nowData.progress_ms ?? 0,
      durationMs: item.duration_ms ?? 0,
    },
    recent,
  }, { status: 200 })
}
