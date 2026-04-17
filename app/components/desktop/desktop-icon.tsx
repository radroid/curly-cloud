'use client'

import { forwardRef, useRef, type RefObject } from 'react'
import { useWindowManager } from './window-manager'
import type { AppDefinition } from './app-registry'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/app/components/ui/context-menu'

type DesktopIconProps = {
  app: AppDefinition
  containerRef: RefObject<HTMLDivElement | null>
  large?: boolean
}

export function DesktopIcon({ app, containerRef, large = false }: DesktopIconProps) {
  const { selectedIconId, selectIcon, openApp } = useWindowManager()
  const iconRef = useRef<HTMLButtonElement>(null)
  const selected = selectedIconId === app.id

  const openFromIcon = () => {
    const icon = iconRef.current
    const container = containerRef.current
    if (!icon || !container) {
      openApp(app.id)
      return
    }
    const iconRect = icon.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    openApp(app.id, {
      x: iconRect.left - containerRect.left,
      y: iconRect.top - containerRect.top,
      width: iconRect.width,
      height: iconRect.height,
    })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={() => selectIcon(app.id)}>
        <IconButton
          ref={iconRef}
          app={app}
          large={large}
          selected={selected}
          onSelect={() => selectIcon(app.id)}
          onOpen={openFromIcon}
        />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>{app.name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={openFromIcon}>Open</ContextMenuItem>
        <ContextMenuItem disabled>Get Info</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled>Duplicate</ContextMenuItem>
        <ContextMenuItem disabled>Move to Trash</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

type IconButtonProps = {
  app: AppDefinition
  large: boolean
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { app, large, selected, onSelect, onOpen, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      style={{
        appearance: 'none', background: 'transparent', border: 'none', outline: 'none',
        padding: large ? '7px 4px' : '5px 2px',
        cursor: 'default', userSelect: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: large ? 5 : 3, width: large ? 106 : 90,
        fontFamily: 'var(--font-chicago)', color: '#000',
      }}
    >
      <div
        style={{
          width: large ? 48 : 33, height: large ? 48 : 33,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.iconSrc}
          alt=""
          draggable={false}
          style={{ height: '100%', width: 'auto', imageRendering: 'pixelated' }}
        />
      </div>
      <span
        style={{
          fontSize: large ? 13 : 11, lineHeight: 1.2, textAlign: 'center', padding: '1px 4px',
          background: selected ? '#000' : 'transparent', color: selected ? '#fff' : '#000',
          maxWidth: '100%', whiteSpace: 'normal', wordSpacing: 'normal', overflowWrap: 'normal',
        }}
      >
        {app.name}
      </span>
    </button>
  )
})
