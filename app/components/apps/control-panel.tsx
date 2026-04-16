'use client'

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BatteryManager extends EventTarget {
  charging: boolean
  chargingTime: number
  dischargingTime: number
  level: number
  addEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void
  removeEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void
}

interface NavWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>
  connection?: { effectiveType?: string }
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const chicago: React.CSSProperties = {
  fontFamily: 'var(--font-chicago)',
  WebkitFontSmoothing: 'none',
  MozOsxFontSmoothing: 'grayscale',
}

const sectionStyle: React.CSSProperties = {
  borderBottom: '1px solid #000',
  padding: '6px 8px',
}

const tileStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '6px 8px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 72,
}

const tileLabelStyle: React.CSSProperties = {
  ...chicago,
  fontSize: 9,
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 4,
  color: '#000',
}

const tileValueStyle: React.CSSProperties = {
  ...chicago,
  fontSize: 13,
  color: '#000',
  textAlign: 'center',
  lineHeight: 1.3,
}

const tileSubValueStyle: React.CSSProperties = {
  ...chicago,
  fontSize: 10,
  color: '#000',
  textAlign: 'center',
  marginTop: 2,
}

// ── Browser detection ─────────────────────────────────────────────────────────

function detectBrowser(ua: string): string {
  if (/Edg\/(\d+)/.test(ua)) return `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ''}`
  if (/Chrome\/(\d+)/.test(ua) && !/Chromium/.test(ua)) return `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ''}`
  if (/Firefox\/(\d+)/.test(ua)) return `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ''}`
  if (/Safari\/(\d+)/.test(ua) && /Version\/(\d+)/.test(ua)) return `Safari ${ua.match(/Version\/(\d+)/)?.[1] ?? ''}`
  if (/OPR\/(\d+)/.test(ua)) return `Opera ${ua.match(/OPR\/(\d+)/)?.[1] ?? ''}`
  if (/Chromium\/(\d+)/.test(ua)) return `Chromium ${ua.match(/Chromium\/(\d+)/)?.[1] ?? ''}`
  return 'Unknown'
}

// ── Dashboard Tiles ──────────────────────────────────────────────────────────

function ClockTile({ now }: { now: Date | null }) {
  if (!now) return <div style={tileStyle}><span style={tileLabelStyle}>TIME</span><span style={tileValueStyle}>--:--</span></div>

  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const date = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div style={tileStyle}>
      <span style={tileLabelStyle}>TIME</span>
      <span style={{ ...tileValueStyle, fontSize: 16 }}>{time}</span>
      <span style={tileSubValueStyle}>{date}</span>
    </div>
  )
}

