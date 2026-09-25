import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const cache = (value: string) => [{ key: 'Cache-Control', value }]

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
]

const nextConfig: NextConfig = {
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2|wav)', headers: cache('public, max-age=3600, must-revalidate') },
      // Hashed build assets are immutable in production only; dev reuses the same URLs across edits.
      ...(process.env.NODE_ENV === 'production'
        ? [{ source: '/_next/static/:path*', headers: cache('public, max-age=31536000, immutable') }]
        : []),
    ]
  },
  // Agents expect the MCP endpoint at /mcp.
  async rewrites() {
    return [{ source: '/mcp', destination: '/api/mcp' }]
  },
}

export default nextConfig

// Gives `next dev` the same bindings as production (D1 locally, Workers AI remotely).
initOpenNextCloudflareForDev()
