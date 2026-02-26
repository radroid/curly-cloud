import { getBlogPosts } from 'app/blog/utils'
import { getAllProjects } from '@/app/lib/projects'

export const baseUrl = 'https://curlycloud.dev'

export default async function sitemap() {
  let blogs = getBlogPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.metadata.publishedAt,
  }))

  let projects = getAllProjects().map((project) => ({
    url: `${baseUrl}/projects/${project.id}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  let routes = ['', '/blog', '/history'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  return [...routes, ...blogs, ...projects]
}
