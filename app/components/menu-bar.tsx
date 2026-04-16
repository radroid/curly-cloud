'use client'

import { useEffect, useRef, useState } from 'react'
import { useWindowManager } from './desktop/window-manager'
import {
  APP_MAP,
  FINDER_DEFAULT_MENUS,
  type MenuConfig,
  type MenuItem,
} from './desktop/app-registry'

const APPLE_MENU: MenuConfig = {
  label: '',
  items: [
    { label: 'About Curly OS…', disabled: true },
    { type: 'divider' },
    { label: 'v0.1 (1984 Edition)', disabled: true },
  ],
}

type MenuBarProps = {
  fontSize?: number
  height?: number
}

export function MenuBar({ fontSize = 13, height = 24 }: MenuBarProps) {
  const { activeWindowId } = useWindowManager()
  const activeApp = activeWindowId ? APP_MAP[activeWindowId] : null
  const appMenus =
    activeApp && activeApp.menuItems.length > 0 ? activeApp.menuItems : FINDER_DEFAULT_MENUS

  const menus: { key: string; config: MenuConfig }[] = [
    { key: 'apple', config: APPLE_MENU },
    ...appMenus.map((m, i) => ({ key: `${m.label}-${i}`, config: m })),
  ]

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu if the active app changes
  useEffect(() => {
    setOpenMenu(null)
  }, [activeWindowId])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggleMenu = (key: string) => {
    setOpenMenu((prev) => (prev === key ? null : key))
  }

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleMenu(key)
    } else if (e.key === 'Escape') {
      setOpenMenu(null)
    }
  }

  const menuItemStyle = (key: string): React.CSSProperties => {
    const highlighted = openMenu === key || hoveredMenu === key
    return {
      cursor: 'default',
      padding: '0 6px',
      background: highlighted ? '#000' : 'transparent',
      color: highlighted ? '#fff' : '#000',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      height: '100%',
    }
  }

  return (
    <div
      ref={menuRef}
      role="menubar"
      style={{
        height,
        background: '#fff',
        borderBottom: '2px solid #000',
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        fontFamily: 'var(--font-chicago)',
        fontSize,
        gap: 16,
        userSelect: 'none',
        flexShrink: 0,
        position: 'relative',
        zIndex: 9999,
      }}
    >
      {menus.map(({ key, config }) => (
        <div key={key} style={{ position: 'relative', height: '100%' }}>
          <span
            role="menuitem"
            tabIndex={0}
            aria-haspopup="true"
            aria-expanded={openMenu === key}
            onClick={() => toggleMenu(key)}
            onKeyDown={(e) => handleKeyDown(e, key)}
            onMouseEnter={() => setHoveredMenu(key)}
            onMouseLeave={() => setHoveredMenu(null)}
            style={menuItemStyle(key)}
          >
            {key === 'apple' ? <AppleGlyph size={fontSize + 2} inverted={openMenu === 'apple' || hoveredMenu === 'apple'} /> : config.label}
          </span>
          {openMenu === key && (
            <MenuDropdown
              items={config.items}
              fontSize={fontSize}
              onClose={() => setOpenMenu(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function MenuDropdown({
  items,
  fontSize,
  onClose,
}: {
  items: MenuItem[]
  fontSize: number
  onClose: () => void
}) {
  return (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        background: '#fff',
        border: '1px solid #000',
        boxShadow: '2px 2px 0 #000',
        minWidth: 160,
        zIndex: 10000,
        fontFamily: 'var(--font-chicago)',
        fontSize,
        padding: '2px 0',
      }}
    >
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return (
            <div
              key={`d-${i}`}
              style={{ height: 1, background: '#000', margin: '2px 0', opacity: 0.6 }}
            />
          )
        }
        return (
          <button
            key={`${item.label}-${i}`}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              item.action?.()
              onClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              padding: '3px 16px',
              fontFamily: 'var(--font-chicago)',
              fontSize,
              textAlign: 'left',
              color: item.disabled ? '#999' : '#000',
              cursor: item.disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (item.disabled) return
              e.currentTarget.style.background = '#000'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              if (item.disabled) return
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#000'
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span style={{ marginLeft: 16, opacity: 0.6 }}>{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )
}

function AppleGlyph({ size, inverted }: { size: number; inverted: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 16"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        fill={inverted ? '#fff' : '#000'}
        d="M9.5 2.3c.6-.7 1-1.6.9-2.3-.8 0-1.8.5-2.4 1.2-.6.6-1.1 1.6-.9 2.4.9.1 1.8-.5 2.4-1.3zM10.4 4.5c-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2.1 2.5 2 .9-.1 1.3-.6 2.4-.6s1.5.6 2.5.6c1.1 0 1.8-1 2.5-2 .6-.9 1-1.7 1.3-2.8-3.2-1.2-3.6-5.4-.3-7.2z"
      />
    </svg>
  )
}
