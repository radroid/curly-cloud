'use client'

import { useState, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrackInfo {
  name: string
  artist: string
  album: string
  albumArt: string | null
  spotifyUrl: string | null
  progressMs?: number
  durationMs?: number
}

interface Genre {
  name: string
  count: number
}

interface TopArtist {
  name: string
  image: string | null
  spotifyUrl: string | null
}

interface SpotifyData {
  isPlaying: boolean
  track: TrackInfo | null
  genres: Genre[]
  artists: TopArtist[]
  error?: string
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const chicago: React.CSSProperties = {
  fontFamily: 'var(--font-chicago)',
  WebkitFontSmoothing: 'none',
  MozOsxFontSmoothing: 'grayscale',
}

// ── Vinyl Record ───────────────────────────────────────────────────────────────

function VinylRecord({
  albumArt,
  isPlaying,
  isOffline,
}: {
  albumArt: string | null
  isPlaying: boolean
  isOffline: boolean
}) {
  // Check for reduced motion preference
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const handler = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const shouldSpin = isPlaying && !isOffline && !reduceMotion

  const outerSize = 210
  const labelSize = 96 // ~46% of outer
  const holeSize = 14

  return (
    <div
      style={{
        position: 'relative',
        width: outerSize,
        height: outerSize,
        borderRadius: '50%',
        background: isOffline ? '#e8e8e8' : '#1a1a1a',
        // Groove rings via box-shadow
        boxShadow: isOffline
          ? '0 0 0 3px #bbb inset, 0 0 0 6px #e8e8e8 inset, 0 0 0 9px #bbb inset'
          : [
              '0 0 0 11px #222 inset',
              '0 0 0 22px #1a1a1a inset',
              '0 0 0 33px #242424 inset',
              '0 0 0 44px #1a1a1a inset',
              '0 0 0 55px #222 inset',
              '0 0 0 66px #1a1a1a inset',
              '0 0 0 77px #242424 inset',
            ].join(', '),
        flexShrink: 0,
        animation: shouldSpin ? 'curly-vinyl-spin 8s linear infinite' : 'none',
        animationPlayState: shouldSpin ? 'running' : 'paused',
      }}
      className="curly-vinyl"
    >
      {/* Album art label */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: labelSize,
          height: labelSize,
          borderRadius: '50%',
          overflow: 'hidden',
          background: albumArt ? 'transparent' : '#888',
          border: isOffline ? '1px solid #aaa' : '1px solid #333',
        }}
      >
        {albumArt && !isOffline ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={albumArt}
            alt="Album art"
            width={labelSize}
            height={labelSize}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : isOffline ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ddd',
            }}
          >
            <span style={{ ...chicago, fontSize: 9, color: '#555', textAlign: 'center', lineHeight: 1.2 }}>
              OFF
              <br />
              LINE
            </span>
          </div>
        ) : null}
      </div>

      {/* Center hole */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: holeSize,
          height: holeSize,
          borderRadius: '50%',
          background: '#fff',
          border: isOffline ? '1px solid #aaa' : '1px solid #000',
          zIndex: 1,
        }}
      />
    </div>
  )
}

// ── Top Genres List ────────────────────────────────────────────────────────────

