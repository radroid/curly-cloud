"use client"

import * as React from "react"
import { useState, useRef, useEffect, useCallback, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Diagnostics } from "@/app/components/diagnostics"

// ─── Types ───────────────────────────────────────────────────────────────────

interface EyeProps {
  isMobile: boolean
  side: "left" | "right"
  isBlinking: boolean
  isClose: boolean
  isLonely: boolean
  eyeRef: React.RefObject<HTMLDivElement>
  pupilRef: React.RefObject<HTMLDivElement>
}

// ─── Main Component ──────────────────────────────────────────────────────────

const MouseFollowingEyes: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isBlinking, setIsBlinking] = useState(false)
  // Threshold states — only update when crossing boundaries, not every frame
  const [isClose, setIsClose] = useState(false)
  const [isLonely, setIsLonely] = useState(true)

  const eye1Ref = useRef<HTMLDivElement>(null)
  const eye2Ref = useRef<HTMLDivElement>(null)
  const pupil1Ref = useRef<HTMLDivElement>(null)
  const pupil2Ref = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  // Cached eye rects — updated on resize/scroll only
  const eye1Rect = useRef<DOMRect | null>(null)
  const eye2Rect = useRef<DOMRect | null>(null)

  const updateRects = useCallback(() => {
    if (eye1Ref.current) eye1Rect.current = eye1Ref.current.getBoundingClientRect()
    if (eye2Ref.current) eye2Rect.current = eye2Ref.current.getBoundingClientRect()
  }, [])

  // Detect mobile
  useEffect(() => {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0
    setIsMobile(touch)
  }, [])

  // Core mousemove loop — all hot-path work via refs + direct DOM, zero React re-renders
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300)

    let rafId: number | null = null
    let latestX = 0
    let latestY = 0
    // Track previous threshold states to avoid unnecessary setState calls
    let prevIsClose = false
    let prevIsLonely = true

    // Initial rect cache
    updateRects()

    const handleMouseMove = (e: MouseEvent) => {
      latestX = e.clientX
      latestY = e.clientY
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null

          // ── Magnet: write directly to inner container ──
          if (innerRef.current) {
            const el = innerRef.current
            const rect = el.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const dx = latestX - cx
            const dy = latestY - cy
            const dist = Math.sqrt(dx * dx + dy * dy)

            // Threshold transitions — only set state when crossing
            const nowClose = dist < 200
            const nowLonely = dist > 400
            if (nowClose !== prevIsClose) { prevIsClose = nowClose; setIsClose(nowClose) }
            if (nowLonely !== prevIsLonely) { prevIsLonely = nowLonely; setIsLonely(nowLonely) }

            if (dist < 250) {
              const pull = (1 - dist / 250) ** 2
              const dirX = dx / (dist || 1)
              const dirY = dy / (dist || 1)
              el.style.transform = `translate(${dirX * pull * 20}px, ${dirY * pull * 20}px)`
            } else {
              el.style.transform = "translate(0px, 0px)"
            }
          }

          // ── Pupils: write directly to DOM ──
          movePupil(pupil1Ref.current, eye1Rect.current, latestX, latestY)
          movePupil(pupil2Ref.current, eye2Rect.current, latestX, latestY)
        })
      }
    }

    const handleResizeOrScroll = () => updateRects()
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("resize", handleResizeOrScroll)
    window.addEventListener("scroll", handleResizeOrScroll, { passive: true })

    // Tooltip logic
    let showTimer: NodeJS.Timeout | undefined
    let hideTimer: NodeJS.Timeout | undefined
    const hasSeenTooltip = localStorage.getItem("eyes-tooltip-seen")
    if (!hasSeenTooltip) {
      showTimer = setTimeout(() => setShowTooltip(true), 1500)
      hideTimer = setTimeout(() => {
        setShowTooltip(false)
        localStorage.setItem("eyes-tooltip-seen", "true")
      }, 8000)
    }

    return () => {
      clearTimeout(timer)
      if (showTimer) clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("resize", handleResizeOrScroll)
      window.removeEventListener("scroll", handleResizeOrScroll)
    }
  }, [updateRects])

  // Synchronized blinking
  useEffect(() => {
    let cancelled = false
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 5000
      return setTimeout(() => {
        if (cancelled) return
        setIsBlinking(true)
        setTimeout(() => {
          if (!cancelled) setIsBlinking(false)
        }, 150 + Math.random() * 100)
        if (Math.random() < 0.2) {
          setTimeout(() => {
            if (cancelled) return
            setIsBlinking(true)
            setTimeout(() => {
              if (!cancelled) setIsBlinking(false)
            }, 120)
          }, 300)
        }
        timerId = scheduleBlink()
      }, delay)
    }
    let timerId = scheduleBlink()
    return () => { cancelled = true; clearTimeout(timerId) }
  }, [])

  const handleEyesClick = useCallback(() => {
    setIsDiagnosticsOpen(prev => !prev)
    setShowTooltip(prev => {
      if (prev) localStorage.setItem("eyes-tooltip-seen", "true")
      return false
    })
  }, [])

  const handleDiagnosticsClose = useCallback(() => setIsDiagnosticsOpen(false), [])

  return (
    <div
      className="relative w-full -mt-4 sm:-mt-6 md:-mt-8"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="w-full h-[200px] sm:h-[250px] md:h-[300px] flex justify-center items-center overflow-visible">
        <div
          ref={innerRef}
          style={{ transition: "transform 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
        >
          <button
            onClick={handleEyesClick}
            className="relative flex items-center gap-4 sm:gap-6 md:gap-8 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-full"
            aria-label="Tap to see what I see"
          >
            <Eye
              eyeRef={eye1Ref}
              pupilRef={pupil1Ref}
              isMobile={isMobile}
              side="left"
              isBlinking={isBlinking}
              isClose={isClose}
              isLonely={isLonely}
            />
            <Eye
              eyeRef={eye2Ref}
              pupilRef={pupil2Ref}
              isMobile={isMobile}
              side="right"
              isBlinking={isBlinking}
              isClose={isClose}
              isLonely={isLonely}
            />
          </button>

          {/* Tooltip */}
          <AnimatePresence>
            {showTooltip && !isDiagnosticsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-4 whitespace-nowrap px-4 py-2 rounded-lg shadow-lg pointer-events-none z-30"
                style={{
                  backgroundColor: "rgb(var(--card))",
                  border: "1px solid rgb(var(--border))",
                }}
              >
                <p className="text-sm font-medium" style={{ color: "rgb(var(--foreground))" }}>
                  Tap to see what I see
                </p>
                <div
                  className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2"
                  style={{
                    backgroundColor: "rgb(var(--card))",
                    border: "1px solid rgb(var(--border))",
                    borderBottom: "none",
                    borderRight: "none",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Diagnostics isOpen={isDiagnosticsOpen} onClose={handleDiagnosticsClose} />
        </div>
      </div>

      <EyeKeyframes />
    </div>
  )
}

// ─── Pupil math — pure function, no React ────────────────────────────────────

const MAX_MOVE = 14
const OFFSET_Y = -3

function movePupil(
  pupilEl: HTMLDivElement | null,
  eyeRect: DOMRect | null,
  mouseX: number,
  mouseY: number,
) {
  if (!pupilEl || !eyeRect) return
  const cx = eyeRect.left + eyeRect.width / 2
  const cy = eyeRect.top + eyeRect.height / 2
  const dx = mouseX - cx
  const dy = mouseY - cy
  const angle = Math.atan2(dy, dx)
  const dist = Math.sqrt(dx * dx + dy * dy)
  const radius = eyeRect.width / 2
  const move = dist < radius ? (dist / radius) * MAX_MOVE : MAX_MOVE
  pupilEl.style.transform = `translate(${Math.cos(angle) * move}px, ${Math.sin(angle) * move + OFFSET_Y}px)`
}

// ─── Eye Component (memoized) ────────────────────────────────────────────────

const Eye = memo<EyeProps>(({ isMobile, side, isBlinking, isClose, isLonely, eyeRef, pupilRef }) => {
  // Mobile idle: natural human-like gaze behavior
  useEffect(() => {
    if (!isMobile || !pupilRef.current) return
    let cancelled = false

    const gazePoints = [
      { x: 0, y: -3 },
      { x: -8, y: -5 },
      { x: 10, y: -2 },
      { x: -4, y: 2 },
      { x: 6, y: -6 },
      { x: -12, y: 0 },
      { x: 12, y: -1 },
      { x: 2, y: -8 },
      { x: -2, y: 4 },
      { x: 0, y: -3 },
    ]
    let lastIdx = 0

    const scheduleGaze = () => {
      if (cancelled) return
      let nextIdx: number
      if (Math.random() < 0.3) {
        nextIdx = 0
      } else {
        do { nextIdx = Math.floor(Math.random() * gazePoints.length) } while (nextIdx === lastIdx)
      }
      const t = gazePoints[nextIdx]
      const jx = t.x + (Math.random() - 0.5) * 3
      const jy = t.y + (Math.random() - 0.5) * 2
      const dur = 80 + Math.random() * 70
      if (pupilRef.current) {
        pupilRef.current.style.transition = `transform ${dur}ms cubic-bezier(0.2, 0, 0.1, 1)`
        pupilRef.current.style.transform = `translate(${jx}px, ${jy}px)`
      }
      lastIdx = nextIdx
      const hold = nextIdx === 0 ? 2000 + Math.random() * 2500 : 800 + Math.random() * 2200
      timerId = setTimeout(scheduleGaze, hold)
    }
    let timerId = setTimeout(scheduleGaze, 1200)
    return () => { cancelled = true; clearTimeout(timerId) }
  }, [isMobile, pupilRef])

  const morphRotation = side === "left" ? -2 : 3

  // Dog eyes: lonely drift via transform (GPU-composited, no layout)
  const lonelySide = side === "left" ? 3 : -3
  const pupilTranslateExtra = !isMobile && isLonely ? `translate(${lonelySide}px, 2px)` : ""

  return (
    <div className="relative">
      <div
        ref={eyeRef}
        className="relative h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 flex items-center justify-center overflow-hidden"
        style={{
          borderRadius: isMobile
            ? "50%"
            : isClose
              ? side === "left" ? "46% 52% 50% 50%" : "52% 46% 50% 50%"
              : "48% 52% 50% 50%",
          background: "radial-gradient(circle at center, #ffffff 60%, rgb(var(--primary) / 0.08) 100%)",
          boxShadow: `
            inset 0 -8px 16px rgb(var(--foreground) / 0.08),
            0 4px 20px rgb(var(--foreground) / 0.1),
            0 0 0 2px rgb(var(--foreground) / 0.15)
          `,
          animation: isMobile ? "eye-breathe 3s ease-in-out infinite, eye-morph 8s ease-in-out infinite" : undefined,
          transform: `rotate(${morphRotation}deg)`,
          transition: "border-radius 300ms ease",
        }}
      >
        {/* Bottom inner shadow for droopy lower lids */}
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ boxShadow: "inset 0 -6px 12px rgb(var(--foreground) / 0.06)" }}
        />

        {/* Pupil — dark brown */}
        <div
          ref={pupilRef}
          className="absolute flex items-center justify-center"
          style={{
            width: "40%",
            height: "40%",
            borderRadius: "50%",
            background: "radial-gradient(circle, #3b1f0a 50%, #5c3317 75%, #8b5e3c 100%)",
            transform: `translate(0px, -3px) scale(${isClose && !isMobile ? 1.1 : 1}) ${pupilTranslateExtra}`,
            transition: "scale 400ms ease",
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: "35%", height: "35%", top: "15%", left: "15%",
              background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: "15%", height: "15%", bottom: "25%", right: "20%",
              backgroundColor: "rgba(255,255,255,0.7)",
            }}
          />
        </div>

        {/* Upper eyelid */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none z-10"
          style={{
            height: isBlinking ? "55%" : "0%",
            background: "linear-gradient(to bottom, rgb(var(--background)) 70%, rgb(var(--background) / 0.85) 100%)",
            borderRadius: "0 0 40% 40%",
            transition: "height 80ms cubic-bezier(0.4, 0, 1, 1)",
            boxShadow: isBlinking ? "0 2px 6px rgb(var(--foreground) / 0.1)" : "none",
          }}
        />
        {/* Lower eyelid */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
          style={{
            height: isBlinking ? "45%" : "0%",
            background: "linear-gradient(to top, rgb(var(--background)) 70%, rgb(var(--background) / 0.85) 100%)",
            borderRadius: "40% 40% 0 0",
            transition: "height 80ms cubic-bezier(0.4, 0, 1, 1)",
          }}
        />
      </div>
    </div>
  )
})
Eye.displayName = "Eye"

// ─── Keyframes (static, never re-renders) ────────────────────────────────────

const EyeKeyframes = memo(() => (
  <style>{`
    @keyframes eye-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
    @keyframes eye-morph {
      0%, 100% { border-radius: 48% 52% 50% 50%; }
      25% { border-radius: 50% 48% 52% 50%; }
      50% { border-radius: 52% 50% 48% 52%; }
      75% { border-radius: 50% 52% 50% 48%; }
    }
  `}</style>
))
EyeKeyframes.displayName = "EyeKeyframes"

export { MouseFollowingEyes }
