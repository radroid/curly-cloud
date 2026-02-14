'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from '@/app/lib/use-location'

interface DiagnosticsData {
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
  cookies: boolean
  webgl: boolean
  battery: string
  geolocation: boolean
  localStorage: boolean
  sessionStorage: boolean
  indexedDB: boolean
  online: boolean
}

interface TimeData {
  utc: string
  local: string
  unix: number
  zone: string
}

interface DiagnosticsProps {
  isOpen: boolean
  onClose: () => void
}

export function Diagnostics({ isOpen, onClose }: DiagnosticsProps) {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [time, setTime] = useState<TimeData | null>(null)
  const [mounted, setMounted] = useState(false)
  const startTimeRef = useRef<number>(Date.now())
  const cardRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const location = useLocation()

  // Track mount for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Gather diagnostics data
  useEffect(() => {
    const gather = async () => {
      const d: Partial<DiagnosticsData> = {}

      d.platform = navigator.platform || 'Unknown'
      d.language = navigator.language || 'Unknown'

      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      d.network = conn?.effectiveType || 'Unknown'

      const mem = (performance as any).memory
      if (mem) {
        d.memory = `${Math.round(mem.usedJSHeapSize / 1048576)}/${Math.round(mem.totalJSHeapSize / 1048576)}MB`
      } else {
        d.memory = 'N/A'
      }

      d.cores = navigator.hardwareConcurrency?.toString() || 'Unknown'
      d.uptime = `${Math.floor((Date.now() - startTimeRef.current) / 1000)}S`
      d.viewport = `${window.innerWidth}x${window.innerHeight}`
      d.screen = `${window.screen.width}x${window.screen.height}`
      d.colorDepth = `${window.screen.colorDepth}BIT`
      d.pixelRatio = `${window.devicePixelRatio || 1}x`
      d.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
      d.host = window.location.hostname || 'Unknown'
      d.cookies = navigator.cookieEnabled
      d.online = navigator.onLine

      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      d.webgl = !!gl

      if ('getBattery' in navigator) {
        try {
          const bat = await (navigator as any).getBattery()
          const level = Math.round(bat.level * 100)
          d.battery = bat.charging ? `${level}% CHG` : `${level}%`
        } catch {
          d.battery = 'N/A'
        }
      } else {
        d.battery = 'N/A'
      }

      d.geolocation = 'geolocation' in navigator

      try {
        window.localStorage.setItem('__test', '1')
        window.localStorage.removeItem('__test')
        d.localStorage = true
      } catch {
        d.localStorage = false
      }

      try {
        window.sessionStorage.setItem('__test', '1')
        window.sessionStorage.removeItem('__test')
        d.sessionStorage = true
      } catch {
        d.sessionStorage = false
      }

      d.indexedDB = 'indexedDB' in window

      setData(d as DiagnosticsData)
    }

    gather()

    const updateTime = () => {
      const now = new Date()
      const offset = -now.getTimezoneOffset()
      const offsetHours = Math.floor(Math.abs(offset) / 60)
      const offsetMinutes = Math.abs(offset) % 60
      const sign = offset >= 0 ? '+' : '-'

      setTime({
        utc: now.toISOString().substring(11, 19),
        local: now.toTimeString().substring(0, 8),
        unix: Math.floor(now.getTime() / 1000),
        zone: `GMT${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`,
      })
    }

    updateTime()

    const handleResize = () => {
      setData((prev) => prev ? { ...prev, viewport: `${window.innerWidth}x${window.innerHeight}` } : prev)
    }
    window.addEventListener('resize', handleResize)

    const interval = setInterval(() => {
      setData((prev) => {
        if (!prev) return prev
        return { ...prev, uptime: `${Math.floor((Date.now() - startTimeRef.current) / 1000)}S` }
      })
      updateTime()
    }, 1000)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Scroll lock + focus management
  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    // Focus close button after portal renders
    requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    return () => {
      document.body.style.overflow = ''
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return

    const card = cardRef.current
    if (!card) return

    const focusable = card.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  // Check reduced motion
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!isOpen || !mounted) return null

  const shortTimezone = data?.timezone?.split('/').pop()?.replace(/_/g, ' ') || ''

  const capabilities = [
    { label: 'COOKIES', active: data?.cookies },
    { label: 'WEBGL', active: data?.webgl },
    { label: 'STORAGE', active: data?.localStorage },
    { label: 'SESSION', active: data?.sessionStorage },
    { label: 'IDB', active: data?.indexedDB },
    { label: 'GEO', active: data?.geolocation },
  ]

  const gridRows: [string, string, string, string][] = data ? [
    ['LANG', data.language, 'VIEW', data.viewport],
    ['NET', data.network, 'SCREEN', data.screen],
    ['MEM', data.memory, 'DEPTH', data.colorDepth],
    ['CORES', data.cores, 'DPI', data.pixelRatio],
    ['UP', data.uptime, 'TZ', shortTimezone],
    ['BATT', data.battery, 'HOST', data.host],
  ] : []

  const overlay = (
    <>
      {/* Blur overlay */}
      <div
        className="fixed inset-0 z-[90]"
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          backgroundColor: 'rgb(var(--background) / 0.3)',
          transition: prefersReducedMotion ? 'none' : 'opacity 200ms ease-out',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card container */}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="System diagnostics"
        onKeyDown={handleKeyDown}
      >
        <div
          ref={cardRef}
          className="w-full max-w-[380px] max-h-[85vh] overflow-y-auto font-mono text-xs"
          style={{
            backgroundColor: 'rgb(var(--card))',
            color: 'rgb(var(--foreground))',
            border: '4px solid rgb(var(--foreground))',
            animation: prefersReducedMotion ? 'none' : 'diagnostics-in 200ms ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button row */}
          <div className="flex justify-end" style={{ borderBottom: '2px solid rgb(var(--foreground))' }}>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="flex items-center justify-center font-bold text-base cursor-pointer"
              style={{
                width: '44px',
                height: '44px',
                color: 'rgb(var(--foreground))',
                outline: 'none',
              }}
              aria-label="Close diagnostics"
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid rgb(var(--primary))'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
            >
              X
            </button>
          </div>

          {/* Inverted header bar */}
          <div
            className="px-4 py-3 text-sm font-bold tracking-wider"
            style={{
              backgroundColor: 'rgb(var(--foreground))',
              color: 'rgb(var(--background))',
            }}
          >
            YOUR DATA. EXPOSED.
          </div>

          {/* Location */}
          <div className="px-4 pt-4 pb-3">
            <div
              className="font-bold uppercase leading-tight"
              style={{
                fontSize: '20px',
                color: 'rgb(var(--foreground))',
              }}
            >
              {location.full}
            </div>
            {location.estimated && (
              <div
                className="mt-1 text-[10px] uppercase tracking-wider"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                * Estimated from timezone
              </div>
            )}
          </div>

          {/* Heavy border */}
          <div style={{ borderBottom: '4px solid rgb(var(--foreground))' }} />

          {/* Platform + status */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '2px solid rgb(var(--foreground))' }}
          >
            <span className="font-bold" style={{ color: 'rgb(var(--foreground))' }}>
              {data?.platform || 'Unknown'}
            </span>
            <span
              className="px-2 py-0.5 text-[10px] font-bold tracking-wider"
              style={{
                backgroundColor: data?.online ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
                color: data?.online ? 'rgb(var(--primary-foreground))' : 'rgb(var(--background))',
              }}
            >
              {data?.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Two-column data grid */}
          {data && (
            <div className="px-4 py-2" style={{ borderBottom: '2px solid rgb(var(--foreground))' }}>
              {gridRows.map(([label1, value1, label2, value2], i) => (
                <div
                  key={i}
                  className="grid py-1.5"
                  style={{
                    gridTemplateColumns: '1fr 1fr',
                    borderBottom: i < gridRows.length - 1 ? '1px solid rgb(var(--border))' : 'none',
                  }}
                >
                  <div className="flex justify-between pr-3" style={{ borderRight: '1px solid rgb(var(--border))' }}>
                    <span style={{ color: 'rgb(var(--muted-foreground))' }}>{label1}</span>
                    <span className="font-bold" style={{ color: 'rgb(var(--foreground))' }}>{value1}</span>
                  </div>
                  <div className="flex justify-between pl-3">
                    <span style={{ color: 'rgb(var(--muted-foreground))' }}>{label2}</span>
                    <span className="font-bold" style={{ color: 'rgb(var(--foreground))' }}>{value2}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Capability pills */}
          <div className="px-4 py-3" style={{ borderBottom: '4px solid rgb(var(--foreground))' }}>
            <div className="flex flex-wrap gap-2">
              {capabilities.map(({ label, active }) => (
                <span
                  key={label}
                  className="px-2 py-1 text-[10px] font-bold tracking-wider"
                  style={active ? {
                    backgroundColor: 'rgb(var(--foreground))',
                    color: 'rgb(var(--background))',
                  } : {
                    backgroundColor: 'rgb(var(--card))',
                    color: 'rgb(var(--foreground))',
                    border: '1px solid rgb(var(--foreground))',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Time section */}
          {time && (
            <div className="px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span
                  className="font-bold"
                  style={{
                    fontSize: '28px',
                    color: 'rgb(var(--foreground))',
                    letterSpacing: '0.05em',
                  }}
                >
                  {time.local}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: 'rgb(var(--muted-foreground))' }}
                >
                  {time.zone}
                </span>
              </div>
              <div
                className="flex items-baseline justify-between mt-1"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                <span>UTC {time.utc}</span>
                <span className="tabular-nums">{time.unix}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes diagnostics-in {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  )

  return createPortal(overlay, document.body)
}
