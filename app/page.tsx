'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/app/lib/use-reduced-motion'
import { IMacG3Frame } from '@/app/components/imac-frame'
import { CRTScreen } from '@/app/components/crt-screen'
import { BootScreen } from '@/app/components/boot-screen'
import { WelcomeScreen } from '@/app/components/welcome-screen'
import { Desktop } from '@/app/components/desktop/desktop'
import { SIZING } from '@/app/components/types'
import type { ScreenPhase } from '@/app/components/types'

const WELCOME_HOLD_MS = 2600

export default function Page() {
  const prefersReduced = useReducedMotion()
  const hasBooted = typeof window !== 'undefined' && sessionStorage.getItem('hasBooted') === '1'
  const skipBoot = prefersReduced || hasBooted
  const [phase, setPhase] = useState<ScreenPhase>(skipBoot ? 'welcome' : 'off')
  const [bootFadeOut, setBootFadeOut] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [sizeReady, setSizeReady] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

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

  // After the intro scale animation completes, drop the transform entirely.
  // A persistent `transform: scale(1)` establishes a containing block that
  // traps `position: fixed` descendants — which breaks maximize mode.
  useEffect(() => {
    if (!animateIn || introDone) return
    const t = setTimeout(() => setIntroDone(true), prefersReduced ? 0 : 700)
    return () => clearTimeout(t)
  }, [animateIn, introDone, prefersReduced])

  // Phase state machine — boot sequence
  useEffect(() => {
    if (skipBoot) { setPhase('welcome'); return }
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

  // Welcome → desktop auto-advance (desktop viewports only)
  useEffect(() => {
    if (phase !== 'welcome' || !isDesktop) return
    const t = setTimeout(() => setPhase('desktop'), WELCOME_HOLD_MS)
    return () => clearTimeout(t)
  }, [phase, isDesktop])

  // Drop maximize if the viewport narrows back to mobile mid-session
  useEffect(() => {
    if (!isDesktop && isMaximized) setIsMaximized(false)
  }, [isDesktop, isMaximized])

  const s = isDesktop ? SIZING.desktop : SIZING.mobile
  const screenIsOn = phase === 'welcome' || phase === 'desktop'
  const toggleMaximize = isDesktop && screenIsOn ? () => setIsMaximized((v) => !v) : undefined

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, background: '#1a1a1a',
        padding: isDesktop || isMaximized ? 0 : '0 0 40px',
        position: 'relative',
      }}
    >
      {sizeReady && (
        <div
          style={{
            width: '100%', display: 'flex', justifyContent: 'center',
            transform: introDone ? undefined : animateIn ? 'scale(1)' : 'scale(0)',
            opacity: introDone ? undefined : animateIn ? 1 : 0,
            transition: introDone || prefersReduced ? undefined : 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
            willChange: introDone ? undefined : 'transform, opacity',
          }}
        >
          <IMacG3Frame
            maxWidth={s.maxWidth}
            isMaximized={isMaximized}
            onToggleMaximize={toggleMaximize}
            animateMaximize={!prefersReduced}
          >
            <CRTScreen
              phase={phase}
              isMaximized={isMaximized}
              animateMaximize={!prefersReduced}
            >
              {phase === 'boot' && (
                <BootScreen
                  fadeOut={bootFadeOut}
                  iconSize={s.macIconSize}
                />
              )}
              {phase === 'welcome' && <WelcomeScreen isDesktop={isDesktop} />}
              {phase === 'desktop' && toggleMaximize && (
                <Desktop
                  prefersReduced={prefersReduced}
                  isMaximized={isMaximized}
                  onToggleMaximize={toggleMaximize}
                />
              )}
            </CRTScreen>
          </IMacG3Frame>
        </div>
      )}

    </div>
  )
}
