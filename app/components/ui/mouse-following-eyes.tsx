"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Diagnostics } from "@/app/components/diagnostics"

const MouseFollowingEyes: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const eye1Ref = useRef<HTMLDivElement>(null)
  const eye2Ref = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fade in on mount
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 300)

    // Track mouse position globally
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)

    // Show tooltip if user hasn't seen it before
    let showTimer: NodeJS.Timeout | undefined
    let hideTimer: NodeJS.Timeout | undefined

    const hasSeenEyesTooltip = localStorage.getItem("eyes-tooltip-seen")
    if (!hasSeenEyesTooltip) {
      showTimer = setTimeout(() => {
        setShowTooltip(true)
      }, 1500)

      hideTimer = setTimeout(() => {
        setShowTooltip(false)
        localStorage.setItem("eyes-tooltip-seen", "true")
      }, 8000)
    }

    return () => {
      clearTimeout(timer)
      if (showTimer) clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  const handleEyesClick = () => {
    setIsDiagnosticsOpen(!isDiagnosticsOpen)
    if (showTooltip) {
      setShowTooltip(false)
      localStorage.setItem("eyes-tooltip-seen", "true")
    }
  }

  // Calculate the width of both eyes plus the gap between them
  // Eyes: h-20 (80px) on mobile, h-24 (96px) on sm, h-28 (112px) on md
  // Gap: gap-4 (16px) on mobile, gap-6 (24px) on sm, gap-8 (32px) on md
  // Total width: 2 * eye_width + gap

  return (
    <div
      ref={containerRef}
      className="relative w-full -mt-4 sm:-mt-6 md:-mt-8"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="w-full h-[200px] sm:h-[250px] md:h-[300px] flex justify-center items-center overflow-visible">
        <div className="relative flex items-center gap-4 sm:gap-6 md:gap-8">
          <Eye
            mouseX={mousePos.x}
            mouseY={mousePos.y}
            selfRef={eye1Ref as React.RefObject<HTMLDivElement>}
            otherRef={eye2Ref as React.RefObject<HTMLDivElement>}
          />

          {/* Clickable area between eyes */}
          <button
            onClick={handleEyesClick}
            className="absolute left-1/2 -translate-x-1/2 w-16 sm:w-20 md:w-24 h-20 sm:h-24 md:h-28 z-10 cursor-pointer"
            aria-label="Open diagnostics"
          />

          <Eye
            mouseX={mousePos.x}
            mouseY={mousePos.y}
            selfRef={eye2Ref as React.RefObject<HTMLDivElement>}
            otherRef={eye1Ref as React.RefObject<HTMLDivElement>}
          />

          {/* Tooltip - positioned below eyes */}
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
                  Click between to see what I see
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

          {/* Diagnostics Panel - positioned above eyes */}
          <AnimatePresence>
            {isDiagnosticsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[100] w-[176px] sm:w-[216px] md:w-[256px]"
              >
                <Diagnostics
                  isOpen={true}
                  onClose={() => setIsDiagnosticsOpen(false)}
                  showButton={false}
                  invertColors={true}
                  className="!max-w-none w-full shadow-2xl"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

interface EyeProps {
  mouseX: number
  mouseY: number
  selfRef: React.RefObject<HTMLDivElement>
  otherRef: React.RefObject<HTMLDivElement>
}

const Eye: React.FC<EyeProps> = ({ mouseX, mouseY, selfRef, otherRef }) => {
  const pupilRef = useRef<HTMLDivElement>(null)
  const [center, setCenter] = useState({ x: 0, y: 0 })

  const updateCenter = () => {
    if (!selfRef.current) return
    const rect = selfRef.current.getBoundingClientRect()
    setCenter({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }

  useEffect(() => {
    updateCenter()
    window.addEventListener("resize", updateCenter)
    window.addEventListener("scroll", updateCenter)
    return () => {
      window.removeEventListener("resize", updateCenter)
      window.removeEventListener("scroll", updateCenter)
    }
  }, [])

  useEffect(() => {
    updateCenter()

    const isInside = (ref: React.RefObject<HTMLDivElement>) => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return false
      return (
        mouseX >= rect.left &&
        mouseX <= rect.right &&
        mouseY >= rect.top &&
        mouseY <= rect.bottom
      )
    }

    if (isInside(selfRef) || isInside(otherRef)) return

    const dx = mouseX - center.x
    const dy = mouseY - center.y
    const angle = Math.atan2(dy, dx)

    const maxMove = 16
    const pupilX = Math.cos(angle) * maxMove
    const pupilY = Math.sin(angle) * maxMove

    if (pupilRef.current) {
      pupilRef.current.style.transform = `translate(${pupilX}px, ${pupilY}px)`
    }
  }, [mouseX, mouseY, center.x, center.y, selfRef, otherRef])

  return (
    <div
      ref={selfRef}
      className="relative rounded-full h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 flex items-center justify-center border-4"
      style={{
        backgroundColor: "#ffffff",
        borderColor: "rgb(var(--foreground))",
      }}
    >
      <div
        ref={pupilRef}
        className="absolute rounded-full h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 transition-transform duration-[5ms]"
        style={{
          backgroundColor: "#0f172a",
        }}
      >
        <div
          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full absolute bottom-1 right-1"
          style={{
            backgroundColor: "#ffffff",
          }}
        />
      </div>
    </div>
  )
}

export { MouseFollowingEyes }