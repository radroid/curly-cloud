export function IMacG3Frame({
  children,
  maxWidth,
  isMaximized = false,
  onToggleMaximize,
  animateMaximize = true,
}: {
  children: React.ReactNode
  maxWidth: number
  isMaximized?: boolean
  onToggleMaximize?: () => void
  animateMaximize?: boolean
}) {
  const isLarge = maxWidth > 400
  const bodyTransition = animateMaximize
    ? 'opacity 220ms ease, transform 300ms ease, padding 300ms ease, border-radius 300ms ease'
    : undefined
  const chinTransition = animateMaximize
    ? 'opacity 220ms ease, max-height 300ms ease, padding 300ms ease'
    : undefined

  return (
    <div
      style={{
        width: isMaximized ? '100vw' : isLarge ? '88%' : '100%',
        maxWidth: isMaximized ? 'none' : maxWidth,
        height: isMaximized ? '100vh' : undefined,
        ...(isMaximized && { position: 'fixed', top: 0, left: 0, zIndex: 50 }),
      }}
    >
      {/* Main body */}
      <div
        style={{
          background: isMaximized ? '#000' : 'linear-gradient(165deg, #7EE8DB 0%, #3FC8BC 25%, #2AADA3 50%, #1E9B91 75%, #178E85 100%)',
          borderRadius: isMaximized ? 0 : isLarge ? '28px 28px 12px 12px' : '24px 24px 10px 10px',
          padding: isMaximized ? 0 : isLarge ? '20px 20px 0' : '10px 10px 0',
          boxShadow: isMaximized ? 'none' : '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
          border: isMaximized ? 'none' : '1px solid rgba(0,0,0,0.12)',
          transition: bodyTransition,
          ...(isMaximized && { height: '100%', display: 'flex', flexDirection: 'column' }),
        }}
      >
        {/* Screen bezel */}
        <div
          style={{
            background: isMaximized ? 'transparent' : 'linear-gradient(180deg, #2d2d2d, #1a1a1a)',
            borderRadius: isMaximized ? 0 : isLarge ? '12px 12px 8px 8px' : '10px 10px 6px 6px',
            padding: isMaximized ? 0 : isLarge ? '12px 12px 10px' : '6px 6px 5px',
            transition: bodyTransition,
            ...(isMaximized && { flex: 1, minHeight: 0, display: 'flex' }),
          }}
        >
          {children}
        </div>

        {/* Chin */}
        <div
          style={{
            padding: isMaximized ? 0 : isLarge ? '14px 0 20px' : '12px 0 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            maxHeight: isMaximized ? 0 : 200, opacity: isMaximized ? 0 : 1,
            overflow: 'hidden', pointerEvents: isMaximized ? 'none' : 'auto',
            transition: chinTransition,
          }}
        >
          {/* CD slot doubles as the maximize toggle. Always rendered so the
             chin height doesn't shift between boot → welcome → desktop. */}
          <button
            type="button"
            onClick={onToggleMaximize}
            disabled={!onToggleMaximize}
            aria-label={isMaximized ? 'Restore screen' : 'Maximize screen'}
            aria-hidden={!onToggleMaximize}
            tabIndex={onToggleMaximize ? 0 : -1}
            style={{
              appearance: 'none', border: 'none', padding: 0,
              width: '45%', height: isLarge ? 5 : 4,
              background: 'rgba(0,0,0,0.22)', borderRadius: 3,
              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.12)',
              cursor: onToggleMaximize ? 'pointer' : 'default',
              opacity: onToggleMaximize ? 1 : 0.55,
              transition: 'opacity 150ms ease, height 150ms ease, box-shadow 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (onToggleMaximize) e.currentTarget.style.boxShadow = 'inset 0 1px 1px rgba(0,0,0,0.5), 0 0 6px rgba(255,255,255,0.35)'
            }}
            onMouseLeave={(e) => {
              if (onToggleMaximize) e.currentTarget.style.boxShadow = 'inset 0 1px 1px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.12)'
            }}
          />
        </div>
      </div>

      {/* Stand */}
      <div
        style={{
          width: '35%', margin: '0 auto', height: isMaximized ? 0 : isLarge ? 8 : 6,
          background: 'linear-gradient(180deg, #c0c0c0, #a0a0a0)',
          borderRadius: '0 0 4px 4px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          opacity: isMaximized ? 0 : 1, transition: bodyTransition,
        }}
      />

      {/* Floating restore button (visible only when maximized) */}
      {isMaximized && onToggleMaximize && (
        <button
          type="button"
          onClick={onToggleMaximize}
          aria-label="Restore screen"
          style={{
            position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
            appearance: 'none', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: 3, padding: '6px 10px', cursor: 'pointer',
            color: '#fff', fontFamily: 'var(--font-chicago)', fontSize: 11, letterSpacing: 0.5,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ display: 'block', width: 10, height: 6, border: '1px solid rgba(255,255,255,0.9)', borderRadius: 1 }} />
          Restore
        </button>
      )}
    </div>
  )
}
