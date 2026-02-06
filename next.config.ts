import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  webpack: (config, { isServer }) => {
    // Allow importing .mdx files as raw text using ?raw query
    config.module.rules.push({
      test: /\.mdx$/,
      resourceQuery: /raw/,
      type: 'asset/source',
    })
    return config
  },
}

export default nextConfig

