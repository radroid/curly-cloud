'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/app/lib/use-reduced-motion'
import { IMacG3Frame } from '@/app/components/imac-frame'
import { CRTScreen } from '@/app/components/crt-screen'
import { BootScreen } from '@/app/components/boot-screen'
import { WelcomeScreen } from '@/app/components/welcome-screen'
import { SIZING } from '@/app/components/types'
import type { ScreenPhase } from '@/app/components/types'

export default function Page() {
  const prefersReduced = useReducedMotion()
  const hasBooted = typeof window !== 'undefined' && sessionStorage.getItem('hasBooted') === '1'
  const skipBoot = prefersReduced || hasBooted
  const [phase, setPhase] = useState<ScreenPhase>(skipBoot ? 'welcome' : 'off')
  const [bootFadeOut, setBootFadeOut] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [sizeReady, setSizeReady] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  // Responsive detection — must resolve before we render the iMac
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mql.matches)
    setSizeReady(true)
    // Trigger the animate-in on the next frame so the initial transform is applied first
    requestAnimationFrame(() => setAnimateIn(true))
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Phase state machine
  useEffect(() => {
    if (skipBoot) {
      setPhase('welcome')
      return
    }

    const timers = [
      setTimeout(() => setPhase('flicker'), 500),
      setTimeout(() => setPhase('boot'), 1200),
      setTimeout(() => setBootFadeOut(true), 5100),
      setTimeout(() => {
        setPhase('welcome')
        setBootFadeOut(false)
        sessionStorage.setItem('hasBooted', '1')
      }, 5700),
    ]

    return () => timers.forEach(clearTimeout)
  }, [skipBoot])

  const s = isDesktop ? SIZING.desktop : SIZING.mobile

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        background: '#1a1a1a',
        padding: isDesktop ? 0 : '0 0 40px',
        position: 'relative' as const,
      }}
    >
      {sizeReady && (
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            transform: animateIn ? 'scale(1)' : 'scale(0)',
            opacity: animateIn ? 1 : 0,
            transition: prefersReduced
              ? 'none'
              : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
            willChange: 'transform, opacity',
          }}
        >
          <IMacG3Frame maxWidth={s.maxWidth}>
            <CRTScreen phase={phase} minHeight={s.screenMinHeight}>
              {phase === 'boot' && (
                <BootScreen
                  isActive
                  fadeOut={bootFadeOut}
                  iconSize={s.macIconSize}
                />
              )}
              {phase === 'welcome' && <WelcomeScreen isDesktop={isDesktop} />}
            </CRTScreen>
          </IMacG3Frame>
        </div>
      )}

      {phase === 'welcome' && (
        <div
          style={{
            fontFamily: 'var(--font-chicago)',
            color: '#666',
            fontSize: isDesktop ? 14 : 11,
            textAlign: 'center',
            letterSpacing: 1,
            animation: 'fadeIn 0.8s ease',
          }}
        >
          UNDER CONSTRUCTION...
          <span
            style={{
              display: 'inline-block',
              width: isDesktop ? 8 : 6,
              height: isDesktop ? 16 : 12,
              background: '#666',
              marginLeft: 2,
              verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
            }}
          />
        </div>
      )}
    </div>
  )
}
