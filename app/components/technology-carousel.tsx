"use client"

import AutoScroll from "embla-carousel-auto-scroll"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/app/components/ui/carousel"
import {
  NextJSIcon,
  ReactIcon,
  TypeScriptIcon,
  TailwindIcon,
  NodeJSIcon,
  PostgreSQLIcon,
  ExpressIcon,
  ConvexIcon,
  ClerkIcon,
  StripeIcon,
  FramerMotionIcon,
  ThreeJSIcon,
  AFrameIcon,
  SandpackIcon,
  ShadcnIcon,
  RadixUIIcon,
  HTMLIcon,
  AWSIcon,
  GeminiIcon,
  ClaudeIcon,
  OpenAIIcon,
  GoogleCloudIcon,
  LangchainIcon,
  PostHogIcon,
  CloudflareIcon,
  DigitalOceanIcon,
  DockerIcon,
  VercelIcon,
  SupabaseIcon,
} from "./technology-badges"

interface Technology {
  id: string
  name: string
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

interface TechnologyCarouselProps {
  technologies?: Technology[]
  projectTechnologies?: string[][]
  heading?: string
  className?: string
}

// Normalize technology names to base names for deduplication
const normalizeTechName = (name: string): string => {
  const normalized = name
    .replace(/\s+v?\d+(\.\d+)?(\.\d+)?/gi, '') // Remove version numbers
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()

  // Handle specific cases
  if (normalized.includes('Next.js')) return 'Next.js'
  if (normalized.includes('React')) return 'React'
  if (normalized.includes('TypeScript')) return 'TypeScript'
  if (normalized.includes('Tailwind')) return 'Tailwind CSS'
  if (normalized.includes('shadcn') || normalized.includes('Shadcn')) return 'Shadcn UI'
  if (normalized.includes('Framer Motion') || normalized.includes('Motion')) return 'Framer Motion'
  if (normalized.includes('Radix')) return 'Radix UI'
  if (normalized.includes('HTML5') || normalized.includes('HTML')) return 'HTML'
  if (normalized.includes('AWS') || normalized.includes('Amazon Web Services')) return 'AWS'
  if (normalized.includes('Gemini') || normalized.includes('Google Gemini')) return 'Gemini'
  if (normalized.includes('Claude') || normalized.includes('Anthropic')) return 'Claude'
  if (normalized.includes('OpenAI') || normalized.includes('Open AI') || normalized.includes('GPT') || normalized.includes('ChatGPT')) return 'OpenAI'
  if (normalized.includes('Google Cloud') || normalized.includes('GCP')) return 'Google Cloud'
  if (normalized.includes('Langchain') || normalized.includes('LangChain')) return 'Langchain'
  if (normalized.includes('PostHog') || normalized.includes('Posthog')) return 'PostHog'
  if (normalized.includes('Cloudflare')) return 'Cloudflare'
  if (normalized.includes('DigitalOcean') || normalized.includes('Digital Ocean') || normalized.includes(' DO ')) return 'DigitalOcean'
  if (normalized.includes('Docker')) return 'Docker'
  if (normalized.includes('Vercel')) return 'Vercel'
  if (normalized.includes('Supabase')) return 'Supabase'

  return normalized
}

// Get icon for a technology name
const getTechnologyIcon = (name: string): React.ComponentType<{ className?: string }> | null => {
  const normalized = normalizeTechName(name)

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'Next.js': NextJSIcon,
    'React': ReactIcon,
    'TypeScript': TypeScriptIcon,
    'Tailwind CSS': TailwindIcon,
    'Node.js': NodeJSIcon,
    'PostgreSQL': PostgreSQLIcon,
    'Express.js': ExpressIcon,
    'Express': ExpressIcon,
    'Convex': ConvexIcon,
    'Clerk': ClerkIcon,
    'Stripe': StripeIcon,
    'Framer Motion': FramerMotionIcon,
    'Motion': FramerMotionIcon,
    'Three.js': ThreeJSIcon,
    'A-Frame': AFrameIcon,
    'AR.js': AFrameIcon,
    'Sandpack': SandpackIcon,
    'Shadcn UI': ShadcnIcon,
    'shadcn/ui': ShadcnIcon,
    'Radix UI': RadixUIIcon,
    'HTML': HTMLIcon,
    'HTML5': HTMLIcon,
    'AWS': AWSIcon,
    'Amazon Web Services': AWSIcon,
    'Gemini': GeminiIcon,
    'Google Gemini': GeminiIcon,
    'Claude': ClaudeIcon,
    'Claude AI': ClaudeIcon,
    'Anthropic Claude': ClaudeIcon,
    'OpenAI': OpenAIIcon,
    'Open AI': OpenAIIcon,
    'GPT': OpenAIIcon,
    'ChatGPT': OpenAIIcon,
    'Google Cloud': GoogleCloudIcon,
    'Google Cloud Platform': GoogleCloudIcon,
    'GCP': GoogleCloudIcon,
    'Langchain': LangchainIcon,
    'LangChain': LangchainIcon,
    'PostHog': PostHogIcon,
    'Posthog': PostHogIcon,
    'Cloudflare': CloudflareIcon,
    'DigitalOcean': DigitalOceanIcon,
    'Digital Ocean': DigitalOceanIcon,
    'DO': DigitalOceanIcon,
    'Docker': DockerIcon,
    'Vercel': VercelIcon,
    'Supabase': SupabaseIcon,
  }

