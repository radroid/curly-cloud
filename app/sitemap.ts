export default async function sitemap() {
  return [{ url: 'https://curlycloud.dev', lastModified: new Date().toISOString().split('T')[0] }]
}
