'use client'

import { useEffect, useRef } from 'react'
import { MenuBar } from '../menu-bar'
import { WindowManagerProvider, useWindowManager } from './window-manager'
import { DesktopIcon } from './desktop-icon'
import { Window } from './window'
import { APP_MAP, APP_REGISTRY } from './app-registry'
import { MaximizeNudge } from './maximize-nudge'
import { prefetchSpotify } from '../apps/music'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/app/components/ui/context-menu'

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
  const trashApp = APP_MAP['trash']

  // Prefetch Spotify data so the Music app loads instantly when opened
  useEffect(() => { prefetchSpotify() }, [])

  const pad = isMaximized ? 14 : 8
  return (
    <div
      style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative',
        animation: prefersReduced ? undefined : 'fadeIn 0.4s ease',
      }}
    >
      <MenuBar />

      {/* Desktop surface */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            onMouseDown={(e) => {
              // Click on bare desktop deselects the icon
              if (e.target === e.currentTarget) selectIcon(null)
            }}
            style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}
          >
        {/* Icon grid — top-right corner, 2-column grid so all 8 apps fit */}
        <div
          style={{
            position: 'absolute', top: pad, right: pad, zIndex: 0,
            display: 'grid', gridTemplateColumns: 'repeat(2, auto)',
            gap: isMaximized ? '6px' : '2px',
          }}
        >
          {APP_REGISTRY.filter((a) => a.id !== 'trash').map((app) => (
            <DesktopIcon key={app.id} app={app} containerRef={containerRef} large={isMaximized} />
          ))}
        </div>

        {/* Trash — bottom-right, interactive */}
        {trashApp && (
          <div style={{ position: 'absolute', bottom: pad, right: pad, zIndex: 0 }}>
            <DesktopIcon app={trashApp} containerRef={containerRef} large={isMaximized} />
          </div>
        )}

        {/* Windows layer */}
        {Object.values(windows).map((w) => {
          const app = APP_REGISTRY.find((a) => a.id === w.appId)
          // Render both registry apps and dynamic windows (e.g. Finder previews)
          if (!app && !w.content) return null
          return (
            <Window key={w.appId} windowId={w.appId} app={app} containerRef={containerRef} prefersReduced={prefersReduced} />
          )
        })}

        <MaximizeNudge isMaximized={isMaximized} onToggleMaximize={onToggleMaximize} prefersReduced={prefersReduced} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Curly OS</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={onToggleMaximize}>{isMaximized ? 'Restore Screen' : 'Go Full Screen'}</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled>Clean Up Desktop</ContextMenuItem>
          <ContextMenuItem disabled>Change Wallpaper</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled>About This Macintosh…</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
