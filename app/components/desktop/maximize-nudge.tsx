'use client'

import { useEffect, useState } from 'react'
import { useWindowManager } from './window-manager'

const STORAGE_KEY = 'maximizeNudgeDismissed'

type MaximizeNudgeProps = {
  isMaximized: boolean
  onToggleMaximize: () => void
  prefersReduced: boolean
}

export function MaximizeNudge({
  isMaximized,
  onToggleMaximize,
  prefersReduced,
}: MaximizeNudgeProps) {
  const { hasOpenedAnyApp } = useWindowManager()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Read the persisted dismissed flag once
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(STORAGE_KEY) === '1') setDismissed(true)
  }, [])

  // Show the first time an app is opened (if not already dismissed and not maximized)
  useEffect(() => {
    if (!hasOpenedAnyApp || dismissed || isMaximized) return
    const t = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(t)
  }, [hasOpenedAnyApp, dismissed, isMaximized])

  // Auto-hide when user enters maximize mode
  useEffect(() => {
    if (isMaximized && visible) handleDismiss()
  }, [isMaximized, visible])

  const handleDismiss = () => {
    setDismissed(true)
    setVisible(false)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, '1')
    }
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Use full screen"
      style={{
        position: 'absolute', bottom: 20, left: 20, maxWidth: 220, zIndex: 9998,
        background: '#fff', border: '1px solid #000', boxShadow: '2px 2px 0 #000',
        padding: '10px 12px', fontFamily: 'var(--font-chicago)', fontSize: 11, color: '#000',
        display: 'flex', flexDirection: 'column', gap: 8,
        animation: prefersReduced ? undefined : 'fadeIn 0.3s ease',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: 11 }}>Tip</div>
      <div style={{ lineHeight: 1.35 }}>
        Use Full Screen for more room to work. Click the small square on the
        iMac chin.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button
          type="button"
          onClick={handleDismiss}
          style={pillBtnStyle}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => {
            handleDismiss()
            onToggleMaximize()
          }}
          style={{ ...pillBtnStyle, background: '#000', color: '#fff' }}
        >
          Go Full Screen
        </button>
      </div>
    </div>
  )
}

const pillBtnStyle: React.CSSProperties = {
  appearance: 'none',
  fontFamily: 'var(--font-chicago)',
  fontSize: 10,
  border: '1px solid #000',
  background: '#fff',
  padding: '3px 8px',
  cursor: 'pointer',
  borderRadius: 10,
}
