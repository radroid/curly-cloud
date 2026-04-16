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

interface RecentTrack {
  name: string
  artist: string
  album: string
  albumArt: string | null
  spotifyUrl: string | null
  playedAt: string
}

interface SpotifyData {
  isPlaying: boolean
  track: TrackInfo | null
  recent: RecentTrack[]
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

// ── Recently Played List ───────────────────────────────────────────────────────

function RecentList({ items }: { items: RecentTrack[] }) {
  if (items.length === 0) {
    return (
      <div
        style={{
          ...chicago,
          fontSize: 11,
          color: '#555',
          padding: '8px 6px',
          textAlign: 'center',
        }}
      >
        No recent tracks
      </div>
    )
  }

  const displayItems = items.slice(0, 8)

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {displayItems.map((track, i) => {
        const rowStyle: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 10px',
          borderBottom: i < displayItems.length - 1 ? '1px solid #000' : 'none',
          minWidth: 0,
          color: '#000',
          textDecoration: 'none',
          cursor: track.spotifyUrl ? 'pointer' : 'default',
        }

        const thumb = (
          <div
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              overflow: 'hidden',
              background: '#ccc',
              border: '1px solid #000',
            }}
          >
            {track.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.albumArt}
                alt={track.album}
                width={44}
                height={44}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#888' }} />
            )}
          </div>
        )

        const text = (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                ...chicago,
                fontSize: 13,
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              {track.name}
            </div>
            <div
              style={{
                ...chicago,
                fontSize: 11,
                color: '#555',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              {track.artist}
            </div>
          </div>
        )

        const key = `${track.name}-${track.playedAt}-${i}`

        if (track.spotifyUrl) {
          return (
            <a
              key={key}
              href={track.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={rowStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f0f0'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              title={`Open "${track.name}" on Spotify`}
            >
              {thumb}
              {text}
            </a>
          )
        }

        return (
          <div key={key} style={rowStyle}>
            {thumb}
            {text}
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

// ── Main Component ─────────────────────────────────────────────────────────────

export function MusicApp() {
  const [data, setData] = useState<SpotifyData | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Cache-bust via timestamp query param so no layer (browser, SW,
        // Cloudflare edge, OpenNext) can serve a stale Recently Played list.
        const res = await fetch(`/api/spotify/now-playing?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (!res.ok) throw new Error('bad status')
        const json = await res.json()
        if (!cancelled) {
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

    load()
    const interval = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
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
  const { isPlaying, recent } = data
  const track = data.track!

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

        {/* ── Right column: Recent tracks ───────────────────────────────── */}
        <div
          style={{
            flex: '0 0 45%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {/* Header */}
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
            Recently Played
          </div>

          {/* List */}
          <RecentList items={recent ?? []} />
        </div>
      </div>
    </>
  )
}
