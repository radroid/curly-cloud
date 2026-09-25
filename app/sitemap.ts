import type { MetadataRoute } from 'next'

const BASE = 'https://curlycloud.dev'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date().toISOString().split('T')[0]
  return [
    { url: BASE, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/terminal`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/mac`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/llms.txt`, lastModified, changeFrequency: 'weekly', priority: 0.5 },
  ]
}
