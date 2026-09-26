import { ImageResponse } from 'next/og'
import { RESUME } from '@/content/resume'

export const alt = 'Raj Dholakia — AI Engineer. Ask his AI clone, or connect your agent over MCP.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Colours mirror the @theme tokens in app/global.css (ImageResponse can't read CSS variables).
const INK = '#1c2927'
const MUTED = '#56655f'
const FOREST = '#164c46'
const PAPER = '#f5f7f5'
const MARKER = '#f7e3a3'
const CORAL = '#d95f4f'

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: PAPER, padding: 72, color: INK }}>
        <div style={{ fontSize: 26, letterSpacing: 4, color: FOREST, textTransform: 'uppercase' }}>AI Engineer · Toronto</div>
        <div style={{ fontSize: 92, fontWeight: 700, marginTop: 18, letterSpacing: -2 }}>{RESUME.name}</div>
        <div style={{ fontSize: 38, lineHeight: 1.3, marginTop: 20, maxWidth: 940, color: INK }}>{RESUME.pitch}</div>
        <div style={{ display: 'flex', marginTop: 'auto', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: MARKER, padding: '12px 20px', borderRadius: 12, fontSize: 26 }}>
            <span style={{ color: CORAL, marginRight: 12, fontWeight: 700 }}>[1]</span>
            Ask my AI clone — every answer cited
          </div>
          <div style={{ fontSize: 26, color: MUTED }}>MCP for agents · curlycloud.dev</div>
        </div>
      </div>
    ),
    size,
  )
}