  return iconMap[normalized] || null
}

// Extract unique technologies from all projects
export function extractUniqueTechnologies(projects: Array<{ technologies?: string[] }>): Technology[] {
  const techSet = new Set<string>()

  projects.forEach(project => {
    project.technologies?.forEach(tech => {
      const normalized = normalizeTechName(tech)
      techSet.add(normalized)
    })
  })

  const technologies: Technology[] = []

  techSet.forEach(name => {
    const Icon = getTechnologyIcon(name)
    if (Icon) {
      technologies.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        Icon,
      })
    }
  })

  // Sort by name
  return technologies.sort((a, b) => a.name.localeCompare(b.name))
}

export function TechnologyCarousel({
  technologies: technologiesProp,
  projectTechnologies,
  heading,
  className
}: TechnologyCarouselProps) {
  const technologies = technologiesProp ?? (projectTechnologies
    ? extractUniqueTechnologies(projectTechnologies.map(techs => ({ technologies: techs })))
    : [])

  if (technologies.length === 0) {
    return null
  }

  return (
    <section className={`py-4 md:py-6 ${className || ''}`}>
      {heading && (
        <div className="mb-6 text-center">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: 'rgb(var(--foreground))' }}>
            {heading}
          </h2>
        </div>
      )}
      <div className="pt-2 -mx-4 md:-mx-8">
        <div className="relative w-full flex items-center justify-center">
          {/* Left fade gradient */}
          <div
            className="absolute left-0 top-0 bottom-0 w-32 md:w-48 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, rgb(var(--background)), transparent)',
            }}
          />
          {/* Right fade gradient */}
          <div
            className="absolute right-0 top-0 bottom-0 w-32 md:w-48 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, rgb(var(--background)), transparent)',
            }}
          />
          <Carousel
            opts={{
              loop: true,
              align: 'start',
              dragFree: true,
              containScroll: 'trimSnaps',
            }}
            plugins={[
              AutoScroll({
                speed: 0.7,
                stopOnInteraction: false,
                stopOnMouseEnter: false,
                stopOnFocusIn: false,
              })
            ]}
            className="w-full"
          >
            <CarouselContent className="ml-0">
              {technologies.map((tech) => (
                <CarouselItem
                  key={tech.id}
                  className="flex basis-1/4 justify-center pl-0 sm:basis-1/5 md:basis-1/6 lg:basis-1/8"
                >
                  <div className="mx-2 flex shrink-0 items-center justify-center">
                    <div
                      className="flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all hover:opacity-80 hover:scale-105"
                      style={{
                        backgroundColor: 'rgba(var(--muted), 0.4)',
                        border: '1px solid rgba(var(--border), 0.3)',
                      }}
                      title={tech.name}
                    >
                      <tech.Icon
                        className="w-8 h-8 sm:w-10 sm:h-10"
                        style={{ color: 'rgb(var(--foreground))' }}
                      />
                      <span
                        className="text-[10px] font-medium text-center max-w-[60px] truncate"
                        style={{ color: 'rgb(var(--muted-foreground))' }}
                      >
                        {tech.name}
                      </span>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </section>
  )
}

