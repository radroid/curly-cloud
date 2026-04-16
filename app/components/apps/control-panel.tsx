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

const sectionHeaderStyle: React.CSSProperties = {
  ...chicago,
  fontSize: 11,
  fontWeight: 'bold',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 1,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 4,
  minHeight: 16,
}

const labelStyle: React.CSSProperties = {
  ...chicago,
  fontSize: 11,
  color: '#000',
  flexShrink: 0,
}

const valueStyle: React.CSSProperties = {
  ...chicago,
  fontSize: 11,
  color: '#000',
  textAlign: 'right',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '60%',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <div style={sectionHeaderStyle}>{label}</div>
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  )
}

// ── Browser & OS detection ────────────────────────────────────────────────────

function detectBrowser(ua: string): string {
  if (/Edg\/(\d+)/.test(ua)) return `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ''}`
  if (/Chrome\/(\d+)/.test(ua) && !/Chromium/.test(ua)) return `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ''}`
  if (/Firefox\/(\d+)/.test(ua)) return `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ''}`
  if (/Safari\/(\d+)/.test(ua) && /Version\/(\d+)/.test(ua)) return `Safari ${ua.match(/Version\/(\d+)/)?.[1] ?? ''}`
  if (/OPR\/(\d+)/.test(ua)) return `Opera ${ua.match(/OPR\/(\d+)/)?.[1] ?? ''}`
  if (/Chromium\/(\d+)/.test(ua)) return `Chromium ${ua.match(/Chromium\/(\d+)/)?.[1] ?? ''}`
  return 'Unknown'
}

function detectOS(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

// ── Battery Section ───────────────────────────────────────────────────────────

function BatterySection() {
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

  if (unavailable) {
    return (
      <div style={sectionStyle}>
        <SectionHeader label="Battery" />
        <Row label="Status" value="Not available" />
      </div>
    )
  }

  if (!batteryState) {
    return (
      <div style={sectionStyle}>
        <SectionHeader label="Battery" />
        <Row label="Status" value="Loading..." />
      </div>
    )
  }

  const pct = Math.round(batteryState.level * 100)
  const chargeSymbol = batteryState.charging ? '▲' : '▼'
  const chargeLabel = batteryState.charging ? 'Charging' : 'Discharging'

  let timeValue = '—'
  if (batteryState.charging && batteryState.chargingTime !== Infinity && batteryState.chargingTime > 0) {
    const mins = Math.round(batteryState.chargingTime / 60)
    timeValue = `~${mins} min`
  } else if (!batteryState.charging && batteryState.dischargingTime !== Infinity && batteryState.dischargingTime > 0) {
    const hrs = Math.floor(batteryState.dischargingTime / 3600)
    const mins = Math.round((batteryState.dischargingTime % 3600) / 60)
    timeValue = hrs > 0 ? `~${hrs}h ${mins}m` : `~${mins} min`
  }

  return (
    <div style={sectionStyle}>
      <SectionHeader label="Battery" />
      <Row label="Level" value={`${pct}%`} />
      <Row label="State" value={`${chargeSymbol} ${chargeLabel}`} />
      {timeValue !== '—' && <Row label="Est. Time" value={timeValue} />}
    </div>
  )
}

// ── System Section ────────────────────────────────────────────────────────────

function SystemSection() {
  const [info, setInfo] = useState<{
    browser: string
    os: string
    screenRes: string
    windowSize: string
    language: string
    timezone: string
    connection: string
  } | null>(null)

  useEffect(() => {
    const nav = navigator as NavWithBattery
    const ua = navigator.userAgent

    const getInfo = () => ({
      browser: detectBrowser(ua),
      os: detectOS(ua),
      screenRes: `${window.screen.width} × ${window.screen.height}`,
      windowSize: `${window.innerWidth} × ${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      connection: nav.connection?.effectiveType ?? 'Unknown',
    })

    setInfo(getInfo())

    const onResize = () => {
      setInfo((prev) =>
        prev
          ? { ...prev, windowSize: `${window.innerWidth} × ${window.innerHeight}` }
          : getInfo()
      )
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!info) return null

  return (
    <div style={sectionStyle}>
      <SectionHeader label="System" />
      <Row label="Browser" value={info.browser} />
      <Row label="OS" value={info.os} />
      <Row label="Screen" value={info.screenRes} />
      <Row label="Window" value={info.windowSize} />
      <Row label="Language" value={info.language} />
      <Row label="Timezone" value={info.timezone} />
      <Row label="Connection" value={info.connection} />
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

  const formatDateTime = (d: Date): string => {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    const day = d.getDate()
    const year = d.getFullYear()
    const time = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    return `${weekday}, ${month} ${day} ${year} — ${time}`
  }

  // ── Location from timezone ────────────────────────────────────────────────
  const timezone =
    typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : ''
  const tzParts = timezone.split('/')
  const tzDisplay =
    tzParts.length >= 2
      ? tzParts.slice(0, 2).join(' / ').replace(/_/g, ' ')
      : timezone

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
          width={56}
          height={56}
          style={{
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
              fontSize: 13,
              fontWeight: 'bold',
              marginBottom: 2,
            }}
          >
            Raj Dholakia
          </div>
          <div style={{ ...chicago, fontSize: 11, marginBottom: 2 }}>
            Full-Stack Engineer &amp; Founder
          </div>
          <div style={{ ...chicago, fontSize: 11, color: '#555', marginBottom: 6 }}>
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
                fontSize: 10,
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
                fontSize: 10,
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
                fontSize: 10,
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
                fontSize: 10,
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

      {/* ── Section 2: Date & Time ───────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeader label="Date & Time" />
        <div style={{ ...chicago, fontSize: 11, lineHeight: 1.5 }}>
          {now ? formatDateTime(now) : '—'}
        </div>
      </div>

      {/* ── Section 3: System ───────────────────────────────────────────── */}
      <SystemSection />

      {/* ── Section 4: Battery ──────────────────────────────────────────── */}
      <BatterySection />

      {/* ── Section 5: Location (from timezone) ─────────────────────────── */}
      <div style={{ ...sectionStyle, borderBottom: 'none' }}>
        <SectionHeader label="Location (from timezone)" />
        <Row label="Region" value={tzDisplay || '—'} />
      </div>
    </div>
  )
}
