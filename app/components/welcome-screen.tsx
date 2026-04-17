import { SIZING } from './types'

export function WelcomeScreen({ isDesktop }: { isDesktop: boolean }) {
  const s = isDesktop ? SIZING.desktop : SIZING.mobile
  const topLogoWidth = s.topCornerLogoWidth

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, animation: 'fadeIn 0.8s ease' }}>
      {/* Welcome dialog */}
      <div
        style={{
          flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: isDesktop ? '24px 20px' : '20px 12px',
        }}
      >
        <div
          style={{
            border: isDesktop ? '3px solid #000' : '2px solid #000', borderRadius: 0, background: '#fff',
            boxShadow: isDesktop ? '4px 4px 0 #000' : '2px 2px 0 #000',
            padding: `${s.dialogPaddingY}px ${s.dialogPaddingX}px`,
            width: isDesktop ? '84%' : '92%', minHeight: isDesktop ? 148 : 88,
          }}
        >
          <div
            style={{
              position: 'relative', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minHeight: isDesktop ? 88 : 52, gap: isDesktop ? 6 : 4,
            }}
          >
            <div style={{ position: 'absolute', left: 0, top: isDesktop ? 2 : 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/top-corner-mac-logo.svg" alt="Macintosh" style={{ width: topLogoWidth, height: 'auto' }} />
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-chicago)', fontSize: s.titleFont, fontWeight: 'bold',
                margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap',
                letterSpacing: isDesktop ? 0.3 : 0.2,
              }}
            >
              Welcome to{' '}
              <span
                style={{
                  position: 'relative', display: 'inline-block',
                  paddingBottom: isDesktop ? s.curlyLogoHeight + 4 : s.curlyLogoHeight + 2,
                }}
              >
                <span style={{ textDecoration: 'line-through' }}>Macintosh</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/mac-os-curly.svg"
                  alt="Mac OS Curly"
                  style={{
                    position: 'absolute', left: '50%', top: isDesktop ? 22 : 14,
                    transform: 'translateX(-50%)', height: s.curlyLogoHeight, width: 'auto',
                  }}
                />
              </span>
              .
            </h1>
          </div>
        </div>
      </div>
    </div>
  )
}
