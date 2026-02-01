'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TextScramble } from '@/app/components/ui/text-scramble'

const navItems = {
  '/': {
    name: 'home',
  },
  '/history': {
    name: 'history',
  },
  '/blog': {
    name: 'thinking',
  },
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Consider "scrolled" when user has scrolled more than 100px
      setScrolled(window.scrollY > 10)
    }

    // Check initial scroll position
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className="fixed left-0 right-0 z-50 py-3 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'rgb(var(--background) / 0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(8px)' : 'none',
        top: scrolled ? '0px' : '100px',
      }}
      id="nav"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-row items-center">
        <div className="flex flex-row items-center gap-6 sm:gap-8">
          {Object.entries(navItems).map(([path, { name }]) => {
            return (
              <Link
                key={path}
                href={path}
                className="flex align-middle relative py-1"
              >
                <TextScramble text={name} textSize="text-sm" />
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
