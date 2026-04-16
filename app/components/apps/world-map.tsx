'use client'

import { useState } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'

// ── Data ──────────────────────────────────────────────────────────────────────

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const VISITED = new Set([
  'Canada',
  'United States of America', 'United States',
  'United Kingdom',
  'France', 'Germany', 'Austria', 'Italy', 'Switzerland',
  'Hungary',
  'Czechia', 'Czech Republic', 'Czech Rep.',
  'Netherlands', 'Belgium', 'Luxembourg',
  'Egypt', 'Saudi Arabia', 'United Arab Emirates',
  'India', 'Japan', 'Thailand', 'Malaysia', 'Singapore',
  'Sri Lanka', 'Mauritius', 'New Zealand',
])

const VISITED_COUNT = 24

// ── Style helpers ─────────────────────────────────────────────────────────────

const chicago: React.CSSProperties = {
  fontFamily: 'var(--font-chicago)',
  WebkitFontSmoothing: 'none',
  MozOsxFontSmoothing: 'grayscale',
}

// ── Tooltip state type ────────────────────────────────────────────────────────

interface TooltipState {
  name: string | null
  x: number
  y: number
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WorldMapApp() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    name: null,
    x: 0,
    y: 0,
  })

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: '#fafafa',
        ...chicago,
      }}
    >
      {/* ── Visited count — bottom-left ───────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 10,
          zIndex: 10,
          ...chicago,
          fontSize: 12,
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {VISITED_COUNT} countries visited
      </div>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      {/*
        geoEquirectangular = plate carrée: latitude and longitude lines are
        evenly spaced straight lines, so the whole world fits a clean 2:1
        rectangle with no polar distortion past the point of being flat. At
        scale 128 the globe fills an 800×400 viewBox exactly, which makes
        country borders read cleanly and keeps Antarctica in frame.
      */}
      <ComposableMap
        projection="geoEquirectangular"
        projectionConfig={{ scale: 128, center: [0, 0] }}
        width={800}
        height={400}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          {/*
            4×4 checkerboard dither: two 1×1 black pixels placed diagonally
            at (0,0) and (2,2) within a 4×4 tile. This reproduces the
            authentic Mac OS System 1 "50% stipple" fill used in MacPaint
            and early Mac games.
          */}
          <pattern
            id="visitedPattern"
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
          >
            <rect x="0" y="0" width="1" height="1" fill="#000" />
            <rect x="2" y="2" width="1" height="1" fill="#000" />
          </pattern>
        </defs>

        <Geographies geography={GEO_URL}>
          {({ geographies }: any) =>
            geographies.map((geo: any) => {
              const name: string = geo.properties?.name ?? ''
              const visited = VISITED.has(name)
              const isHovered = tooltip.name === name && name !== ''

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={(e: React.MouseEvent) =>
                    setTooltip({ name, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e: React.MouseEvent) =>
                    setTooltip((prev) =>
                      prev.name === name
                        ? { name, x: e.clientX, y: e.clientY }
                        : { name, x: e.clientX, y: e.clientY }
                    )
                  }
                  onMouseLeave={() =>
                    setTooltip({ name: null, x: 0, y: 0 })
                  }
                  style={{
                    default: {
                      fill: visited ? 'url(#visitedPattern)' : '#fff',
                      stroke: '#000',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                    hover: {
                      fill: visited ? 'url(#visitedPattern)' : '#fff',
                      stroke: '#000',
                      strokeWidth: 1.75,
                      outline: 'none',
                      cursor: 'default',
                    },
                    pressed: {
                      fill: visited ? 'url(#visitedPattern)' : '#fff',
                      stroke: '#000',
                      strokeWidth: 1.75,
                      outline: 'none',
                    },
                  }}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>

      {/* ── Tooltip ───────────────────────────────────────────────────────── */}
      {tooltip.name !== null && tooltip.name !== '' && (() => {
        const visited = VISITED.has(tooltip.name)
        return (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x + 12,
              top: tooltip.y + 12,
              zIndex: 9999,
              background: visited ? '#000' : '#fff',
              color: visited ? '#fff' : '#000',
              border: '1px solid #000',
              padding: '5px 7px',
              ...chicago,
              fontSize: 12,
              lineHeight: 1,
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {visited ? `✓ ${tooltip.name}` : tooltip.name}
          </div>
        )
      })()}
    </div>
  )
}
