'use client'

import { useState } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/app/components/ui/context-menu'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bookmark {
  label: string
  url: string
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PROJECTS: Bookmark[] = [
  { label: 'Penguin Mail',       url: 'https://www.penguinmail.app/' },
  { label: 'ARK Experience',     url: 'https://www.funwithark.ca/' },
  { label: 'Bridger',            url: 'https://bridger.atawalk.ca/' },
  { label: 'Stella 56 Diamonds', url: 'https://www.stella56diamonds.com/' },
  { label: 'Playground',         url: 'https://playground.createplus.club/' },
  { label: 'Couples Budget',     url: 'https://couplesbudget.ca/' },
  { label: '75 Creates',         url: 'https://75.createplus.club/' },
  { label: 'KayVee Gems',        url: 'https://kayveegems.com/' },
]

const TOOLS: Bookmark[] = [
  { label: 'Google',  url: 'https://www.google.com/' },
  { label: 'Claude',  url: 'https://claude.ai/' },
  { label: 'ChatGPT', url: 'https://chatgpt.com/' },
]

// ── Style helpers ─────────────────────────────────────────────────────────────

const chicago: React.CSSProperties = {
  fontFamily: 'var(--font-chicago)',
  WebkitFontSmoothing: 'none',
  MozOsxFontSmoothing: 'grayscale',
}

// ── Bookmark tile ─────────────────────────────────────────────────────────────

function BookmarkTile({ label, url }: Bookmark) {
  const [hovered, setHovered] = useState(false)

  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  })()

  const faviconSrc = `https://www.google.com/s2/favicons?domain=${host}&sz=128`

  function openUrl() {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // silently fail — clipboard may be unavailable
    }
  }

  const tileStyle: React.CSSProperties = {
    border: hovered ? '1px solid #fff' : '1px solid #000',
    background: hovered ? '#000' : '#fff',
    color: hovered ? '#fff' : '#000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 6px 6px',
    cursor: 'pointer',
    userSelect: 'none',
    gap: 6,
    minWidth: 0,
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          style={tileStyle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={openUrl}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openUrl() }}
        >
          {/* Favicon */}
          <img
            src={faviconSrc}
            alt=""
            width={48}
            height={48}
            style={{
              width: 48,
              height: 48,
              imageRendering: 'pixelated',
              display: 'block',
              filter: hovered ? 'invert(1)' : 'none',
              flexShrink: 0,
            }}
          />

          {/* Label */}
          <span
            style={{
              ...chicago,
              fontSize: 12,
              textAlign: 'center',
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}
          >
            {label}
          </span>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onSelect={openUrl}>
          Open in New Tab
        </ContextMenuItem>
        <ContextMenuItem onSelect={copyLink}>
          Copy Link
        </ContextMenuItem>
        <ContextMenuItem disabled style={{ opacity: 0.4, cursor: 'default' }}>
          Get Info
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled style={{ opacity: 0.4, cursor: 'default' }}>
          Bookmark This
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ── Bookmark section ──────────────────────────────────────────────────────────

function BookmarkSection({ title, bookmarks }: { title: string; bookmarks: Bookmark[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          ...chicago,
          fontSize: 13,
          fontWeight: 'bold',
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: 1,
          borderBottom: '1px solid #000',
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
          gap: 12,
        }}
      >
        {bookmarks.map((bm) => (
          <BookmarkTile key={bm.url} label={bm.label} url={bm.url} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CurlyBrowserApp() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fff',
        minHeight: 0,
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderBottom: '1px solid #000',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        {/* Back button — disabled */}
        <button
          disabled
          style={{
            ...chicago,
            fontSize: 14,
            color: '#aaa',
            background: 'none',
            border: 'none',
            cursor: 'default',
            padding: '0 2px',
            lineHeight: 1,
          }}
          aria-label="Back (disabled)"
        >
          ◀
        </button>

        {/* Forward button — disabled */}
        <button
          disabled
          style={{
            ...chicago,
            fontSize: 14,
            color: '#aaa',
            background: 'none',
            border: 'none',
            cursor: 'default',
            padding: '0 2px',
            lineHeight: 1,
          }}
          aria-label="Forward (disabled)"
        >
          ▶
        </button>

        {/* Home — decorative */}
        <span
          style={{
            ...chicago,
            fontSize: 13,
            color: '#000',
            padding: '0 4px',
            userSelect: 'none',
          }}
          title="Home"
          aria-label="Home"
        >
          ⌂
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Address bar — read-only */}
        <div
          style={{
            ...chicago,
            fontSize: 12,
            color: '#555',
            background: '#f5f5f5',
            border: '1px solid #aaa',
            padding: '2px 8px',
            minWidth: 200,
            maxWidth: 340,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
          title="file:///Curly OS/Home.html"
        >
          file:///Curly OS/Home.html
        </div>
      </div>

      {/* ── Info banner ──────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFF8DC',
          borderBottom: '1px solid #000',
          borderTop: '1px solid #000',
          padding: '6px 10px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            ...chicago,
            fontSize: 12,
            color: '#000',
            display: 'block',
          }}
        >
          ⓘ Curly Browser uses iframes, which most sites block for security. Links open in your real browser instead.
        </span>
      </div>

      {/* ── Bookmarks home page ───────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          background: '#fff',
          minHeight: 0,
        }}
      >
        {/* Heading */}
        <div
          style={{
            ...chicago,
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Bookmarks
        </div>

        <BookmarkSection title="Projects" bookmarks={PROJECTS} />
        <BookmarkSection title="Tools" bookmarks={TOOLS} />
      </div>
    </div>
  )
}
