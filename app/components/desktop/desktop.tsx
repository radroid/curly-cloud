'use client'

import { useRef } from 'react'
import { MenuBar } from '../menu-bar'
import { WindowManagerProvider, useWindowManager } from './window-manager'
import { DesktopIcon } from './desktop-icon'
import { Window } from './window'
import { APP_REGISTRY } from './app-registry'
import { MaximizeNudge } from './maximize-nudge'

type DesktopProps = {
  prefersReduced: boolean
  isMaximized: boolean
  onToggleMaximize: () => void
}

export function Desktop(props: DesktopProps) {
  return (
    <WindowManagerProvider>
      <DesktopInner {...props} />
    </WindowManagerProvider>
  )
}

function DesktopInner({ prefersReduced, isMaximized, onToggleMaximize }: DesktopProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { windows, selectIcon } = useWindowManager()

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        animation: prefersReduced ? undefined : 'fadeIn 0.4s ease',
      }}
    >
      <MenuBar />

      {/* Desktop surface */}
      <div
        ref={containerRef}
        onMouseDown={(e) => {
          // Click on bare desktop deselects the icon
          if (e.target === e.currentTarget) selectIcon(null)
        }}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Icon grid — top-right corner, 2-column grid so all 8 fit */}
        <div
          style={{
            position: 'absolute',
            top: isMaximized ? 14 : 8,
            right: isMaximized ? 14 : 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, auto)',
            gap: isMaximized ? '6px 6px' : '2px 2px',
            zIndex: 0,
          }}
        >
          {APP_REGISTRY.map((app) => (
            <DesktopIcon
              key={app.id}
              app={app}
              containerRef={containerRef}
              large={isMaximized}
            />
          ))}
        </div>

        {/* Decorative Trash — bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: isMaximized ? 14 : 8,
            right: isMaximized ? 14 : 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: isMaximized ? 4 : 2,
            fontFamily: 'var(--font-chicago)',
            fontSize: isMaximized ? 12 : 10,
            color: '#000',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/app-icons/trash.svg"
            alt=""
            draggable={false}
            style={{
              width: isMaximized ? 44 : 30,
              height: isMaximized ? 44 : 30,
              imageRendering: 'pixelated',
              objectFit: 'contain',
            }}
          />
          <span
            style={{
              padding: '1px 4px',
              background: 'transparent',
            }}
          >
            Trash
          </span>
        </div>

        {/* Windows layer */}
        {Object.values(windows).map((w) => {
          const app = APP_REGISTRY.find((a) => a.id === w.appId)
          if (!app) return null
          return (
            <Window
              key={app.id}
              app={app}
              containerRef={containerRef}
              prefersReduced={prefersReduced}
            />
          )
        })}

        <MaximizeNudge
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          prefersReduced={prefersReduced}
        />
      </div>
    </div>
  )
}
