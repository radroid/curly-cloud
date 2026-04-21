import type { NextConfig } from 'next'

const cache = (value: string) => [{ key: 'Cache-Control', value }]

const nextConfig: NextConfig = {
  images: { formats: ['image/avif', 'image/webp'] },
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2|wav)',
        headers: cache('public, max-age=3600, must-revalidate'),
      },
      {
        source: '/_next/static/:path*',
        headers: cache('public, max-age=31536000, immutable'),
      },
    ]
  },
}

export default nextConfig