function GenreList({ genres }: { genres: Genre[] }) {
  if (genres.length === 0) {
    return (
      <div
        style={{
          ...chicago,
          fontSize: 12,
          color: '#555',
          padding: '12px 10px',
          textAlign: 'center',
        }}
      >
        No genre data
      </div>
    )
  }

  const maxCount = genres[0]?.count ?? 1

  return (
    <div style={{ padding: '4px 0' }}>
      {genres.map((genre, i) => {
        const barPct = Math.max(8, (genre.count / maxCount) * 100)

        return (
          <div
            key={genre.name}
            style={{
              padding: '6px 10px',
              borderBottom: i < genres.length - 1 ? '1px solid #e0e0e0' : 'none',
            }}
          >
            <div
              style={{
                ...chicago,
                fontSize: 12,
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
                marginBottom: 3,
              }}
            >
              {genre.name}
            </div>
            <div
              style={{
                width: '100%',
                height: 6,
                background: '#e8e8e8',
                borderRadius: 1,
              }}
            >
              <div
                style={{
                  width: `${barPct}%`,
                  height: '100%',
                  background: '#000',
                  borderRadius: 1,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Top Artists List ──────────────────────────────────────────────────────────

function ArtistList({ artists }: { artists: TopArtist[] }) {
  if (artists.length === 0) return null

  return (
    <div style={{ padding: '4px 0' }}>
      {artists.map((artist, i) => {
        const row = (
          <>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                flexShrink: 0,
                overflow: 'hidden',
                background: '#ccc',
                border: '1px solid #000',
              }}
            >
              {artist.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.image}
                  alt=""
                  width={28}
                  height={28}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </div>
            <span
              style={{
                ...chicago,
                fontSize: 11,
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
            >
              {artist.name}
            </span>
          </>
        )

        const style: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderBottom: i < artists.length - 1 ? '1px solid #e0e0e0' : 'none',
          textDecoration: 'none',
          color: '#000',
        }

        if (artist.spotifyUrl) {
          return (
            <a
              key={artist.name}
              href={artist.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={style}
              title={`Open ${artist.name} on Spotify`}
            >
              {row}
            </a>
          )
        }

        return (
          <div key={artist.name} style={style}>
            {row}
          </div>
        )
      })}
    </div>
  )
}

// ── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ progressMs, durationMs }: { progressMs: number; durationMs: number }) {
  const pct = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ width: '100%', marginTop: 8 }}>
      {/* Track */}
      <div
        style={{
          width: '100%',
          height: 2,
          background: '#ccc',
          position: 'relative',
          border: '1px solid #000',
          boxSizing: 'border-box',
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${pct}%`,
            background: '#000',
          }}
        />
      </div>
      {/* Times */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 2,
        }}
      >
        <span style={{ ...chicago, fontSize: 9, color: '#555' }}>{formatTime(progressMs)}</span>
        <span style={{ ...chicago, fontSize: 9, color: '#555' }}>{formatTime(durationMs)}</span>
      </div>
    </div>
  )
}

// ── Spotify prefetch cache ─────────────────────────────────────────────────────
// Module-level cache so the data is available instantly when the Music app opens.
// `prefetchSpotify()` is called by the desktop on mount; the Music component
// reads from the cache on first render and starts its own 10s polling loop.

let _cachedData: SpotifyData | null = null
let _cacheTime = 0
let _prefetchPromise: Promise<void> | null = null

async function fetchSpotify(): Promise<SpotifyData> {
  const res = await fetch(`/api/spotify/now-playing?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  if (!res.ok) throw new Error('bad status')
  return res.json()
}

export function prefetchSpotify() {
  if (_prefetchPromise) return _prefetchPromise
  _prefetchPromise = fetchSpotify()
    .then((json) => {
      _cachedData = json
      _cacheTime = Date.now()
    })
    .catch(() => {
      // silently fail — Music app will retry on open
    })
    .finally(() => {
      _prefetchPromise = null
    })
  return _prefetchPromise
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function MusicApp() {
  // Use cached data if fresh (< 15s old), otherwise start in loading state
  const hasFreshCache = _cachedData && (Date.now() - _cacheTime < 15_000)
  const [data, setData] = useState<SpotifyData | null>(hasFreshCache ? _cachedData : null)
  const [isLoading, setLoading] = useState(!hasFreshCache)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const json = await fetchSpotify()
        if (!cancelled) {
          _cachedData = json
          _cacheTime = Date.now()
          setData(json)
          setError(false)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    // If we already have fresh cache, skip the initial fetch and just start polling
    if (hasFreshCache) {
      const interval = setInterval(load, 10_000)
      return () => { cancelled = true; clearInterval(interval) }
    }

    // No cache — fetch immediately then poll
    load()
    const interval = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <style>{`
          @keyframes curly-vinyl-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .curly-vinyl {
            animation-name: curly-vinyl-spin;
          }
          @media (prefers-reduced-motion: reduce) {
            .curly-vinyl { animation: none !important; }
          }
        `}</style>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...chicago,
            fontSize: 12,
            color: '#555',
          }}
        >
          Loading...
        </div>
      </>
    )
  }

  // ── Error / offline state ──────────────────────────────────────────────────
  const isOffline = error || !data || !!data.error || !data.track

  if (isOffline) {
    return (
      <>
        <style>{`
          @keyframes curly-vinyl-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .curly-vinyl {
            animation-name: curly-vinyl-spin;
          }
          @media (prefers-reduced-motion: reduce) {
            .curly-vinyl { animation: none !important; }
          }
        `}</style>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 16,
            background: '#fff',
          }}
        >
          <div style={{ ...chicago, fontSize: 10, letterSpacing: 1, color: '#555' }}>
            OFFLINE
          </div>
          <VinylRecord albumArt={null} isPlaying={false} isOffline={true} />
          <div style={{ ...chicago, fontSize: 11, color: '#555', textAlign: 'center' }}>
            Not connected to Spotify
          </div>
        </div>
      </>
    )
  }

  // ── Normal state: have track data ──────────────────────────────────────────
  // `isOffline` above already guarantees `data.track` is non-null, but the
  // destructure doesn't narrow `track` for TS — assert via non-null.
  const { isPlaying, artists } = data
  const track = data.track!

  // Sort genres descending by count so the bar chart renders largest-first
  // and GenreList's maxCount (genres[0].count) is always the true maximum.
  const sortedGenres = [...(data.genres ?? [])].sort((a, b) => b.count - a.count)

  return (
    <>
      <style>{`
        @keyframes curly-vinyl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .curly-vinyl {
          animation-name: curly-vinyl-spin;
        }
        @media (prefers-reduced-motion: reduce) {
          .curly-vinyl { animation: none !important; }
        }
      `}</style>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          background: '#fff',
          minHeight: 0,
        }}
      >
        {/* ── Left column: Vinyl ────────────────────────────────────────── */}
        <div
          style={{
            flex: '0 0 55%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '18px 14px',
            borderRight: '1px solid #000',
            overflow: 'hidden',
          }}
        >
          {/* Status label */}
          <div
            style={{
              ...chicago,
              fontSize: 11,
              letterSpacing: 1.8,
              color: '#555',
              textTransform: 'uppercase',
            }}
          >
            {isPlaying ? 'Now Playing' : 'Last Played'}
          </div>

          {/* Vinyl (linked to Spotify if we have a URL) */}
          {track.spotifyUrl ? (
            <a
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              title={`Open "${track.name}" on Spotify`}
            >
              <VinylRecord
                albumArt={track.albumArt}
                isPlaying={isPlaying}
                isOffline={false}
              />
            </a>
          ) : (
            <VinylRecord
              albumArt={track.albumArt}
              isPlaying={isPlaying}
              isOffline={false}
            />
          )}

          {/* Track info */}
          <div style={{ width: '100%', textAlign: 'center', minWidth: 0, padding: '0 6px' }}>
            <div
              style={{
                ...chicago,
                fontSize: 15,
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
              title={track.name}
            >
              {track.name}
            </div>
            <div
              style={{
                ...chicago,
                fontSize: 13,
                color: '#555',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
              title={track.artist}
            >
              {track.artist}
            </div>
          </div>

          {/* Progress bar — only shown when actively playing */}
          {isPlaying && track.progressMs !== undefined && track.durationMs !== undefined && (
            <div style={{ width: '100%', padding: '0 4px' }}>
              <ProgressBar
                progressMs={track.progressMs}
                durationMs={track.durationMs}
              />
            </div>
          )}
        </div>

        {/* ── Right column: Genres + Artists ────────────────────────────── */}
        <div
          style={{
            flex: '0 0 45%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            minWidth: 0,
          }}
        >
          {/* Top Genres */}
          <div
            style={{
              ...chicago,
              fontSize: 12,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              padding: '8px 10px 7px',
              borderBottom: '1px solid #000',
              flexShrink: 0,
            }}
          >
            Top Genres
          </div>
          <GenreList genres={sortedGenres} />

          {/* Top Artists */}
          <div
            style={{
              ...chicago,
              fontSize: 12,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              padding: '8px 10px 7px',
              borderTop: '1px solid #000',
              borderBottom: '1px solid #000',
              flexShrink: 0,
            }}
          >
            Top Artists
          </div>
          <ArtistList artists={artists ?? []} />
        </div>
      </div>
    </>
  )
}
