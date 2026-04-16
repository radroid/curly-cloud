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

type OpenMode = 'tab' | 'embed'

interface Bookmark {
  label: string
  url: string
  openMode: OpenMode
}

type View =
  | { mode: 'home' }
  | { mode: 'embed'; url: string; label: string }

// ── Data ──────────────────────────────────────────────────────────────────────
// Projects open in a real browser tab (iframes would be blocked anyway).
// Tools open inside the Curly Browser window — real iframes will be blocked
// by Google/Claude/ChatGPT's frame-ancestors policy, so we show a fallback
// banner under the iframe pointing users at the real browser.

const PROJECTS: Bookmark[] = [
  { label: 'Penguin Mail',       url: 'https://www.penguinmail.app/',       openMode: 'tab' },
  { label: 'ARK Experience',     url: 'https://www.funwithark.ca/',         openMode: 'tab' },
  { label: 'Bridger',            url: 'https://bridger.atawalk.ca/',        openMode: 'tab' },
  { label: 'Stella 56 Diamonds', url: 'https://www.stella56diamonds.com/',  openMode: 'tab' },
  { label: 'Playground',         url: 'https://playground.createplus.club/',openMode: 'tab' },
  { label: 'Couples Budget',     url: 'https://couplesbudget.ca/',          openMode: 'tab' },
  { label: '75 Creates',         url: 'https://75.createplus.club/',        openMode: 'tab' },
  { label: 'KayVee Gems',        url: 'https://kayveegems.com/',            openMode: 'tab' },
]

const TOOLS: Bookmark[] = [
  { label: 'Google',  url: 'https://www.google.com/', openMode: 'embed' },
  { label: 'Claude',  url: 'https://claude.ai/',      openMode: 'embed' },
  { label: 'ChatGPT', url: 'https://chatgpt.com/',    openMode: 'embed' },
]

// ── Style helpers ─────────────────────────────────────────────────────────────

const chicago: React.CSSProperties = {
  fontFamily: 'var(--font-chicago)',
  WebkitFontSmoothing: 'none',
  MozOsxFontSmoothing: 'grayscale',
}

// ── Icon button (SVG from public/browser-icons/) ──────────────────────────────

function IconButton({
  src,
  label,
  disabled,
  onClick,
}: {
  src: string
  label: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        appearance: 'none',
        background: 'none',
        border: 'none',
        padding: '2px 3px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={16}
        height={16}
        style={{
          width: 16,
          height: 16,
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
    </button>
  )
}

// ── Bookmark tile ─────────────────────────────────────────────────────────────

function BookmarkTile({
  bookmark,
  onOpen,
}: {
  bookmark: Bookmark
  onOpen: (bm: Bookmark) => void
}) {
  const [hovered, setHovered] = useState(false)

  const host = (() => {
    try {
      return new URL(bookmark.url).hostname
    } catch {
      return bookmark.url
    }
  })()

  const faviconSrc = `https://www.google.com/s2/favicons?domain=${host}&sz=128`

  function handleOpen() {
    onOpen(bookmark)
  }

  function openInNewTab() {
    // Always opens externally regardless of the bookmark's default openMode.
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookmark.url)
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
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleOpen()
          }}
        >
          {/* Favicon */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
            {bookmark.label}
          </span>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onSelect={openInNewTab}>
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

function BookmarkSection({
  title,
  bookmarks,
  onOpen,
}: {
  title: string
  bookmarks: Bookmark[]
  onOpen: (bm: Bookmark) => void
}) {
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
          <BookmarkTile key={bm.url} bookmark={bm} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

// ── Home view (bookmarks grid) ────────────────────────────────────────────────

function HomeView({ onOpen }: { onOpen: (bm: Bookmark) => void }) {
  return (
    <>
      {/* Info banner — only visible on the home page */}
      <div
        style={{
          background: '#FFF8DC',
          borderBottom: '1px solid #000',
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
          ⓘ Curly Browser uses iframes, which most sites block for security.
          Project links open in your real browser instead.
        </span>
      </div>

      {/* Bookmarks */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          background: '#fff',
          minHeight: 0,
        }}
      >
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

        <BookmarkSection title="Projects" bookmarks={PROJECTS} onOpen={onOpen} />
        <BookmarkSection title="Tools" bookmarks={TOOLS} onOpen={onOpen} />
      </div>
    </>
  )
}

// ── Embed view (iframe + fallback banner) ─────────────────────────────────────

function EmbedView({ url, label }: { url: string; label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        background: '#fff',
      }}
    >
      <iframe
        src={url}
        title={label}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          minHeight: 0,
          background: '#fff',
        }}
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
      {/* Always-visible fallback: most sites set frame-ancestors and the
         iframe above will come up blank. Give the user a direct escape hatch. */}
      <div
        style={{
          background: '#FFF8DC',
          borderTop: '1px solid #000',
          padding: '6px 10px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
        }}
      >
        <span style={{ ...chicago, fontSize: 11, color: '#000' }}>
          ⚠ {label} may block embedding. If the page is blank,
        </span>
        <button
          type="button"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          style={{
            ...chicago,
            fontSize: 11,
            border: '1px solid #000',
            background: '#fff',
            padding: '2px 8px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Open in real browser →
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CurlyBrowserApp() {
  const [view, setView] = useState<View>({ mode: 'home' })

  function openBookmark(bm: Bookmark) {
    if (bm.openMode === 'tab') {
      window.open(bm.url, '_blank', 'noopener,noreferrer')
    } else {
      setView({ mode: 'embed', url: bm.url, label: bm.label })
    }
  }

  function goHome() {
    setView({ mode: 'home' })
  }

  const isHome = view.mode === 'home'
  const currentUrl = isHome
    ? 'file:///Curly OS/Home.html'
    : view.url

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
          gap: 4,
          padding: '4px 8px',
          borderBottom: '1px solid #000',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <IconButton
          src="/browser-icons/back.svg"
          label="Back"
          disabled={isHome}
          onClick={goHome}
        />
        <IconButton
          src="/browser-icons/forward.svg"
          label="Forward"
          disabled
        />
        <IconButton
          src="/browser-icons/home.svg"
          label="Home"
          disabled={isHome}
          onClick={goHome}
        />

        <div style={{ flex: 1 }} />

        {/* Address bar — read-only, reflects current view */}
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
          title={currentUrl}
        >
          {currentUrl}
        </div>
      </div>

      {/* ── Content: home or embed ──────────────────────────────────────── */}
      {isHome ? (
        <HomeView onOpen={openBookmark} />
      ) : (
        <EmbedView url={view.url} label={view.label} />
      )}
    </div>
  )
}
