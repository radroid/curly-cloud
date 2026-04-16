'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'curly-os-notepad';
const WELCOME_MESSAGE =
  'Welcome to Curly OS. This is a real note — try typing. It saves locally.';

export function NotePadApp() {
  const [content, setContent] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) {
        setContent(WELCOME_MESSAGE);
      } else {
        setContent(saved);
      }
      setHydrated(true);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setContent(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
    }
  }

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
          value={hydrated ? content : ''}
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
    </div>
  );
}
