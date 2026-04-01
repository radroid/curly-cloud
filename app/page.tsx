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
  const [phase, setPhase] = useState<ScreenPhase>('off')
  const [bootFadeOut, setBootFadeOut] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  // Responsive detection
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Phase state machine
  useEffect(() => {
    if (prefersReduced) {
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
      }, 5700),
    ]

    return () => timers.forEach(clearTimeout)
  }, [prefersReduced])

  const s = isDesktop ? SIZING.desktop : SIZING.mobile

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a1a',
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
  )
}
