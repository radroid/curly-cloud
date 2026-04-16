'use client'

import { useState, useEffect } from 'react'

type Post = {
  title: string
  publishedAt: string
  summary: string
  body: string
}

const POSTS: Post[] = [
  {
    title: 'Building Product for Humans, Not Metrics',
    publishedAt: 'January 15, 2026',
    summary: 'The best products measure success by whether people grew, not just whether numbers went up.',
    body: `I measure success by whether people grew. Not by DAU, retention curves, or conversion rates--though those matter. The real question: did this product make someone's life better?

The Metrics Trap

It's easy to optimize for numbers. A/B test button colors, gamify engagement, push notifications. But when metrics become the goal, you lose sight of the human on the other side.

What Humans Actually Want

People want to feel capable. They want to connect. They want experiences that surprise and delight. At ARK Experiences, we didn't measure success by bookings alone--we measured it by whether people left with stories they'd tell for years.

The Framework

Before building, ask:
  1. What problem are we actually solving?
  2. How will this make someone feel?
  3. What's the human outcome we're optimizing for?

If you can't answer these, you're building for metrics, not humans. And metrics don't remember your product. Humans do.`,
  },
  {
    title: 'Why Generalism is the Future',
    publishedAt: 'February 10, 2026',
    summary: 'As AI commoditizes specialists, generalists who can think across domains become the premium asset.',
    body: `The future belongs to generalists. While AI tools can now write code, design interfaces, and analyze data, they struggle to connect dots across disciplines. That's where generalists thrive.

The Specialist Trap

Specialization made sense when knowledge was scarce. But in 2026, AI can generate boilerplate, debug common issues, and follow established patterns. The specialist who only knows React or only designs UIs is competing with tools that do their job faster and cheaper.

The Generalist Advantage

Generalists see systems, not silos. When building ARK Adventures, I didn't just code--I understood user psychology, business economics, and physical experience design. That cross-domain thinking is what creates breakthrough products.

What This Means

By 2030, the premium will shift from "knowing React" to "understanding how React fits into a product strategy that serves humans." Generalists who can architect experiences, not just implement features, will command the highest value.

The question isn't whether you're a specialist or generalist. It's whether you can think beyond your domain and build for humans, not just metrics.`,
  },
  {
    title: 'The Tension Between Physical & Digital',
    publishedAt: 'March 5, 2026',
    summary: 'Building ARK Adventures taught me that the best experiences bridge the gap between what happens on screen and what happens in real life.',
    body: `There's a gap between digital products and lived experiences. Most builders live in one world or the other. The magic happens in the bridge.

Two Worlds

Digital products scale infinitely. Physical experiences create memories. Most companies pick one: either you're a software company or an experience company. But the future belongs to those who merge both.

What I Learned at ARK

Building ARK Adventures forced me to think about both sides. The booking flow had to be frictionless (digital), but the actual adventure had to be unforgettable (physical). The product wasn't the app--it was the entire journey from discovery to memory.

The Bridge

The best products don't just live on your phone. They enhance what happens when you put it down. Whether it's a travel app that makes you want to explore, or a fitness tracker that changes how you move, the goal is the same: make the digital serve the physical.

That's where the real innovation happens--not in pixels, but in the moments between.`,
  },
]

export function ScrapbookApp() {
  const [page, setPage] = useState(0)
  const total = POSTS.length
  const post = POSTS[page]

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPage((p) => Math.max(0, p - 1))
      } else if (e.key === 'ArrowRight') {
        setPage((p) => Math.min(total - 1, p + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [total])

  const navBtnBase: React.CSSProperties = {
    fontFamily: 'var(--font-chicago)',
    fontSize: 14,
    background: '#fff',
    color: '#000',
    border: '1px solid #000',
    padding: '1px 8px',
    cursor: 'pointer',
    WebkitFontSmoothing: 'none',
    userSelect: 'none',
    lineHeight: 1.4,
  }

  const navBtnDisabled: React.CSSProperties = {
    ...navBtnBase,
    color: '#aaa',
    cursor: 'default',
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        overflow: 'hidden',
        fontFamily: 'var(--font-chicago)',
      }}
    >
      {/* Paper area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: '6px 6px 0 6px',
          border: '1px solid #000',
          boxShadow: '1px 1px 0 #000',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 12px',
          }}
        >
          {/* Title */}
          <div
            style={{
              fontFamily: 'var(--font-chicago)',
              fontSize: 16,
              fontWeight: 'bold',
              marginBottom: 4,
              WebkitFontSmoothing: 'none',
              lineHeight: 1.3,
            }}
          >
            {post.title}
          </div>

          {/* Date */}
          <div
            style={{
              fontFamily: 'var(--font-chicago)',
              fontSize: 11,
              color: '#555',
              marginBottom: 8,
              WebkitFontSmoothing: 'none',
            }}
          >
            {post.publishedAt}
          </div>

          {/* Summary */}
          <div
            style={{
              fontFamily: 'var(--font-chicago)',
              fontSize: 12,
              fontStyle: 'italic',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid #ccc',
              WebkitFontSmoothing: 'none',
              lineHeight: 1.5,
            }}
          >
            {post.summary}
          </div>

          {/* Body */}
          <pre
            style={{
              fontFamily: 'var(--font-chicago)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              margin: 0,
              WebkitFontSmoothing: 'none',
              lineHeight: 1.6,
              color: '#000',
            }}
          >
            {post.body}
          </pre>
        </div>
      </div>

      {/* Footer nav bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px',
          borderTop: '1px solid #000',
          background: '#fff',
          flexShrink: 0,
          marginTop: 6,
        }}
      >
        <button
          type="button"
          style={page === 0 ? navBtnDisabled : navBtnBase}
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          aria-label="Previous page"
        >
          &#9664;
        </button>

        <span
          style={{
            fontFamily: 'var(--font-chicago)',
            fontSize: 12,
            WebkitFontSmoothing: 'none',
          }}
        >
          {page + 1} / {total}
        </span>

        <button
          type="button"
          style={page === total - 1 ? navBtnDisabled : navBtnBase}
          disabled={page === total - 1}
          onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
          aria-label="Next page"
        >
          &#9654;
        </button>
      </div>
    </div>
  )
}
