'use client'

import { useEffect, useState, useRef } from 'react'

interface DiagnosticsData {
  location: string
  platform: string
  language: string
  network: string
  memory: string
  cores: string
  uptime: string
  viewport: string
  screen: string
  colorDepth: string
  pixelRatio: string
  timezone: string
  host: string
  cookies: string
  java: string
  webgl: string
  battery: string
  geolocation: string
  localStorage: string
  sessionStorage: string
  indexedDB: string
  stat: string
  userAgent: string
}

interface TimeData {
  utc: string
  local: string
  unix: number
  zone: string
}

interface DiagnosticsProps {
  isOpen?: boolean
  onClose?: () => void
  showButton?: boolean
  className?: string
  invertColors?: boolean
}

export function Diagnostics({ isOpen: externalIsOpen, onClose, showButton = true, className = '', invertColors = false }: DiagnosticsProps = {}) {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [time, setTime] = useState<TimeData | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Use external isOpen if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = (open: boolean) => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen(open)
    } else if (!open && onClose) {
      onClose()
    }
  }

  useEffect(() => {
    const fetchDiagnostics = async () => {
      const diagnostics: Partial<DiagnosticsData> = {}

      // Platform
      diagnostics.platform = navigator.platform || 'Unknown'

      // Language
      diagnostics.language = navigator.language || 'Unknown'

      // Network (using connection API if available)
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      diagnostics.network = connection?.effectiveType || 'Unknown'

      // Memory (if available)
      const memory = (performance as any).memory
      if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / 1048576)
        const totalMB = Math.round(memory.totalJSHeapSize / 1048576)
        diagnostics.memory = `${usedMB}/${totalMB}MB`
      } else {
        diagnostics.memory = 'N/A'
      }

      // CPU Cores
      diagnostics.cores = navigator.hardwareConcurrency?.toString() || 'Unknown'

      // Uptime (time since page load)
      const uptimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      diagnostics.uptime = `${uptimeSeconds}S`

      // Viewport
      diagnostics.viewport = `${window.innerWidth}x${window.innerHeight}`

      // Screen
      diagnostics.screen = `${window.screen.width}x${window.screen.height}`

      // Color Depth
      diagnostics.colorDepth = `${window.screen.colorDepth}BIT`

      // Pixel Ratio
      diagnostics.pixelRatio = window.devicePixelRatio?.toString() || '1'

      // Timezone
      diagnostics.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'

      // Host
      diagnostics.host = window.location.hostname || 'Unknown'

      // Cookies
      diagnostics.cookies = navigator.cookieEnabled ? 'ENABLED' : 'DISABLED'

      // Java
      diagnostics.java = (navigator as any).javaEnabled?.() ? 'ENABLED' : 'DISABLED'

      // WebGL
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      diagnostics.webgl = gl ? 'ENABLED' : 'DISABLED'

      // Battery (if available)
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery()
          const level = Math.round(battery.level * 100)
          const charging = battery.charging ? 'CHG' : ''
          diagnostics.battery = `${level}% ${charging}`.trim()
        } catch {
          diagnostics.battery = 'N/A'
        }
      } else {
        diagnostics.battery = 'N/A'
      }

      // Geolocation
      diagnostics.geolocation = 'geolocation' in navigator ? 'AVAILABLE' : 'UNAVAILABLE'

      // Local Storage
      try {
        localStorage.setItem('test', 'test')
        localStorage.removeItem('test')
        diagnostics.localStorage = 'AVAILABLE'
      } catch {
        diagnostics.localStorage = 'UNAVAILABLE'
      }

      // Session Storage
      try {
        sessionStorage.setItem('test', 'test')
        sessionStorage.removeItem('test')
        diagnostics.sessionStorage = 'AVAILABLE'
      } catch {
        diagnostics.sessionStorage = 'UNAVAILABLE'
      }

      // IndexedDB
      diagnostics.indexedDB = 'indexedDB' in window ? 'AVAILABLE' : 'UNAVAILABLE'

      // Stat (Online/Offline)
      diagnostics.stat = navigator.onLine ? '• ONLINE' : '• OFFLINE'

      // User Agent
      diagnostics.userAgent = navigator.userAgent || 'Unknown'

      // Fetch IP location
      try {
        const ipResponse = await fetch('https://ipapi.co/json/')
        const ipData = await ipResponse.json()
        if (ipData.city && ipData.region) {
          diagnostics.location = `${ipData.city}, ${ipData.region}, ${ipData.country_name}`
        } else if (ipData.country_name) {
          diagnostics.location = ipData.country_name
        } else {
          diagnostics.location = 'Unknown'
        }
      } catch (error) {
        // Fallback to another IP service
        try {
          const fallbackResponse = await fetch('https://ip-api.com/json/')
          const fallbackData = await fallbackResponse.json()
          if (fallbackData.city && fallbackData.regionName) {
            diagnostics.location = `${fallbackData.city}, ${fallbackData.regionName}, ${fallbackData.country}`
          } else if (fallbackData.country) {
            diagnostics.location = fallbackData.country
          } else {
            diagnostics.location = 'Unknown'
          }
        } catch {
          diagnostics.location = 'Unknown'
        }
      }

      setData(diagnostics as DiagnosticsData)
    }

    fetchDiagnostics()

    // Update time function
    const updateTime = () => {
      const now = new Date()
      const utcTime = now.toISOString().substring(11, 19) // HH:MM:SS
      const localTime = now.toTimeString().substring(0, 8) // HH:MM:SS
      const unixTime = Math.floor(now.getTime() / 1000)

      // Get timezone offset
      const offset = -now.getTimezoneOffset()
      const offsetHours = Math.floor(Math.abs(offset) / 60)
      const offsetMinutes = Math.abs(offset) % 60
      const offsetSign = offset >= 0 ? '+' : '-'
      const zone = `GMT${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`

      setTime({
        utc: utcTime,
        local: localTime,
        unix: unixTime,
        zone,
      })
    }

    // Initialize time
    updateTime()

    // Update viewport on resize
    const updateViewport = () => {
      setData((prev) => {
        if (!prev) return prev
        return { ...prev, viewport: `${window.innerWidth}x${window.innerHeight}` }
      })
    }
    window.addEventListener('resize', updateViewport)

    // Update uptime and time every second
    const interval = setInterval(() => {
      setData((prev) => {
        if (!prev) return prev
        const uptimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
        return { ...prev, uptime: `${uptimeSeconds}S` }
      })
      updateTime()
    }, 1000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', updateViewport)
    }
  }, [])

  // Color scheme based on invertColors prop - defined before any returns
  const bgColor = invertColors ? 'rgb(var(--foreground))' : 'rgb(var(--card))'
  const textColor = invertColors ? 'rgb(var(--background))' : 'rgb(var(--foreground))'
  const mutedColor = invertColors ? 'rgb(var(--background) / 0.7)' : 'rgb(var(--muted-foreground))'
  const borderColor = invertColors ? 'rgba(var(--background), 0.2)' : 'rgba(var(--border), 0.5)'

  if (!data) {
    return (
      <div className="relative">
        <div
          className="rounded-lg p-3 text-xs font-mono shadow-lg transition-colors duration-300"
          style={{
            backgroundColor: bgColor,
          }}
        >
          <div style={{ color: mutedColor }}>LOADING...</div>
        </div>
      </div>
    )
  }

  const diagnosticsContent = (
    <div
      className={`rounded-lg p-4 text-xs font-mono max-w-md max-h-[70vh] overflow-y-auto shadow-lg transition-colors duration-300 ${className}`}
      style={{
        backgroundColor: bgColor,
      }}
    >
      <div
        className="mb-3 font-semibold text-sm border-b pb-2"
        style={{
          color: textColor,
          borderBottomColor: borderColor,
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
        }}
      >
        DIAGNOSTICS
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>LOCATION:</span>
          <span style={{ color: textColor }}>{data.location}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>PLATFORM:</span>
          <span style={{ color: textColor }}>{data.platform}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>LANGUAGE:</span>
          <span style={{ color: textColor }}>{data.language}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>NETWORK:</span>
          <span style={{ color: textColor }}>{data.network}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>MEMORY:</span>
          <span style={{ color: textColor }}>{data.memory}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>CORES:</span>
          <span style={{ color: textColor }}>{data.cores}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>UPTIME:</span>
          <span style={{ color: textColor }}>{data.uptime}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>VIEWPORT:</span>
          <span style={{ color: textColor }}>{data.viewport}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>SCREEN:</span>
          <span style={{ color: textColor }}>{data.screen}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>COLOR DEPTH:</span>
          <span style={{ color: textColor }}>{data.colorDepth}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>PIXEL RATIO:</span>
          <span style={{ color: textColor }}>{data.pixelRatio}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>TIMEZONE:</span>
          <span style={{ color: textColor }}>{data.timezone}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>HOST:</span>
          <span style={{ color: textColor }}>{data.host}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>COOKIES:</span>
          <span style={{ color: textColor }}>{data.cookies}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>JAVA:</span>
          <span style={{ color: textColor }}>{data.java}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>WEBGL:</span>
          <span style={{ color: textColor }}>{data.webgl}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>BATTERY:</span>
          <span style={{ color: textColor }}>{data.battery}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>GEOLOCATION:</span>
          <span style={{ color: textColor }}>{data.geolocation}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>LOCAL STORAGE:</span>
          <span style={{ color: textColor }}>{data.localStorage}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>SESSION STORAGE:</span>
          <span style={{ color: textColor }}>{data.sessionStorage}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>INDEXEDDB:</span>
          <span style={{ color: textColor }}>{data.indexedDB}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: mutedColor }}>STAT:</span>
          <span style={{ color: textColor }}>{data.stat}</span>
        </div>
        <div
          className="mt-3 pt-3"
          style={{
            borderTopColor: borderColor,
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
          }}
        >
          <div className="mb-1" style={{ color: mutedColor }}>USER AGENT:</div>
          <div className="break-all text-[10px]" style={{ color: textColor }}>
            {data.userAgent}
          </div>
        </div>
      </div>

      {time && (
        <div
          className="mt-4 pt-4"
          style={{
            borderTopColor: borderColor,
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
          }}
        >
          <div
            className="mb-2 font-semibold text-sm border-b pb-2"
            style={{
              color: textColor,
              borderBottomColor: borderColor,
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
            }}
          >
            TIME
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span style={{ color: mutedColor }}>UTC:</span>
              <span style={{ color: textColor }}>{time.utc}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: mutedColor }}>LOCAL:</span>
              <span style={{ color: textColor }}>{time.local}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: mutedColor }}>UNIX:</span>
              <span style={{ color: textColor }}>{time.unix}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: mutedColor }}>ZONE:</span>
              <span style={{ color: textColor }}>{time.zone}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // If showButton is false, just return the content
  if (!showButton) {
    return diagnosticsContent
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg p-3 text-xs font-mono shadow-lg transition-all duration-300"
        style={{
          backgroundColor: 'rgb(var(--card))',
          borderColor: 'transparent',
          borderWidth: '1px',
          borderStyle: 'solid',
          transform: 'scale(1)',
        }}
        onMouseEnter={(e) => {
          const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
          e.currentTarget.style.borderColor = `rgba(${primaryColor}, 0.3)`
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = `0 20px 25px -5px rgba(${primaryColor}, 0.2), 0 10px 10px -5px rgba(${primaryColor}, 0.1)`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div style={{ color: textColor }}>
          LOCATION: {data.location}
        </div>
        <div className="mt-1" style={{ color: mutedColor }}>
          {data.stat} • {data.platform}
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full right-0 mb-2"
        >
          {diagnosticsContent}
        </div>
      )}
    </div>
  )
}

