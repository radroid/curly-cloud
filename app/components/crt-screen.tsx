import type { ScreenPhase } from './types'

const DITHERED_BG = `url("data:image/svg+xml,%3Csvg width='2' height='2' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23000000' fill-opacity='0.18'/%3E%3Crect x='1' y='1' width='1' height='1' fill='%23000000' fill-opacity='0.18'/%3E%3C/svg%3E")`

export function CRTScreen({
  phase,
  minHeight,
  isMaximized = false,
  animateMaximize = true,
  children,
}: {
  phase: ScreenPhase
  minHeight: number
  isMaximized?: boolean
  animateMaximize?: boolean
  children: React.ReactNode
}) {
  const showOverlay = phase === 'off' || phase === 'flicker'

  return (
    <div
      style={{
        borderRadius: isMaximized ? 0 : 3,
        overflow: 'hidden',
        position: 'relative',
        aspectRatio: isMaximized ? 'auto' : '4 / 3',
        width: isMaximized ? '100%' : undefined,
        height: isMaximized ? '100%' : undefined,
        display: 'flex',
        flexDirection: 'column',
        background: '#a8a8a8',
        backgroundImage: DITHERED_BG,
        backgroundSize: '2px 2px',
        imageRendering: 'pixelated' as const,
        containerType: 'size',
        transition: animateMaximize ? 'border-radius 300ms ease' : undefined,
      }}
    >
      {/* Content (boot icon or welcome) */}
      {children}

      {/* CRT black overlay — flickers away during turn-on */}
      {showOverlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#0a0a0a',
            zIndex: 1,
            ...(phase === 'flicker'
              ? { animation: 'crtTurnOn 700ms ease-out forwards' }
              : {}),
          }}
        />
      )}
    </div>
  )
}
