'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../ui/context-menu'

// ─── File system data ───────────────────────────────────────────────────────

type FileEntry = {
  kind: 'file'
  label: string
  path: string   // public-relative, e.g. /cv/Raj_Dholakia_Resume_FullStack.pdf
  ext: string
}

type FolderEntry = {
  kind: 'folder'
  label: string
  id: string
  children: FSEntry[]
}

type FSEntry = FileEntry | FolderEntry

const ROOT_LABEL = 'Macintosh HD'

// Folder icon SVG (drawn inline)
function FolderIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.8)}
      viewBox="0 0 36 29"
      fill="none"
      aria-hidden="true"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {/* tab */}
      <rect x="1" y="4" width="12" height="4" fill="#000" />
      <rect x="2" y="5" width="10" height="3" fill="#fff" />
      {/* body */}
      <rect x="1" y="7" width="34" height="21" fill="#000" />
      <rect x="2" y="8" width="32" height="19" fill="#fff" />
      {/* bottom lines (Mac 1984 horizontal stripes) */}
      <line x1="2" y1="12" x2="34" y2="12" stroke="#000" strokeWidth="1" />
      <line x1="2" y1="16" x2="34" y2="16" stroke="#000" strokeWidth="1" />
      <line x1="2" y1="20" x2="34" y2="20" stroke="#000" strokeWidth="1" />
    </svg>
  )
}

// Generic document icon SVG
function DocIcon({ size = 36, ext }: { size?: number; ext: string }) {
  const label = ext.replace('.', '').toUpperCase().slice(0, 3)
  return (
    <svg
      width={size}
      height={Math.round(size * 1.1)}
      viewBox="0 0 36 40"
      fill="none"
      aria-hidden="true"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {/* dog-ear */}
      <polygon points="0,0 26,0 36,10 36,40 0,40" fill="#fff" stroke="#000" strokeWidth="1.5" />
      <polygon points="26,0 36,10 26,10" fill="#000" />
      {/* extension label */}
      <text
        x="18"
        y="28"
        textAnchor="middle"
        fontSize="8"
        fontFamily="monospace"
        fill="#000"
      >
        {label}
      </text>
    </svg>
  )
}

// Thumbnail preview for image-ish file types inside grid
function FileThumbnail({ entry, size = 36 }: { entry: FileEntry; size?: number }) {
  const img = ['.svg', '.png', '.webp', '.jpg', '.jpeg']
  if (img.includes(entry.ext)) {
    return (
      <img
        src={entry.path}
        alt={entry.label}
        width={size}
        height={size}
        style={{
          objectFit: 'contain',
          imageRendering: 'pixelated',
          display: 'block',
          border: '1px solid #000',
        }}
      />
    )
  }
  return <DocIcon size={size} ext={entry.ext} />
}

// ─── File system tree ────────────────────────────────────────────────────────

const FILE_TREE: FSEntry[] = [
  {
    kind: 'folder',
    label: 'Applications',
    id: 'app-icons',
    children: [
      { kind: 'file', label: 'Browser',       path: '/app-icons/browser.svg',       ext: '.svg' },
      { kind: 'file', label: 'Calculator',    path: '/app-icons/calculator.svg',    ext: '.svg' },
      { kind: 'file', label: 'Control Panel', path: '/app-icons/control-panel.svg', ext: '.svg' },
      { kind: 'file', label: 'Documents',     path: '/app-icons/finder.svg',        ext: '.svg' },
      { kind: 'file', label: 'Journal',       path: '/app-icons/journal.svg',       ext: '.svg' },
      { kind: 'file', label: 'Music',         path: '/app-icons/music.svg',         ext: '.svg' },
      { kind: 'file', label: 'Note Pad',      path: '/app-icons/notepad.svg',       ext: '.svg' },
      { kind: 'file', label: 'Trash',         path: '/app-icons/trash.svg',         ext: '.svg' },
      { kind: 'file', label: 'World Map',     path: '/app-icons/world-map.svg',     ext: '.svg' },
    ],
  },
  {
    kind: 'folder',
    label: 'Documents',
    id: 'cv',
    children: [
      {
        kind: 'file',
        label: 'Resume',
        path: '/cv/Raj_Dholakia_Resume_FullStack.pdf',
        ext: '.pdf',
      },
    ],
  },
  {
    kind: 'folder',
    label: 'Fonts',
    id: 'fonts',
    children: [
      { kind: 'file', label: 'Chicago', path: '/fonts/ChicagoFLF.woff', ext: '.woff' },
    ],
  },
  { kind: 'file', label: 'Apple Logo',       path: '/apple-icon.svg',          ext: '.svg' },
  { kind: 'file', label: 'Mac Icon',         path: '/mac-icon.svg',            ext: '.svg' },
  { kind: 'file', label: 'Curly OS Logo',    path: '/mac-os-curly.svg',        ext: '.svg' },
  { kind: 'file', label: 'Corner Logo',      path: '/top-corner-mac-logo.svg', ext: '.svg' },
  { kind: 'file', label: 'Avatar',           path: '/raj-avatar.webp',         ext: '.webp' },
  { kind: 'file', label: 'World Map',        path: '/worldmap.png',            ext: '.png' },
  { kind: 'file', label: 'Startup Sound',    path: '/StartupMacI.wav',         ext: '.wav' },
]

