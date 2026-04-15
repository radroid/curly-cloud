'use client'

import { useRef, type RefObject } from 'react'
import { useWindowManager } from './window-manager'
import type { AppDefinition } from './app-registry'

type DesktopIconProps = {
  app: AppDefinition
  containerRef: RefObject<HTMLDivElement | null>
  large?: boolean
}

export function DesktopIcon({ app, containerRef, large = false }: DesktopIconProps) {
  const { selectedIconId, selectIcon, openApp } = useWindowManager()
  const iconRef = useRef<HTMLButtonElement>(null)
  const selected = selectedIconId === app.id

  const handleDoubleClick = () => {
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
    <button
      ref={iconRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        selectIcon(app.id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        handleDoubleClick()
      }}
      style={{
        appearance: 'none',
        background: 'transparent',
        border: 'none',
        padding: large ? '6px 4px' : '4px 2px',
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: large ? 4 : 2,
        width: large ? 96 : 82,
        fontFamily: 'var(--font-chicago)',
        color: '#000',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: large ? 44 : 30,
          height: large ? 44 : 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: selected ? 'invert(1)' : undefined,
          imageRendering: 'pixelated',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={app.iconSrc}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
          }}
        />
      </div>
      <span
        style={{
          fontSize: large ? 12 : 10,
          lineHeight: 1.1,
          textAlign: 'center',
          padding: '1px 4px',
          background: selected ? '#000' : 'transparent',
          color: selected ? '#fff' : '#000',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
        }}
      >
        {app.name}
      </span>
    </button>
  )
}
