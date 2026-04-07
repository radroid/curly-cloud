import { useEffect, useRef, useState } from 'react'

export function MenuBar({
  fontSize = 12,
  height = 22,
  interactive = true,
}: {
  fontSize?: number
  height?: number
  interactive?: boolean
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!interactive) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [interactive])

  const toggleMenu = (name: string) => {
    if (!interactive) return
    setOpenMenu((prev) => (prev === name ? null : name))
  }

  const handleKeyDown = (e: React.KeyboardEvent, name: string) => {
    if (!interactive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleMenu(name)
    } else if (e.key === 'Escape') {
      setOpenMenu(null)
    }
  }

  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null)

  const menuItemStyle = (name: string) => ({
    cursor: 'default' as const,
    padding: '0 6px',
    background: openMenu === name || (interactive && hoveredMenu === name) ? '#000' : 'transparent',
    color: openMenu === name || (interactive && hoveredMenu === name) ? '#fff' : '#000',
    fontWeight: 'bold' as const,
  })

  const dropdownStyle = {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    background: '#fff',
    border: '2px solid #000',
    boxShadow: '2px 2px 0px #000',
    minWidth: 120,
    zIndex: 60,
    maxWidth: 'calc(100vw - 24px)',
    fontFamily: 'var(--font-chicago)',
    fontSize,
  }

  return (
    <div
      ref={menuRef}
      role="menubar"
      style={{
        height,
        background: '#fff',
        borderBottom: interactive ? '2px solid #000' : '1.5px solid #000',
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        fontFamily: 'var(--font-chicago)',
        fontSize,
        gap: interactive ? 16 : 8,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: fontSize + 2, fontWeight: 'bold', cursor: 'default' }} aria-hidden="true">

      </span>

      {/* File menu */}
      <div style={{ position: 'relative' }}>
        <span
          role="menuitem"
          tabIndex={interactive ? 0 : -1}
          aria-haspopup="true"
          aria-expanded={openMenu === 'file'}
          onClick={() => toggleMenu('file')}
          onKeyDown={(e) => handleKeyDown(e, 'file')}
          onMouseEnter={() => setHoveredMenu('file')}
          onMouseLeave={() => setHoveredMenu(null)}
          style={menuItemStyle('file')}
        >
          File
        </span>
        {interactive && openMenu === 'file' && (
          <div role="menu" style={dropdownStyle}>
            <a
              role="menuitem"
              href="https://x.com/curlycloud__"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '4px 16px',
                color: '#000',
                textDecoration: 'none',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#000'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff'
                e.currentTarget.style.color = '#000'
              }}
            >
              @curlycloud__ ↗
            </a>
          </div>
        )}
      </div>

      {/* Edit menu */}
      <div style={{ position: 'relative' }}>
        <span
          role="menuitem"
          tabIndex={interactive ? 0 : -1}
          aria-haspopup="true"
          aria-expanded={openMenu === 'edit'}
          onClick={() => toggleMenu('edit')}
          onKeyDown={(e) => handleKeyDown(e, 'edit')}
          onMouseEnter={() => setHoveredMenu('edit')}
          onMouseLeave={() => setHoveredMenu(null)}
          style={menuItemStyle('edit')}
        >
          Edit
        </span>
        {interactive && openMenu === 'edit' && (
          <div role="menu" style={dropdownStyle}>
            <div role="menuitem" style={{ padding: '4px 16px', color: '#999', cursor: 'default' }}>
              Coming soon
            </div>
          </div>
        )}
      </div>

      {/* View menu */}
      <div style={{ position: 'relative' }}>
        <span
          role="menuitem"
          tabIndex={interactive ? 0 : -1}
          aria-haspopup="true"
          aria-expanded={openMenu === 'view'}
          onClick={() => toggleMenu('view')}
          onKeyDown={(e) => handleKeyDown(e, 'view')}
          onMouseEnter={() => setHoveredMenu('view')}
          onMouseLeave={() => setHoveredMenu(null)}
          style={menuItemStyle('view')}
        >
          View
        </span>
        {interactive && openMenu === 'view' && (
          <div role="menu" style={dropdownStyle}>
            <div role="menuitem" style={{ padding: '4px 16px', color: '#999', cursor: 'default' }}>
              Coming soon
            </div>
          </div>
        )}
      </div>

      {/* Special menu */}
      <div style={{ position: 'relative' }}>
        <span
          role="menuitem"
          tabIndex={interactive ? 0 : -1}
          aria-haspopup="true"
          aria-expanded={openMenu === 'special'}
          onClick={() => toggleMenu('special')}
          onKeyDown={(e) => handleKeyDown(e, 'special')}
          onMouseEnter={() => setHoveredMenu('special')}
          onMouseLeave={() => setHoveredMenu(null)}
          style={menuItemStyle('special')}
        >
          Special
        </span>
        {interactive && openMenu === 'special' && (
          <div role="menu" style={dropdownStyle}>
            <div role="menuitem" style={{ padding: '4px 16px', color: '#999', cursor: 'default' }}>
              Coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
