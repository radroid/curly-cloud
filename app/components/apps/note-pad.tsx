'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const OLD_STORAGE_KEY = 'curly-os-notepad';
const PAGES_STORAGE_KEY = 'curly-os-notepad-pages';
const TRASH_STORAGE_KEY = 'curly-os-trash';
const WELCOME_MESSAGE =
  'Welcome to Curly OS. This is a real note — try typing. It saves locally.';

interface TrashItem {
  content: string;
  deletedAt: number;
}

function loadPages(): string[] {
  if (typeof window === 'undefined') return [''];

  // Check for new paged storage first
  const pagesJson = localStorage.getItem(PAGES_STORAGE_KEY);
  if (pagesJson !== null) {
    try {
      const parsed = JSON.parse(pagesJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to migration / default
    }
  }

  // Migrate from old single-key storage
  const oldContent = localStorage.getItem(OLD_STORAGE_KEY);
  if (oldContent !== null) {
    const pages = [oldContent];
    localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
    localStorage.removeItem(OLD_STORAGE_KEY);
    return pages;
  }

  // Brand new user — show welcome message
  const pages = [WELCOME_MESSAGE];
  localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
  return pages;
}

function savePages(pages: string[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
  }
}

function pushToTrash(content: string) {
  if (typeof window === 'undefined') return;
  let trash: TrashItem[] = [];
  try {
    const raw = localStorage.getItem(TRASH_STORAGE_KEY);
    if (raw) trash = JSON.parse(raw);
  } catch {
    // ignore
  }
  trash.push({ content, deletedAt: Date.now() });
  localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trash));
}

export function NotePadApp() {
  const [pages, setPages] = useState<string[]>(['']);
  const [currentPage, setCurrentPage] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loaded = loadPages();
    setPages(loaded);
    setCurrentPage(0);
    setHydrated(true);
  }, []);

  const currentContent = hydrated ? pages[currentPage] ?? '' : '';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setPages((prev) => {
        const next = [...prev];
        next[currentPage] = value;
        savePages(next);
        return next;
      });
    },
    [currentPage],
  );

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) setCurrentPage((p) => p - 1);
  }, [currentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < pages.length - 1) setCurrentPage((p) => p + 1);
  }, [currentPage, pages.length]);

  const addNewPage = useCallback(() => {
    setPages((prev) => {
      const next = [...prev, ''];
      savePages(next);
      setCurrentPage(next.length - 1);
      return next;
    });
  }, []);

  const clearCurrentPage = useCallback(() => {
    setPages((prev) => {
      const content = prev[currentPage] ?? '';

      // Save to trash if there's content
      if (content.length > 0) {
        pushToTrash(content);
      }

      if (prev.length > 1) {
        // Remove the page
        const next = prev.filter((_, i) => i !== currentPage);
        savePages(next);
        // Navigate to previous page, or stay at 0
        setCurrentPage((p) => Math.min(p, next.length - 1) === 0 ? 0 : p - 1);
        return next;
      } else {
        // Last page — just clear content
        const next = [''];
        savePages(next);
        return next;
      }
    });
  }, [currentPage]);

  // Keyboard navigation — only when textarea is not focused
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if textarea is focused
      if (
        document.activeElement === textareaRef.current ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'INPUT'
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentPage((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        setPages((prev) => {
          e.preventDefault();
          setCurrentPage((p) => Math.min(prev.length - 1, p + 1));
          return prev;
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navButtonStyle: React.CSSProperties = {
    fontFamily: 'var(--font-chicago)',
    fontSize: '11px',
    background: '#fff',
    border: '1px solid #000',
    padding: '1px 6px',
    cursor: 'pointer',
    lineHeight: '14px',
    WebkitFontSmoothing: 'none',
    MozOsxFontSmoothing: 'unset',
  } as React.CSSProperties;

  const disabledButtonStyle: React.CSSProperties = {
    ...navButtonStyle,
    color: '#999',
    border: '1px solid #999',
    cursor: 'default',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Torn top edge */}
      <svg
        width="100%"
        height="7"
        viewBox="0 0 300 7"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0 }}
        aria-hidden="true"
      >
        <polygon
          points="0,7 10,0 20,7 30,0 40,7 50,0 60,7 70,0 80,7 90,0 100,7 110,0 120,7 130,0 140,7 150,0 160,7 170,0 180,7 190,0 200,7 210,0 220,7 230,0 240,7 250,0 260,7 270,0 280,7 290,0 300,7"
          fill="#000"
        />
      </svg>

      {/* Lined paper textarea area */}
      <div
        style={{
          flex: 1,
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 21px, #c8d4e6 21px, #c8d4e6 22px)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <textarea
          ref={textareaRef}
          value={currentContent}
          onChange={handleChange}
          spellCheck={false}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-chicago)',
            fontSize: '14px',
            lineHeight: '22px',
            paddingLeft: '14px',
            paddingRight: '8px',
            paddingTop: '0px',
            paddingBottom: '0px',
            color: '#000',
            boxSizing: 'border-box',
            WebkitFontSmoothing: 'none',
            MozOsxFontSmoothing: 'unset',
          } as React.CSSProperties}
          onFocus={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
        />
      </div>

      {/* Footer navigation bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #000',
          background: '#fff',
          padding: '3px 7px',
          flexShrink: 0,
          fontFamily: 'var(--font-chicago)',
          fontSize: '11px',
          WebkitFontSmoothing: 'none',
          MozOsxFontSmoothing: 'unset',
          gap: '4px',
        } as React.CSSProperties}
      >
        {/* Left group: page navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            style={currentPage === 0 ? disabledButtonStyle : navButtonStyle}
            aria-label="Previous page"
          >
            ◀
          </button>
          <span
            style={{
              fontFamily: 'var(--font-chicago)',
              fontSize: '11px',
              minWidth: '36px',
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            {currentPage + 1} / {pages.length}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= pages.length - 1}
            style={
              currentPage >= pages.length - 1
                ? disabledButtonStyle
                : navButtonStyle
            }
            aria-label="Next page"
          >
            ▶
          </button>
          <button
            onClick={addNewPage}
            style={navButtonStyle}
            aria-label="New page"
          >
            +
          </button>
        </div>

        {/* Right group: clear */}
        <button
          onClick={clearCurrentPage}
          style={navButtonStyle}
          aria-label="Clear current page"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
