'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/app/lib/use-reduced-motion'

// ─── Loading Screen (Mac OS System 1 boot — just Happy Mac on gray bg) ──────

function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const prefersReduced = useReducedMotion()
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (prefersReduced) {
      onComplete()
      return
    }
    const timer = setTimeout(() => {
      setFadeOut(true)
      setTimeout(onComplete, 600)
    }, 4500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 80,
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'auto',
        transition: 'opacity 0.6s ease',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mac-icon.svg"
        alt="Happy Macintosh"
        width={48}
        height={48}
        style={{
          filter: 'brightness(1.8) contrast(1.5)',
        }}
      />
    </div>
  )
}

// ─── Mac OS Menu Bar (interactive with dropdowns) ───────────

function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleMenu = (name: string) => {
    setOpenMenu(prev => prev === name ? null : name)
  }

  const menuItemStyle = (name: string) => ({
    cursor: 'default' as const,
    padding: '0 6px',
    background: openMenu === name ? '#000' : 'transparent',
    color: openMenu === name ? '#fff' : '#000',
    fontWeight: 'bold' as const,
  })

  const dropdownStyle = {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    background: '#fff',
    border: '2px solid #000',
    boxShadow: '2px 2px 0px #000',
    minWidth: 160,
    zIndex: 60,
    fontFamily: 'var(--font-chicago)',
    fontSize: 12,
  }

  return (
    <div className="mac-menu-bar" ref={menuRef}>
      <span style={{ fontSize: 14, fontWeight: 'bold', cursor: 'default' }}></span>

      {/* File menu */}
      <div style={{ position: 'relative' }}>
        <span onClick={() => toggleMenu('file')} style={menuItemStyle('file')}>
          File
        </span>
        {openMenu === 'file' && (
          <div style={dropdownStyle}>
            <a
              href="https://x.com/curlycloud__"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', padding: '4px 16px', color: '#000', textDecoration: 'none', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000' }}
            >
              @curlycloud__ ↗
            </a>
          </div>
        )}
      </div>

      {/* Edit menu */}
      <div style={{ position: 'relative' }}>
        <span onClick={() => toggleMenu('edit')} style={menuItemStyle('edit')}>
          Edit
        </span>
        {openMenu === 'edit' && (
          <div style={dropdownStyle}>
            <div style={{ padding: '4px 16px', color: '#999', cursor: 'default' }}>Coming soon</div>
          </div>
        )}
      </div>

      {/* View menu */}
      <div style={{ position: 'relative' }}>
        <span onClick={() => toggleMenu('view')} style={menuItemStyle('view')}>
          View
        </span>
        {openMenu === 'view' && (
          <div style={dropdownStyle}>
            <div style={{ padding: '4px 16px', color: '#999', cursor: 'default' }}>Coming soon</div>
          </div>
        )}
      </div>

      {/* Special menu */}
      <div style={{ position: 'relative' }}>
        <span onClick={() => toggleMenu('special')} style={menuItemStyle('special')}>
          Special
        </span>
        {openMenu === 'special' && (
          <div style={dropdownStyle}>
            <div style={{ padding: '4px 16px', color: '#999', cursor: 'default' }}>Coming soon</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Welcome to Macintosh Screen ────────────────────────────

function WelcomeScreen() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ animation: 'fadeIn 0.8s ease' }}
    >
      <MenuBar />

      <div className="flex-1 flex items-center justify-center px-4" style={{ paddingTop: 22 }}>
        <div
          style={{
            border: '3px solid #000',
            borderRadius: 10,
            background: '#fff',
            boxShadow: '4px 4px 0px #000',
            padding: '28px 40px 32px',
            maxWidth: 560,
            width: '92%',
          }}
        >
          {/* Top row: Mac-with-cord icon on left, "Welcome to Macintosh." centered */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 8 }}>
            <div style={{ flexShrink: 0, marginTop: -4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/top-corner-mac-logo.svg" alt="Macintosh" width={80} height={96} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 80, gap: 12 }}>
              <h1
                style={{
                  fontFamily: 'var(--font-chicago)',
                  fontSize: 22,
                  fontWeight: 'bold',
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: 0.5,
                }}
              >
                Welcome to <s>Macintosh</s>.
              </h1>
              {/* Mac icon + "Mac OS Curly" branding */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mac-os-curly.svg" alt="Mac OS Curly" height={28} style={{ height: 28, width: 'auto' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function Page() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('bootDone') === 'true') {
      setLoaded(true)
    }
  }, [])

  return (
    <>
      {!loaded && (
        <LoadingScreen
          onComplete={() => {
            setLoaded(true)
            sessionStorage.setItem('bootDone', 'true')
          }}
        />
      )}
      {loaded && <WelcomeScreen />}
    </>
  )
}
