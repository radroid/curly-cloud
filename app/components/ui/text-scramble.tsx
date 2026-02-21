"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { cn } from "@/app/lib/utils"
import { useReducedMotion } from "@/app/lib/use-reduced-motion"

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*"

interface TextScrambleProps {
  text: string
  className?: string
  textSize?: string
}

export function TextScramble({ text, className = "", textSize = "text-lg" }: TextScrambleProps) {
  const prefersReduced = useReducedMotion()
  const [displayText, setDisplayText] = useState(text)
  const [isHovering, setIsHovering] = useState(false)
  const [isScrambling, setIsScrambling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameRef = useRef(0)

  const scramble = useCallback(() => {
    setIsScrambling(true)
    frameRef.current = 0
    const duration = text.length * 3

    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      frameRef.current++

      const progress = frameRef.current / duration
      const revealedLength = Math.floor(progress * text.length)

      const newText = text
        .split("")
        .map((char, i) => {
          if (char === " ") return " "
          if (i < revealedLength) return text[i]
          return CHARS[Math.floor(Math.random() * CHARS.length)]
        })
        .join("")

      setDisplayText(newText)

      if (frameRef.current >= duration) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setDisplayText(text)
        setIsScrambling(false)
      }
    }, 30)
  }, [text])

  const handleMouseEnter = () => {
    setIsHovering(true)
    if (!prefersReduced) scramble()
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
  }

  const handleFocus = () => {
    setIsHovering(true)
    if (!prefersReduced) scramble()
  }

  const handleBlur = () => {
    setIsHovering(false)
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div
      className={`group relative inline-flex flex-col cursor-pointer select-none ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
    >
      <span className={cn("relative font-mono tracking-widest uppercase", textSize)}>
        {displayText.split("").map((char, i) => (
          <span
            key={i}
            className={`inline-block transition-[color,transform] duration-150 ${
              isScrambling && char !== text[i] ? "text-primary scale-110" : "text-foreground"
            }`}
            style={{
              transitionDelay: `${i * 10}ms`,
            }}
          >
            {char}
          </span>
        ))}
      </span>

      {/* Animated underline */}
      <span className="relative h-px w-full mt-2 overflow-hidden">
        <span
          className={`absolute inset-0 bg-foreground transition-transform duration-500 ease-out origin-left ${
            isHovering ? "scale-x-100" : "scale-x-0"
          }`}
        />
        <span className="absolute inset-0 bg-border" />
      </span>

      {/* Subtle glow on hover */}
      <span
        className={`absolute -inset-4 rounded-lg bg-primary/5 transition-opacity duration-300 -z-10 ${
          isHovering ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}

