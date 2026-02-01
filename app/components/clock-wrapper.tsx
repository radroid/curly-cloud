'use client'

import { OrbitalClock } from './ui/orbital-clock'
import { MobileDigitalClock } from './mobile-digital-clock'
import { useEffect, useState } from 'react'

export function ClockWrapper() {
  const [isVisible, setIsVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640) // sm breakpoint
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    const handleScroll = () => {
      // Only hide clock on desktop (width >= 640px)
      if (window.innerWidth >= 640) {
        const currentScrollY = window.scrollY
        setIsVisible(currentScrollY < 100)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  return (
    <>
      {/* Desktop: Show analog clock */}
      <div
        className={`hidden sm:block fixed top-4 right-2 sm:top-8 sm:right-4 md:right-8 z-[60] transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        <OrbitalClock />
      </div>

      {/* Mobile: Show digital clock */}
      <div className="block sm:hidden">
        <MobileDigitalClock />
      </div>
    </>
  )
}

