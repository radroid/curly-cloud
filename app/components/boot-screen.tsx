import { useEffect } from 'react'

export function BootScreen({ fadeOut, iconSize }: { fadeOut: boolean; iconSize: number }) {
  useEffect(() => {
    const audio = new Audio('/StartupMacI.wav')
    const timer = setTimeout(() => {
      audio.play().catch(() => {})
      navigator.vibrate?.([200, 100, 200])
    }, 1000)
    return () => { clearTimeout(timer); audio.pause() }
  }, [])

  return (
    <div
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: fadeOut ? 0 : 1, transition: 'opacity 0.6s ease',
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
