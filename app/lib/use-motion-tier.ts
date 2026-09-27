'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { applyTier, currentTier, type MotionTier } from './motion'

function subscribe(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-tier-auto'] })
  return () => mo.disconnect()
}

const isAuto = (): boolean => document.documentElement.hasAttribute('data-tier-auto')

/**
 * The page's render tier (see app/lib/motion.ts). Renders `saver` on the server and during
 * hydration, so server HTML is always the static version; the real tier arrives right after.
 */
export function useMotionTier(): {
  tier: MotionTier
  /** True when the tier was picked automatically rather than by the visitor. */
  auto: boolean
  setTier: (tier: MotionTier, opts?: { persist?: boolean }) => void
} {
  const tier = useSyncExternalStore(subscribe, currentTier, () => 'saver' as const)
  const auto = useSyncExternalStore(subscribe, isAuto, () => true)
  const setTier = useCallback((t: MotionTier, opts?: { persist?: boolean }) => applyTier(t, opts), [])
  return { tier, auto, setTier }
}