function countItems(entries: FSEntry[]): number {
  return entries.length
}

// ─── Preview overlay ─────────────────────────────────────────────────────────

type PreviewProps = {
  entry: FileEntry
  onClose: () => void
}

function PreviewOverlay({ entry, onClose }: PreviewProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose()
  }

  const imageExts = ['.svg', '.png', '.webp', '.jpg', '.jpeg']
  const audioExts = ['.wav', '.mp3']
  const fontExts  = ['.woff', '.woff2', '.ttf', '.otf']

  let content: React.ReactNode

  if (imageExts.includes(entry.ext)) {
    content = (
      <img
        src={entry.path}
        alt={entry.label}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
      />
    )
  } else if (entry.ext === '.pdf') {
    content = (
      <iframe
        src={entry.path}
        title={entry.label}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    )
  } else if (audioExts.includes(entry.ext)) {
    content = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          fontFamily: 'var(--font-chicago)',
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 'bold' }}>{entry.label}</div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={entry.path} style={{ fontFamily: 'var(--font-chicago)' }} />
      </div>
    )
  } else if (fontExts.includes(entry.ext)) {
    const fontFaceName = `preview-font-${entry.label.replace(/\s+/g, '-')}`
    content = (
      <div
        style={{
          padding: 16,
          fontFamily: 'var(--font-chicago)',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <style>{`@font-face { font-family: '${fontFaceName}'; src: url('${entry.path}'); }`}</style>
        <div style={{ fontWeight: 'bold' }}>{entry.label}</div>
        <div style={{ fontSize: 11, color: '#555' }}>
          Font file — right-click and choose Download to save.
        </div>
        <div
          style={{
            fontFamily: `'${fontFaceName}', monospace`,
            fontSize: 18,
            marginTop: 8,
            borderTop: '1px solid #000',
            paddingTop: 8,
          }}
        >
          The quick brown fox jumps over the lazy dog.
        </div>
        <div
          style={{
            fontFamily: `'${fontFaceName}', monospace`,
            fontSize: 13,
          }}
        >
          ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
          abcdefghijklmnopqrstuvwxyz<br />
          0123456789
        </div>
      </div>
    )
  } else {
    content = (
      <div
        style={{
          padding: 16,
          fontFamily: 'var(--font-chicago)',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 'bold' }}>{entry.label}</div>
        <div>Preview not available for this file type.</div>
        <div style={{ color: '#555', fontSize: 11 }}>
          Right-click the file and choose Download to save it.
        </div>
      </div>
    )
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '2px solid #000',
          boxShadow: '3px 3px 0 #000',
          width: entry.ext === '.pdf' ? '90%' : '80%',
          height: entry.ext === '.pdf' ? '90%' : 'auto',
          maxHeight: '85%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-chicago)',
        }}
      >
        {/* Preview title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '3px 6px',
            borderBottom: '1px solid #000',
            background: 'repeating-linear-gradient(to bottom, #000 0 1px, #fff 1px 2px)',
            flexShrink: 0,
            height: 18,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 'bold',
              background: '#fff',
              padding: '0 6px',
              fontFamily: 'var(--font-chicago)',
            }}
          >
            {entry.label}
          </span>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            style={{
              appearance: 'none',
              width: 11,
              height: 11,
              background: '#fff',
              border: '1px solid #000',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true" style={{ display: 'block' }}>
              <path d="M2 2 L7 7 M7 2 L2 7" stroke="#000" strokeWidth="1" strokeLinecap="square" />
            </svg>
          </button>
        </div>
        {/* Preview content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: entry.ext === '.pdf' ? 'stretch' : 'center',
            justifyContent: 'center',
            padding: entry.ext === '.pdf' ? 0 : 12,
            minHeight: 0,
          }}
        >
          {content}
        </div>
      </div>
    </div>
  )
}

// ─── Download helper ─────────────────────────────────────────────────────────

function triggerDownload(path: string, filename: string) {
  const a = document.createElement('a')
  a.href = path
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function getFilename(path: string): string {
  return path.split('/').pop() ?? path
}

// ─── Grid item components ────────────────────────────────────────────────────

type GridItemProps = {
  entry: FSEntry
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}

function GridItem({ entry, selected, onSelect, onOpen }: GridItemProps) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickCount = useRef(0)

  const handleClick = () => {
    clickCount.current++
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      if (clickCount.current === 1) {
        onSelect()
      } else if (clickCount.current >= 2) {
        onOpen()
      }
      clickCount.current = 0
    }, 250)
  }

  const isFolder = entry.kind === 'folder'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '6px 4px',
        cursor: 'default',
        userSelect: 'none',
        width: 72,
        outline: 'none',
      }}
    >
      {isFolder
        ? <FolderIcon size={36} />
        : <FileThumbnail entry={entry as FileEntry} size={36} />
      }
      <span
        style={{
          fontFamily: 'var(--font-chicago)',
          fontSize: 10,
          textAlign: 'center',
          lineHeight: 1.2,
          wordBreak: 'break-word',
          maxWidth: 64,
          padding: '1px 3px',
          background: selected ? '#000' : 'transparent',
          color: selected ? '#fff' : '#000',
          outline: selected ? '1px solid #000' : 'none',
        }}
      >
        {entry.label}
      </span>
    </div>
  )
}

// Wrap a GridItem with a context menu based on type
type ContextGridItemProps = {
  entry: FSEntry
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onPreview: ((entry: FileEntry) => void) | null
}

function ContextGridItem({ entry, selected, onSelect, onOpen, onPreview }: ContextGridItemProps) {
  const isFolder = entry.kind === 'folder'

  const handleDownload = () => {
    const file = entry as FileEntry
    triggerDownload(file.path, getFilename(file.path))
  }

  const handleOpen = () => {
    onSelect()
    onOpen()
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div style={{ display: 'inline-block' }}>
          <GridItem
            entry={entry}
            selected={selected}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleOpen}>Open</ContextMenuItem>
        {!isFolder && (
          <>
            <ContextMenuItem onSelect={handleDownload}>Download</ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem disabled>Get Info</ContextMenuItem>
        {!isFolder && (
          <ContextMenuItem disabled>Rename</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ─── Main FinderApp ──────────────────────────────────────────────────────────

export function FinderApp() {
  // Path stack: null = root, string = folder id
  const [pathStack, setPathStack] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<FileEntry | null>(null)

  // Resolve current folder entries
  const currentEntries: FSEntry[] = (() => {
    if (pathStack.length === 0) return FILE_TREE
    // drill into nested folders — for now we have only one level of depth
    const topId = pathStack[0]
    const folder = FILE_TREE.find(
      (e): e is FolderEntry => e.kind === 'folder' && e.id === topId,
    )
    if (!folder) return FILE_TREE
    if (pathStack.length === 1) return folder.children
    // Deeper levels (not needed right now, but handle gracefully)
    return folder.children
  })()

  // Breadcrumb label
  const breadcrumb = (() => {
    if (pathStack.length === 0) return ROOT_LABEL
    const folder = FILE_TREE.find(
      (e): e is FolderEntry => e.kind === 'folder' && e.id === pathStack[0],
    )
    return `${ROOT_LABEL} > ${folder?.label ?? pathStack[0]}`
  })()

  const handleOpen = useCallback((entry: FSEntry) => {
    if (entry.kind === 'folder') {
      setPathStack((prev) => [...prev, entry.id])
      setSelectedId(null)
    } else {
      setPreview(entry)
    }
  }, [])

  const handleBack = useCallback(() => {
    setPathStack((prev) => prev.slice(0, -1))
    setSelectedId(null)
  }, [])

  const canGoBack = pathStack.length > 0
  const itemCount = countItems(currentEntries)
  const statusText = `${itemCount} item${itemCount !== 1 ? 's' : ''}, 72K in disk, 400K available`

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-chicago)',
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar / path bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          borderBottom: '1px solid #000',
          flexShrink: 0,
          background: '#fff',
        }}
      >
        <button
          type="button"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={handleBack}
          style={{
            appearance: 'none',
            fontFamily: 'var(--font-chicago)',
            fontSize: 10,
            background: '#fff',
            border: '1px solid #000',
            padding: '1px 6px',
            cursor: canGoBack ? 'pointer' : 'default',
            color: canGoBack ? '#000' : '#aaa',
            flexShrink: 0,
          }}
        >
          ◀ Back
        </button>
        <span
          style={{
            fontSize: 10,
            color: '#000',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {breadcrumb}
        </span>
      </div>

      {/* Icon grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 8,
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: 4,
        }}
        onClick={(e) => {
          // Deselect when clicking the container background
          if (e.target === e.currentTarget) setSelectedId(null)
        }}
      >
        {currentEntries.map((entry) => {
          const id = entry.kind === 'folder' ? entry.id : entry.path
          return (
            <ContextGridItem
              key={id}
              entry={entry}
              selected={selectedId === id}
              onSelect={() => setSelectedId(id)}
              onOpen={() => handleOpen(entry)}
              onPreview={entry.kind === 'file' ? setPreview : null}
            />
          )
        })}
      </div>

      {/* Internal status bar (stays in sync with navigation) */}
      <div
        style={{
          borderTop: '1px solid #000',
          padding: '2px 6px',
          fontSize: 10,
          background: '#f0f0f0',
          flexShrink: 0,
          fontFamily: 'var(--font-chicago)',
        }}
      >
        {statusText}
      </div>

      {/* Preview overlay */}
      {preview && (
        <PreviewOverlay
          entry={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
