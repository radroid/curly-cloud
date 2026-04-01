import { MenuBar } from './menu-bar'
import { SIZING } from './types'

export function WelcomeScreen({ isDesktop }: { isDesktop: boolean }) {
  const s = isDesktop ? SIZING.desktop : SIZING.mobile

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        animation: 'fadeIn 0.8s ease',
      }}
    >
      <MenuBar
        fontSize={s.menuBarFont}
        height={s.menuBarHeight}
        interactive
      />

      {/* Welcome dialog */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: isDesktop ? '24px 20px' : '20px 12px',
        }}
      >
        <div
          style={{
            border: isDesktop ? '3px solid #000' : '2px solid #000',
            borderRadius: 0,
            background: '#fff',
            boxShadow: isDesktop ? '4px 4px 0 #000' : '2px 2px 0 #000',
            padding: `${s.dialogPaddingY}px ${s.dialogPaddingX}px`,
            width: '90%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: s.dialogGap,
            }}
          >
            <div style={{ flexShrink: 0, marginTop: isDesktop ? -15 : -8, marginLeft: isDesktop ? -25 : -10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/top-corner-mac-logo.svg"
                alt="Macintosh"
                width={s.macLogoWidth}
                height={s.macLogoHeight}
              />
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: isDesktop ? 4 : 2,
                minHeight: s.macLogoHeight,
              }}
            >
              <h1
                style={{
                  fontFamily: 'var(--font-chicago)',
                  fontSize: s.titleFont,
                  fontWeight: 'bold',
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: isDesktop ? 0.5 : 0.3,
                  whiteSpace: 'nowrap',
                }}
              >
                Welcome to <s>Macintosh</s>.
              </h1>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mac-os-curly.svg"
                alt="Mac OS Curly"
                style={{ height: s.curlyLogoHeight, width: 'auto', alignSelf: 'flex-end' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
