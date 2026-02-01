'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Sunrise, Moon, Stars } from 'lucide-react'

type Theme = 'morning' | 'afternoon' | 'night' | 'starry'

const themes: Theme[] = ['morning', 'afternoon', 'night', 'starry']

const themeConfig = {
  morning: {
    icon: Sunrise,
    label: 'Morning',
    iconColor: 'rgb(251, 191, 36)', // amber-400
  },
  afternoon: {
    icon: Sun,
    label: 'Afternoon',
    iconColor: 'rgb(250, 204, 21)', // yellow-400
  },
  night: {
    icon: Moon,
    label: 'Night',
    iconColor: 'rgb(251, 146, 60)', // orange-400
  },
  starry: {
    icon: Stars,
    label: 'Starry',
    iconColor: 'rgb(167, 139, 250)', // violet-400
  },
}

function getThemeForTime(): Theme {
  const hours = new Date().getHours()
  if (hours >= 6 && hours < 12) return 'morning'
  if (hours >= 12 && hours < 18) return 'afternoon'
  if (hours >= 18 && hours < 24) return 'night'
  return 'starry'
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('morning')
  const [isManual, setIsManual] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-override') as Theme | null
    if (savedTheme && themes.includes(savedTheme)) {
      setCurrentTheme(savedTheme)
      setIsManual(true)
      applyTheme(savedTheme)
    } else {
      const autoTheme = getThemeForTime()
      setCurrentTheme(autoTheme)
      applyTheme(autoTheme)
    }

    // Show tooltip if user hasn't seen it before
    const hasSeenTooltip = localStorage.getItem('theme-tooltip-seen')
    if (!hasSeenTooltip) {
      // Delay showing tooltip so page loads first
      const showTimer = setTimeout(() => {
        setShowTooltip(true)
      }, 1500)

      // Auto-hide after 5 seconds
      const hideTimer = setTimeout(() => {
        setShowTooltip(false)
        localStorage.setItem('theme-tooltip-seen', 'true')
      }, 6500)

      return () => {
        clearTimeout(showTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [])

  // Handle auto theme updates when not in manual mode
  useEffect(() => {
    if (isManual) return

    const checkTheme = () => {
      const autoTheme = getThemeForTime()
      if (autoTheme !== currentTheme) {
        setCurrentTheme(autoTheme)
        applyTheme(autoTheme)
      }
    }

    // Check every minute for theme changes
    const interval = setInterval(checkTheme, 60000)
    return () => clearInterval(interval)
  }, [isManual, currentTheme])

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % themes.length
    const nextTheme = themes[nextIndex]

    setCurrentTheme(nextTheme)
    setIsManual(true)
    applyTheme(nextTheme)
    localStorage.setItem('theme-override', nextTheme)

    // Hide tooltip when user interacts
    if (showTooltip) {
      setShowTooltip(false)
      localStorage.setItem('theme-tooltip-seen', 'true')
    }
  }

  const resetToAuto = () => {
    localStorage.removeItem('theme-override')
    setIsManual(false)
    const autoTheme = getThemeForTime()
    setCurrentTheme(autoTheme)
    applyTheme(autoTheme)
  }

  const dismissTooltip = () => {
    setShowTooltip(false)
    localStorage.setItem('theme-tooltip-seen', 'true')
  }

  const config = themeConfig[currentTheme]
  const IconComponent = config.icon

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 left-14 whitespace-nowrap px-3 py-2 rounded-lg shadow-lg cursor-pointer"
            style={{
              backgroundColor: 'rgb(var(--card))',
              border: '1px solid rgb(var(--border))',
            }}
            onClick={dismissTooltip}
          >
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
              Click to switch themes
            </p>
            <div
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2"
              style={{ backgroundColor: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderTop: 'none', borderRight: 'none' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={cycleTheme}
        onDoubleClick={resetToAuto}
        className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shadow-lg"
        style={{
          backgroundColor: 'rgb(var(--card))',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title={`${config.label} theme — Click to change, double-click for auto`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTheme}
            initial={{ rotate: -180, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 180, opacity: 0, scale: 0.5 }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            <IconComponent
              size={24}
              style={{ color: config.iconColor }}
              strokeWidth={2}
            />
          </motion.div>
        </AnimatePresence>

      </motion.button>
    </div>
  )
}