function BatteryTile() {
  const [batteryState, setBatteryState] = useState<{
    level: number
    charging: boolean
    chargingTime: number
    dischargingTime: number
  } | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const nav = navigator as NavWithBattery
    if (!nav.getBattery) {
      setUnavailable(true)
      return
    }

    let battery: BatteryManager | null = null

    const update = () => {
      if (!battery) return
      setBatteryState({
        level: battery.level,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      })
    }

    nav.getBattery().then((b) => {
      battery = b
      update()
      b.addEventListener('levelchange', update)
      b.addEventListener('chargingchange', update)
    }).catch(() => {
      setUnavailable(true)
    })

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', update)
        battery.removeEventListener('chargingchange', update)
      }
    }
  }, [])

  const pct = batteryState ? Math.round(batteryState.level * 100) : 0
  const label = unavailable
    ? 'N/A'
    : !batteryState
      ? '...'
      : `${pct}%${batteryState.charging ? ' \u25B2' : ''}`

  return (
    <div style={tileStyle}>
      <span style={tileLabelStyle}>BATTERY</span>
      {/* Battery bar */}
      <div
        style={{
          width: 48,
          height: 18,
          border: '1px solid #000',
          position: 'relative',
          marginBottom: 4,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {/* Nub on right side */}
        <div
          style={{
            position: 'absolute',
            right: -4,
            top: 4,
            width: 3,
            height: 8,
            background: '#000',
          }}
        />
        {/* Fill */}
        {!unavailable && batteryState && (
          <div
            style={{
              width: `${pct}%`,
              background: '#000',
              height: '100%',
            }}
          />
        )}
      </div>
      <span style={tileSubValueStyle}>{label}</span>
    </div>
  )
}

function DisplayTile() {
  const [resolution, setResolution] = useState<string | null>(null)

  useEffect(() => {
    setResolution(`${window.screen.width} \u00D7 ${window.screen.height}`)
  }, [])

  return (
    <div style={tileStyle}>
      <span style={tileLabelStyle}>DISPLAY</span>
      <span style={tileValueStyle}>{resolution ?? '...'}</span>
    </div>
  )
}

function BrowserTile() {
  const [browser, setBrowser] = useState<string | null>(null)

  useEffect(() => {
    setBrowser(detectBrowser(navigator.userAgent))
  }, [])

  return (
    <div style={tileStyle}>
      <span style={tileLabelStyle}>BROWSER</span>
      <span style={tileValueStyle}>{browser ?? '...'}</span>
    </div>
  )
}

function NetworkTile() {
  const [connection, setConnection] = useState<string | null>(null)

  useEffect(() => {
    const nav = navigator as NavWithBattery
    const effectiveType = nav.connection?.effectiveType
    if (effectiveType) {
      const label = effectiveType === '4g' ? '4G'
        : effectiveType === '3g' ? '3G'
        : effectiveType === '2g' ? '2G'
        : effectiveType === 'slow-2g' ? 'Slow 2G'
        : effectiveType === 'wifi' ? 'WiFi'
        : effectiveType.toUpperCase()
      setConnection(label)
    } else {
      setConnection(navigator.onLine ? 'Online' : 'Offline')
    }
  }, [])

  return (
    <div style={tileStyle}>
      <span style={tileLabelStyle}>NETWORK</span>
      <span style={tileValueStyle}>{connection ?? '...'}</span>
    </div>
  )
}

function LocationTile() {
  const [location, setLocation] = useState<string | null>(null)

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const parts = tz.split('/')
    // Use the city part (last segment), replacing underscores with spaces
    const city = parts.length >= 2
      ? parts[parts.length - 1].replace(/_/g, ' ')
      : tz
    setLocation(city)
  }, [])

  return (
    <div style={tileStyle}>
      <span style={tileLabelStyle}>LOCATION</span>
      <span style={tileValueStyle}>{location ?? '...'}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ControlPanelApp() {
  // ── Date & Time ────────────────────────────────────────────────────────────
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#fff',
      }}
    >
      {/* ── Section 1: User ──────────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Avatar */}
        <img
          src="/raj-avatar.webp"
          alt="Raj Dholakia"
          width={84}
          height={84}
          style={{
            width: 84,
            height: 84,
            border: '2px solid #000',
            borderRadius: 2,
            imageRendering: 'pixelated',
            flexShrink: 0,
            display: 'block',
          }}
        />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...chicago,
              fontSize: 14,
              fontWeight: 'bold',
              marginBottom: 2,
            }}
          >
            Raj Dholakia
          </div>
          <div style={{ ...chicago, fontSize: 12, marginBottom: 2 }}>
            Full-Stack Engineer &amp; Founder
          </div>
          <div style={{ ...chicago, fontSize: 12, color: '#555', marginBottom: 6 }}>
            Toronto, CA
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a
              href="https://cal.com/createclub/problem-ranter"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...chicago,
                fontSize: 11,
                color: '#000',
                textDecoration: 'none',
                border: '1px solid #000',
                padding: '1px 4px',
              }}
            >
              Cal
            </a>
            <a
              href="https://github.com/radroid"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...chicago,
                fontSize: 11,
                color: '#000',
                textDecoration: 'none',
                border: '1px solid #000',
                padding: '1px 4px',
              }}
            >
              GitHub
            </a>
            <a
              href="mailto:raj9dholakia@gmail.com"
              style={{
                ...chicago,
                fontSize: 11,
                color: '#000',
                textDecoration: 'none',
                border: '1px solid #000',
                padding: '1px 4px',
              }}
            >
              Email
            </a>
            <a
              href="https://maps.app.goo.gl/eWDPAqVgfkHyWv4T9"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...chicago,
                fontSize: 11,
                color: '#000',
                textDecoration: 'none',
                border: '1px solid #000',
                padding: '1px 4px',
              }}
            >
              Maps
            </a>
          </div>
        </div>
      </div>

      {/* ── Section 2: Dashboard Tiles ──────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
          padding: 8,
          overflowY: 'auto',
        }}
      >
        <ClockTile now={now} />
        <BatteryTile />
        <DisplayTile />
        <BrowserTile />
        <NetworkTile />
        <LocationTile />
      </div>
    </div>
  )
}
