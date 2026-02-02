"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"

const MouseFollowingEyes: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)
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

    return () => {
      clearTimeout(timer)
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden -mt-4 sm:-mt-6 md:-mt-8"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      aria-hidden="true"
    >
      <div className="w-full h-[200px] sm:h-[250px] md:h-[300px] flex justify-center items-center gap-4 sm:gap-6 md:gap-8">
        <Eye
          mouseX={mousePos.x}
          mouseY={mousePos.y}
          selfRef={eye1Ref as React.RefObject<HTMLDivElement>}
          otherRef={eye2Ref as React.RefObject<HTMLDivElement>}
        />
        <Eye
          mouseX={mousePos.x}
          mouseY={mousePos.y}
          selfRef={eye2Ref as React.RefObject<HTMLDivElement>}
          otherRef={eye1Ref as React.RefObject<HTMLDivElement>}
        />
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