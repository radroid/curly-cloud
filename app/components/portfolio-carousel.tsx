'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  // Simple theme-aware shadow
  const buttonShadow = useMemo(() => {
    if (isDarkTheme) {
      return '0 2px 8px rgba(255, 255, 255, 0.1)'
    } else {
      return '0 2px 8px rgba(0, 0, 0, 0.2)'
    }
  }, [isDarkTheme])

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
      {/* Previous Button */}
      <button
        onClick={() => {
          goToPrevious()
          setIsPaused(true)
          setTimeout(() => setIsPaused(false), 6000) // Resume after 10 seconds
        }}
        className="absolute left-2 sm:left-0 top-1/2 -translate-y-1/2 sm:-translate-x-12 z-10 p-2 rounded-full backdrop-blur-sm transition-colors shadow-lg"
        style={{
          backgroundColor: 'rgba(var(--card), 0.9)',
          color: 'rgb(var(--foreground))',
          boxShadow: buttonShadow,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(var(--card), 1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(var(--card), 0.9)'
        }}
        aria-label="Previous project"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      {/* Next Button */}
      <button
        onClick={() => {
          goToNext()
          setIsPaused(true)
          setTimeout(() => setIsPaused(false), 6000) // Resume after 6 seconds
        }}
        className="absolute right-2 sm:right-0 top-1/2 -translate-y-1/2 sm:translate-x-12 z-10 p-2 rounded-full backdrop-blur-sm transition-colors shadow-lg"
        style={{
          backgroundColor: 'rgba(var(--card), 0.9)',
          color: 'rgb(var(--foreground))',
          boxShadow: buttonShadow,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(var(--card), 1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(var(--card), 0.9)'
        }}
        aria-label="Next project"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      <div
        className="w-full relative overflow-hidden rounded-lg transition-colors duration-300 shadow-lg"
        style={{
          backgroundColor: 'rgb(var(--background))',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
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
                className="px-4 sm:px-6 py-3 sm:py-4 transition-colors duration-300 backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgb(var(--background))',
                }}
              >
                <h3
                  className="text-lg sm:text-xl font-semibold tracking-tight transition-colors duration-300"
                  style={{ color: 'rgb(var(--foreground))' }}
                >
                  {project.title}
                </h3>
                {(project.shortDescription || project.description) && (
                  <p
                    className="text-xs sm:text-sm mt-1 transition-colors duration-300"
                    style={{ color: 'rgb(var(--muted-foreground))' }}
                  >
                    {project.shortDescription || project.description}
                  </p>
                )}
              </div>

              {/* Video/Iframe Container */}
              <div
                className="pb-5 w-full relative transition-colors duration-300 cursor-pointer group flex items-center justify-center"
                style={{ backgroundColor: 'rgb(var(--background))' }}
                onClick={() => router.push(`/projects/${project.id}`)}
              >
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
                    className="w-full h-auto max-h-[80vh] object-contain transition-opacity group-hover:opacity-90"
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
                    className="w-full aspect-[16/10] border-0 rounded-xl transition-opacity group-hover:opacity-90"
                    title={project.title}
                    loading="lazy"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="px-4 py-2 rounded-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(var(--card), 0.9)' }}>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--foreground))' }}>
                      View details →
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots Navigation */}
      <div className="flex justify-center gap-2 mt-4 sm:mt-6">
        {projects.map((_, index) => {
          // Map extended array index to original array index for dots
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
                setTimeout(() => setIsPaused(false), 3000) // Resume after 3 seconds
              }}
              className="rounded-full transition-all duration-300"
              style={{
                width: isActive ? '2rem' : '0.5rem',
                height: '0.5rem',
                backgroundColor: isActive
                  ? `rgb(var(--primary))`
                  : `rgb(var(--muted-foreground))`,
                opacity: isActive ? 1 : 0.3,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.opacity = '0.5'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.opacity = '0.3'
                }
              }}
              aria-label={`Go to project ${index + 1}`}
            />
          )
        })}
      </div>
    </div>
  )
}

