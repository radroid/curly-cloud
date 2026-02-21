import Link from 'next/link'
import { formatDate, getBlogPosts } from 'app/blog/utils'

export function BlogPosts() {
  let allBlogs = getBlogPosts()

  return (
    <div>
      {allBlogs
        .sort((a, b) => {
          if (
            new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)
          ) {
            return -1
          }
          return 1
        })
        .map((post) => (
          <Link
            key={post.slug}
            className="flex flex-col space-y-1 mb-4 transition-colors duration-300 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={`/blog/${post.slug}`}
            style={{ color: 'inherit' }}
          >
            <div className="w-full flex flex-col md:flex-row space-x-0 md:space-x-2">
              <p 
                className="w-full md:w-[100px] tabular-nums transition-colors duration-300 mb-1 md:mb-0"
                style={{ color: 'rgb(var(--muted-foreground))' }}
              >
                {formatDate(post.metadata.publishedAt, false)}
              </p>
              <p 
                className="tracking-tight transition-colors duration-300"
                style={{ color: 'rgb(var(--foreground))' }}
              >
                {post.metadata.title}
              </p>
            </div>
          </Link>
        ))}
    </div>
  )
}
