import Link from 'next/link'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import React from 'react'

// Table component for react-markdown (handled by remark-gfm)
function Table({ children }: any) {
  return <table>{children}</table>
}

function CustomLink(props) {
  let href = props.href

  if (href.startsWith('/')) {
    return (
      <Link href={href} {...props}>
        {props.children}
      </Link>
    )
  }

  if (href.startsWith('#')) {
    return <a {...props} />
  }

  return <a target="_blank" rel="noopener noreferrer" {...props} />
}

function RoundedImage(props: any) {
  // Filter out invalid props that might come from markdown (like onLoad, onError as strings)
  // Next.js Image component only accepts specific props - event handlers as strings cause React error #231
  const {
    alt,
    src,
    width,
    height,
    title,
    // Explicitly exclude event handlers and other invalid props that might be strings from markdown
    onLoad,
    onError,
    onClick,
    onMouseEnter,
    onMouseLeave,
    loading,
    ...rest
  } = props

  // Build valid props object for Next.js Image
  const imageProps: any = {
    alt: alt || '',
    src: src || '',
    className: 'rounded-lg',
  }

  // Handle width/height if provided
  if (width && height) {
    const numWidth = Number(width)
    const numHeight = Number(height)
    if (!isNaN(numWidth) && !isNaN(numHeight) && numWidth > 0 && numHeight > 0) {
      imageProps.width = numWidth
      imageProps.height = numHeight
    } else {
      // Use fill if dimensions are invalid
      imageProps.fill = true
      imageProps.style = { objectFit: 'contain' }
    }
  } else {
    // Use fill if dimensions not provided
    imageProps.fill = true
    imageProps.style = { objectFit: 'contain' }
  }

  // Add title if provided
  if (title) {
    imageProps.title = title
  }

  return <Image {...imageProps} />
}

function Code({ children, className, ...props }: any) {
  const isInline = !className
  if (isInline) {
    return <code {...props}>{children}</code>
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

function slugify(str) {
  return str
    .toString()
    .toLowerCase()
    .trim() // Remove whitespace from both ends of a string
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters except for -
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
}

function createHeading(level) {
  const Heading = ({ children }) => {
    let slug = slugify(children)
    return React.createElement(
      `h${level}`,
      { id: slug },
      React.createElement('a', {
        href: `#${slug}`,
        key: `link-${slug}`,
        className: 'anchor',
        'aria-label': `Link to ${children}`,
      }),
      children
    )
  }

  Heading.displayName = `Heading${level}`

  return Heading
}

let components: any = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  h5: createHeading(5),
  h6: createHeading(6),
  img: RoundedImage,
  a: CustomLink,
  code: Code,
  table: Table,
}

export function CustomMDX({ source, ...props }: { source: string;[key: string]: any }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        ...components,
        ...(props.components || {}),
      }}
    >
      {source}
    </ReactMarkdown>
  )
}
