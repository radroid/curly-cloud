import { useEffect, useRef } from 'react'

export function BootScreen({
  isActive,
  fadeOut,
  iconSize,
}: {
  isActive: boolean
  fadeOut: boolean
  iconSize: number
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    const audio = new Audio('/StartupMacI.wav')
    audioRef.current = audio

    const timer = setTimeout(() => {
      audio.play().catch(() => {})
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200])
      }
    }, 1000) // 1s after boot phase starts

    return () => {
      clearTimeout(timer)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [isActive])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mac-icon.svg"
        alt="Happy Macintosh"
        width={iconSize}
        height={iconSize}
        style={{ filter: 'brightness(1.8) contrast(1.5)' }}
      />
    </div>
  )
}
