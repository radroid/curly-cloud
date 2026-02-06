'use client'

import dynamic from 'next/dynamic'

export const LazyClockWrapper = dynamic(
  () => import('./clock-wrapper').then(mod => mod.ClockWrapper),
  { ssr: false }
)

export const LazyMouseFollowingEyes = dynamic(
  () => import('./ui/mouse-following-eyes').then(mod => mod.MouseFollowingEyes),
  { ssr: false }
)

export const LazyCalFloatingButton = dynamic(
  () => import('./cal-floating-button').then(mod => mod.CalFloatingButton),
  { ssr: false }
)
