'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
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
  const rafRef = useRef(0)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 20)
      })
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <nav
      className="fixed left-0 right-0 z-50 transition-all duration-500 ease-out"
      style={{
        top: scrolled ? '0px' : '16px',
        padding: scrolled ? '0' : '0 16px',
      }}
      id="nav"
    >
      <div
        className="transition-all duration-500 ease-out"
        style={{
          backgroundColor: scrolled
            ? 'rgb(var(--background) / 0.85)'
            : 'rgb(var(--card) / 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: scrolled ? '0' : '12px',
          maxWidth: scrolled ? '100%' : 'fit-content',
          margin: '0 auto',
          borderBottom: scrolled ? '1px solid rgb(var(--border) / 0.5)' : 'none',
          border: scrolled ? 'none' : '1px solid rgb(var(--border) / 0.3)',
          boxShadow: scrolled
            ? 'none'
            : '0 4px 24px rgb(var(--foreground) / 0.04)',
        }}
      >
        <div className="flex flex-row items-center justify-center gap-1 py-2 px-2">
          {Object.entries(navItems).map(([path, { name }]) => {
            const isActive = pathname === path
            return (
              <Link
                key={path}
                href={path}
                className="relative py-2 px-4 rounded-lg"
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg"
                    style={{ backgroundColor: 'rgb(var(--primary) / 0.1)' }}
                    transition={{ type: 'spring', stiffness: 250, damping: 50 }}
                  />
                )}
                <span className="relative z-10">
                  <TextScramble
                    text={name}
                    textSize="text-xs"
                  />
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
