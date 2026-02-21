"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useReducedMotion } from "@/app/lib/use-reduced-motion"

export function OrbitalClock() {
  const prefersReduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState(new Date())
  const [isHovered, setIsHovered] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const cachedRect = useRef<DOMRect | null>(null)

  useEffect(() => {
    setMounted(true)
    setTime(new Date())
    
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)
    
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const handleMouseEnterClock = useCallback(() => {
    setIsHovered(true)
    if (containerRef.current) {
      cachedRect.current = containerRef.current.getBoundingClientRect()
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (prefersReduced) return
    const rect = cachedRect.current
    if (!rect) return
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    setMousePos({ x: x * 8, y: y * 8 })
  }, [prefersReduced])

  const seconds = time.getSeconds() + time.getMilliseconds() / 1000
  const minutes = time.getMinutes() + seconds / 60
  const hours = (time.getHours() % 12) + minutes / 60

  const secondDeg = seconds * 6
  const minuteDeg = minutes * 6
  const hourDeg = hours * 30

  const formatDate = () => {
    return time.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const getTimezone = () => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      // Get timezone abbreviation (e.g., EST, PST, GMT)
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZoneName: "short",
        timeZone,
      })
      const parts = formatter.formatToParts(time)
      const tzName = parts.find((part) => part.type === "timeZoneName")?.value || timeZone
      return tzName
    } catch {
      // Fallback if timezone detection fails
      return "UTC"
    }
  }

  // Prevent hydration mismatch by only rendering after mount
  if (!mounted) {
    return (
      <div className="relative flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32">
        <div 
          className="absolute inset-2 rounded-full shadow-xl transition-colors duration-300"
          style={{
            backgroundColor: 'rgb(var(--orb-clock-bg))',
            borderColor: 'rgba(var(--border), 0.7)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`
        relative flex items-center justify-center cursor-pointer select-none
        text-slate-900 dark:text-slate-100
      `}
      onMouseEnter={handleMouseEnterClock}
      onMouseLeave={() => {
        setIsHovered(false)
        setMousePos({ x: 0, y: 0 })
      }}
      onMouseMove={handleMouseMove}
      style={{
        perspective: "600px",
      }}
    >
      {/* Main clock container - smaller size */}
      <div
        className="relative w-24 h-24 sm:w-32 sm:h-32 transition-transform duration-300 ease-out"
        style={{
          transform: `rotateX(${-mousePos.y}deg) rotateY(${mousePos.x}deg)`,
        }}
      >
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full transition-[background,transform] duration-500"
          style={{
            background: isHovered && !prefersReduced
              ? `radial-gradient(circle, color-mix(in srgb, rgb(var(--orb-primary)) 40%, transparent) 0%, transparent 70%)`
              : "transparent",
            transform: isHovered && !prefersReduced ? "scale(1.3)" : "scale(1)",
          }}
        />

        {/* Clock face */}
        <div 
          className="absolute inset-2 rounded-full shadow-xl transition-colors duration-300"
          style={{
            backgroundColor: 'rgb(var(--orb-clock-bg))',
            borderColor: 'rgba(var(--border), 0.7)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          {/* Inner subtle ring */}
          <div
            className={`absolute inset-3 rounded-full border transition-[border-color,opacity] duration-500 ${
              isHovered
                ? `border-[rgb(var(--orb-primary))]/40`
                : "border-black/5 dark:border-white/5"
            }`}
          />

          {/* Hour markers */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = i * 30
            const isActive = Math.floor(hours) === i || Math.floor(hours) === i + 12
            const rad = (angle - 90) * (Math.PI / 180)
            const x = 50 + 38 * Math.cos(rad)
            const y = 50 + 38 * Math.sin(rad)

            return (
              <div
                key={i}
                className="absolute rounded-full transition-all duration-300"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                  ...(isActive 
                    ? {
                        background: `rgb(var(--orb-primary))`,
                        boxShadow: `0 0 10px color-mix(in srgb, rgb(var(--orb-primary)) 70%, transparent)`,
                        width: '6px',
                        height: '6px',
                      }
                    : i % 3 === 0
                      ? {
                          background: `rgb(var(--orb-marker-strong))`,
                          opacity: 0.8,
                          width: '4px',
                          height: '4px',
                        }
                      : {
                          background: `rgb(var(--orb-marker-weak))`,
                          opacity: 0.5,
                          width: '4px',
                          height: '4px',
                        }
                  ),
                }}
              />
            )
          })}

          {/* Hour hand */}
          <div
            className="absolute left-1/2 bottom-1/2 origin-bottom rounded-full transition-all duration-200"
            style={{
              width: '3px',
              height: "28%",
              transform: `translateX(-50%) rotate(${hourDeg}deg)`,
              backgroundColor: 'rgb(var(--orb-marker-strong))',
              borderRadius: '3px',
            }}
          />

          {/* Minute hand */}
          <div
            className="absolute left-1/2 bottom-1/2 origin-bottom rounded-full transition-all duration-200"
            style={{
              width: '2px',
              height: "36%",
              transform: `translateX(-50%) rotate(${minuteDeg}deg)`,
              backgroundColor: 'rgb(var(--orb-marker-weak))',
              borderRadius: '2px',
            }}
          />

          {/* Second hand */}
          <div
            className="absolute left-1/2 bottom-1/2 origin-bottom rounded-full"
            style={{
              width: "1px",
              height: "40%",
              transform: `translateX(-50%) rotate(${secondDeg}deg)`,
              background: `rgb(var(--orb-primary))`,
              boxShadow: `0 0 8px color-mix(in srgb, rgb(var(--orb-primary)) 70%, transparent)`,
            }}
          />

          {/* Center dot */}
          <div
            className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full transition-all duration-300"
            style={{
              transform: "translate(-50%, -50%)",
              background: isHovered ? `rgb(var(--orb-primary))` : `rgba(var(--orb-center), 0.9)`,
              boxShadow: isHovered
                ? `0 0 12px color-mix(in srgb, rgb(var(--orb-primary)) 80%, transparent)`
                : "none",
            }}
          />
        </div>
      </div>

      {/* Date and timezone reveal on hover - left on mobile, below on desktop */}
      <div
        className="absolute flex flex-col items-end justify-center right-full mr-1 sm:right-auto sm:left-1/2 sm:mr-0 sm:-bottom-12 sm:items-center font-mono text-xs tracking-[0.3em] uppercase transition-[border-color,opacity] duration-500 whitespace-nowrap"
        style={{
          // Mobile: slide in from right (positive translateX when hidden, comes from left side)
          // Desktop: slide up from bottom (negative translateY when hidden)
          transform: isMobile
            ? (isHovered ? 'translateX(0) translateY(0)' : 'translateX(10px) translateY(0)')
            : (isHovered ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-10px)'),
          opacity: isHovered ? 1 : 0,
          color: isHovered ? `rgb(var(--orb-primary))` : `rgba(var(--orb-date), 0.9)`,
        }}
      >
        <div suppressHydrationWarning>{formatDate()}</div>
        <div className="text-[0.65rem] tracking-[0.2em] mt-1 opacity-80" suppressHydrationWarning>
          {getTimezone()}
        </div>
      </div>
    </div>
  )
}

