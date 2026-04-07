export const baseUrl = 'https://curlycloud.dev'

export default async function sitemap() {
  return [
    {
      url: baseUrl,
      lastModified: new Date().toISOString().split('T')[0],
    },
  ]
}
