'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useIsDarkTheme } from '@/app/lib/theme-utils'

interface PortfolioProject {
  id: string
  title: string
  url?: string
  video?: string
  description?: string
  shortDescription?: string
  technologies?: string[]
}

interface PortfolioCarouselProps {
  projects: PortfolioProject[]
}

export function PortfolioCarousel({ projects }: PortfolioCarouselProps) {
  // For infinite scroll: [duplicate last] [0] [1] ... [n-1] [duplicate first]
  // Start at index 1 (first real slide)
  const [currentIndex, setCurrentIndex] = useState(projects.length > 1 ? 1 : 0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const slidesContainerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map())
  const isDarkTheme = useIsDarkTheme()

  // Custom cursor state
  const cursorRef = useRef<HTMLDivElement>(null)
  const [cursorVisible, setCursorVisible] = useState(false)
  const cursorPos = useRef({ x: 0, y: 0 })
  const animFrameRef = useRef<number>(0)

  const updateCursorPosition = useCallback(() => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${cursorPos.current.x}px, ${cursorPos.current.y}px)`
    }
    animFrameRef.current = requestAnimationFrame(updateCursorPosition)
  }, [])

  useEffect(() => {
    if (cursorVisible) {
      animFrameRef.current = requestAnimationFrame(updateCursorPosition)
    }
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [cursorVisible, updateCursorPosition])

  const handleVideoMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    cursorPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const handleVideoMouseEnter = useCallback(() => { setCursorVisible(true) }, [])
  const handleVideoMouseLeave = useCallback(() => { setCursorVisible(false) }, [])

  // Arrow hover state
  const [prevHovered, setPrevHovered] = useState(false)
  const [nextHovered, setNextHovered] = useState(false)

  // Create extended array with duplicates for infinite scroll
  const extendedProjects = projects.length > 1
    ? [projects[projects.length - 1], ...projects, projects[0]]
    : projects

  const goToPrevious = () => {
    if (projects.length <= 1) return
    setCurrentIndex((prev) => prev - 1)
  }

  const goToNext = useCallback(() => {
    if (projects.length <= 1) return
    setCurrentIndex((prev) => prev + 1)
  }, [projects.length])

  const goToSlide = (index: number) => {
    // Map dot index (0-based) to extended array index (1-based, skipping duplicate)
    setCurrentIndex(index + 1)
  }

  // Handle seamless infinite scroll transitions
  useEffect(() => {
    const container = slidesContainerRef.current
    if (!container || projects.length <= 1) return

    const handleTransitionEnd = () => {
      // If we're at the duplicate last slide (index 0), jump to real last slide
      if (currentIndex === 0) {
        container.style.transition = 'none'
        setCurrentIndex(projects.length)
        // Re-enable transition in next frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (container) {
              container.style.transition = ''
            }
          })
        })
      }
      // If we're at the duplicate first slide (last index), jump to real first slide
      else if (currentIndex === extendedProjects.length - 1) {
        container.style.transition = 'none'
        setCurrentIndex(1)
        // Re-enable transition in next frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (container) {
              container.style.transition = ''
            }
          })
        })
      }
    }

    container.addEventListener('transitionend', handleTransitionEnd)
    return () => {
      container.removeEventListener('transitionend', handleTransitionEnd)
    }
  }, [currentIndex, projects.length, extendedProjects.length])

  // Auto-rotation effect
  useEffect(() => {
    if (projects.length <= 1 || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      goToNext()
    }, 10000) // Rotate every 10 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPaused, projects.length, goToNext])

  // Play video when slide becomes active, pause others
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === currentIndex) {
          video.play().catch(() => {
            // Autoplay may fail, but that's okay - user interaction will start it
          })
        } else {
          video.pause()
        }
      }
    })
  }, [currentIndex])

  if (projects.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-neutral-500" style={{ minHeight: '400px' }}>
        <p>No projects to display</p>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col relative">
      {/* Carousel Card */}
      <div
        className="w-full relative overflow-hidden rounded-2xl transition-colors duration-300"
        style={{
          backgroundColor: 'rgb(var(--card))',
          border: '1px solid rgb(var(--border) / 0.6)',
          boxShadow: isDarkTheme
            ? '0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2)'
            : '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Slides Container */}
        <div
          ref={slidesContainerRef}
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`
          }}
        >
          {extendedProjects.map((project, index) => (
            <div
              key={`${project.id}-${index}`}
              className="min-w-full w-full flex flex-col"
            >
              {/* Project Title Bar */}
              <div
                className="px-5 sm:px-6 pt-5 pb-3 sm:pt-6 sm:pb-4 transition-colors duration-300"
                style={{ borderBottom: '1px solid rgb(var(--border) / 0.4)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      className="text-base sm:text-lg font-semibold tracking-tight transition-colors duration-300"
                      style={{ color: 'rgb(var(--foreground))' }}
                    >
                      {project.title}
                    </h3>
                    {(project.shortDescription || project.description) && (
                      <p
                        className="text-xs sm:text-sm mt-1 transition-colors duration-300 line-clamp-1"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {project.shortDescription || project.description}
                      </p>
                    )}
                  </div>
                  {/* Slide counter */}
                  <span
                    className="text-xs font-medium tabular-nums shrink-0 mt-0.5"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    {String(
                      currentIndex === 0
                        ? projects.length
                        : currentIndex > projects.length
                          ? 1
                          : currentIndex
                    ).padStart(2, '0')}{' '}
                    <span style={{ opacity: 0.4 }}>/</span>{' '}
                    {String(projects.length).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Video/Iframe Container */}
              <div className="w-full relative transition-colors duration-300 flex items-center justify-center">
                {project.video ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefs.current.set(index, el)
                      } else {
                        videoRefs.current.delete(index)
                      }
                    }}
                    src={index === currentIndex ? project.video : undefined}
                    className="w-full h-auto max-h-[75vh] object-contain pointer-events-none"
                    autoPlay
                    playsInline
                    preload={index === currentIndex ? "auto" : "none"}
                    loop
                    muted
                    aria-label={project.title}
                    key={`${project.id}-${index}`}
                  />
                ) : project.url ? (
                  <iframe
                    src={project.url}
                    className="w-full aspect-[16/10] border-0 pointer-events-none"
                    title={project.title}
                    loading="lazy"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
                  />
                ) : null}
                {/* Clickable zone — inset from edges to avoid overlapping arrow buttons */}
                <a
                  href={`/projects/${project.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${project.title} project`}
                  className="absolute inset-y-0 left-56 right-56 z-[5] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  style={{ cursor: 'none' }}
                  onClick={(e) => { e.preventDefault(); window.open(`/projects/${project.id}`, '_blank') }}
                  onMouseMove={handleVideoMouseMove}
                  onMouseEnter={handleVideoMouseEnter}
                  onMouseLeave={handleVideoMouseLeave}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Arrows — inside the card, vertically centered on the video area */}
        <button
          onClick={() => {
            goToPrevious()
            setIsPaused(true)
            setTimeout(() => setIsPaused(false), 6000)
          }}
          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: prevHovered
              ? 'rgb(var(--foreground))'
              : 'rgb(var(--card) / 0.85)',
            color: prevHovered
              ? 'rgb(var(--card))'
              : 'rgb(var(--foreground))',
            backdropFilter: 'blur(8px)',
            boxShadow: isDarkTheme
              ? '0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
              : '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
          }}
          onMouseEnter={() => setPrevHovered(true)}
          onMouseLeave={() => setPrevHovered(false)}
          aria-label="Previous project"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => {
            goToNext()
            setIsPaused(true)
            setTimeout(() => setIsPaused(false), 6000)
          }}
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: nextHovered
              ? 'rgb(var(--foreground))'
              : 'rgb(var(--card) / 0.85)',
            color: nextHovered
              ? 'rgb(var(--card))'
              : 'rgb(var(--foreground))',
            backdropFilter: 'blur(8px)',
            boxShadow: isDarkTheme
              ? '0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
              : '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
          }}
          onMouseEnter={() => setNextHovered(true)}
          onMouseLeave={() => setNextHovered(false)}
          aria-label="Next project"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Custom Cursor Badge */}
        <div
          ref={cursorRef}
          className="absolute top-0 left-0 z-[10] pointer-events-none"
          style={{
            opacity: cursorVisible ? 1 : 0,
            transition: 'opacity 0.2s ease, scale 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            scale: cursorVisible ? '1' : '0.5',
            willChange: 'transform',
          }}
        >
          <div
            className="flex items-center gap-1.5 rounded-full px-4 py-2.5 backdrop-blur-md"
            style={{
              backgroundColor: 'rgb(var(--primary))',
              color: 'rgb(var(--primary-foreground))',
              boxShadow: '0 4px 20px rgb(var(--primary) / 0.4), 0 0 0 1px rgb(var(--primary) / 0.2)',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-xs font-semibold tracking-wide whitespace-nowrap">Open</span>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </div>
        </div>
      </div>

      {/* Dots Navigation */}
      <div className="flex justify-center gap-2.5 mt-5 sm:mt-6">
        {projects.map((_, index) => {
          const activeIndex = currentIndex === 0
            ? projects.length - 1
            : currentIndex === extendedProjects.length - 1
              ? 0
              : currentIndex - 1
          const isActive = index === activeIndex

          return (
            <button
              key={index}
              onClick={() => {
                goToSlide(index)
                setIsPaused(true)
                setTimeout(() => setIsPaused(false), 3000)
              }}
              className="relative flex items-center justify-center cursor-pointer min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-md"
              style={{
                border: 'none',
                background: 'transparent',
              }}
              aria-label={`Go to project ${index + 1}`}
            >
              <span
                className="rounded-full transition-all duration-300"
                style={{
                  width: isActive ? '1.75rem' : '0.5rem',
                  height: '0.5rem',
                  backgroundColor: isActive
                    ? 'rgb(var(--primary))'
                    : 'rgb(var(--muted-foreground))',
                  opacity: isActive ? 1 : 0.25,
                  display: 'block',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

