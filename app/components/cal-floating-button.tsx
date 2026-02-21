"use client"

import { getCalApi } from "@calcom/embed-react"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { MessageCircle } from "lucide-react"
import { useReducedMotion } from "@/app/lib/use-reduced-motion"

export function CalFloatingButton() {
  const prefersReduced = useReducedMotion()
  const [isHovered, setIsHovered] = useState(false)
  const [colors, setColors] = useState({
    foreground: "15, 23, 42",
    background: "255, 255, 255",
    primary: "245, 158, 11"
  })

  useEffect(() => {
    // Function to get current CSS variable values
    const updateColors = () => {
      if (typeof window !== 'undefined') {
        const root = document.documentElement
        const style = getComputedStyle(root)

        setColors({
          foreground: style.getPropertyValue('--foreground').trim(),
          background: style.getPropertyValue('--background').trim(),
          primary: style.getPropertyValue('--primary').trim()
        })
      }
    }

    // Update colors initially
    updateColors()

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateColors()
        }
      })
    })

    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      })
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: "problem-ranter" })

      cal("ui", {
        hideEventTypeDetails: false,
        layout: "month_view",
        styles: {
          branding: {
            brandColor: `rgb(${colors.primary})`
          }
        },
        cssVarsPerTheme: {
          light: {
            "cal-brand": `rgb(${colors.primary})`,
            "cal-bg": `rgb(${colors.background})`,
            "cal-text": `rgb(${colors.foreground})`,
          },
          dark: {
            "cal-brand": `rgb(${colors.primary})`,
            "cal-bg": `rgb(${colors.background})`,
            "cal-text": `rgb(${colors.foreground})`,
          }
        }
      })
    })()
  }, [colors])

  const handleClick = async () => {
    const cal = await getCalApi({ namespace: "problem-ranter" })
    cal("modal", {
      calLink: "createclub/problem-ranter",
      config: {
        layout: "month_view"
      }
    })
  }

  return (
    <div className="fixed right-4 z-[30]" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <motion.button
        onClick={handleClick}
        aria-label="Schedule a call"
        initial={{ width: 48, height: 48 }}
        whileHover={prefersReduced ? undefined : { width: 140 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.3 }}
        className="flex items-center justify-center overflow-hidden relative shadow-lg cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        style={{
          borderRadius: 24,
          backgroundColor: `rgb(${colors.foreground})`,
        }}
      >
        <motion.div
          className="absolute"
          animate={{
            opacity: isHovered ? 0 : 1,
            scale: isHovered ? 0.8 : 1
          }}
          transition={{ duration: 0.2 }}
        >
          <MessageCircle
            size={20}
            style={{ color: `rgb(${colors.background})` }}
          />
        </motion.div>

        <motion.div
          className="w-full flex justify-center items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2, delay: isHovered ? 0.1 : 0 }}
        >
          <span
            className="text-sm font-medium whitespace-nowrap"
            style={{ color: `rgb(${colors.background})` }}
          >
            Let's talk
          </span>
        </motion.div>
      </motion.button>
    </div>
  )
}


