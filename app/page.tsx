'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { portfolioProjects } from '@/app/lib/projects'
import { PortfolioCarousel } from './components/portfolio-carousel'
import {
  NextJSIcon, ReactIcon, TypeScriptIcon, TailwindIcon, NodeJSIcon,
  PostgreSQLIcon, ExpressIcon, ConvexIcon, ClerkIcon, StripeIcon,
  FramerMotionIcon, ThreeJSIcon, ShadcnIcon, RadixUIIcon, HTMLIcon,
  AWSIcon, GeminiIcon, ClaudeIcon, OpenAIIcon, GoogleCloudIcon,
  LangchainIcon, PostHogIcon, CloudflareIcon, DigitalOceanIcon,
  DockerIcon, VercelIcon, SupabaseIcon,
} from './components/technology-badges'

// ─── Scroll Reveal ──────────────────────────────────────────

function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return { ref, isVisible }
}

function Reveal({ children, className = '', delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number
}) {
  const { ref, isVisible } = useScrollReveal()
  return (
    <div ref={ref} className={className} style={{
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translate3d(0,0,0)' : 'translate3d(0,24px,0)',
      transition: `opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
      willChange: isVisible ? 'auto' : 'opacity, transform',
    }}>
      {children}
    </div>
  )
}

// ─── Animated Counter ───────────────────────────────────────

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && !started) setStarted(true) },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])
  useEffect(() => {
    if (!started) return
    let current = 0
    const interval = setInterval(() => {
      current += target / 30
      if (current >= target) { setCount(target); clearInterval(interval) }
      else setCount(Math.floor(current))
    }, 50)
    return () => clearInterval(interval)
  }, [started, target])
  return <span ref={ref}>{count}{suffix}</span>
}

// ─── Boot Sequence ──────────────────────────────────────────

function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<{ text: string; status: 'loading' | 'done' }[]>([])
  const [fadeOut, setFadeOut] = useState(false)

  const steps = [
    { text: 'raj --version 4.0', delay: 300 },
    { text: 'Loading modules...', delay: 500 },
    { text: '  → frontend: React, Next.js, TypeScript', delay: 350 },
    { text: '  → backend: Node.js, Python, PostgreSQL', delay: 300 },
    { text: '  → ai: LLMs, Agents, LangChain', delay: 350 },
    { text: '  → infra: Docker, AWS, Cloudflare', delay: 300 },
    { text: 'All systems operational. Ready.', delay: 400 },
  ]

  useEffect(() => {
    let timeout: NodeJS.Timeout
    let current = 0
    const process = () => {
      if (current >= steps.length) {
        setTimeout(() => setFadeOut(true), 400)
        setTimeout(onComplete, 1000)
        return
      }
      setLines(prev => [...prev, { text: steps[current].text, status: 'loading' }])
      timeout = setTimeout(() => {
        setLines(prev => prev.map((l, i) => i === current ? { ...l, status: 'done' } : l))
        current++
        timeout = setTimeout(process, 100)
      }, steps[current].delay)
    }
    timeout = setTimeout(process, 500)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{
      backgroundColor: 'rgb(var(--background))',
      opacity: fadeOut ? 0 : 1,
      pointerEvents: fadeOut ? 'none' : 'auto',
      transition: 'opacity 0.6s ease',
    }}>
      <div className="max-w-md w-full">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-2 mb-1" style={{
            animation: 'slideUp 0.25s ease',
            fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
          }}>
            <span className="text-xs mt-0.5 shrink-0" style={{
              color: line.status === 'done' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
            }}>
              {line.status === 'done' ? '●' : '○'}
            </span>
            <span className="text-sm" style={{
              color: line.status === 'done' ? 'rgb(var(--foreground))' : 'rgb(var(--muted-foreground))',
            }}>{line.text}</span>
          </div>
        ))}
        {lines.length < steps.length && (
          <div className="w-2 h-4 ml-5 animate-pulse" style={{ backgroundColor: 'rgb(var(--primary))' }} />
        )}
      </div>
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ─── Depth Card ─────────────────────────────────────────────

function DepthCard({ children, className = '', depth = 1 }: {
  children: React.ReactNode; className?: string; depth?: 1 | 2 | 3
}) {
  const shadows = {
    1: '0 1px 3px rgb(var(--foreground) / 0.04), 0 1px 2px rgb(var(--foreground) / 0.06)',
    2: '0 4px 16px rgb(var(--foreground) / 0.06), 0 2px 4px rgb(var(--foreground) / 0.04)',
    3: '0 12px 40px rgb(var(--foreground) / 0.08), 0 4px 12px rgb(var(--foreground) / 0.04)',
  }
  return (
    <div className={`rounded-xl border transition-all duration-300 ${className}`} style={{
      backgroundColor: 'rgb(var(--card))',
      borderColor: 'rgb(var(--border))',
      boxShadow: shadows[depth],
    }}>
      {children}
    </div>
  )
}

// ─── Tilt Card (cursor-reactive) ────────────────────────────

function TiltCard({ children, className = '' }: {
  children: React.ReactNode; className?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`
  }, [])
  const handleLeave = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)'
    }
  }, [])
  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
      style={{ transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)', willChange: 'transform' }}
    >
      {children}
    </div>
  )
}

// ─── Hero Tech Marquee ──────────────────────────────────────

const heroRow1 = [
  { Icon: NextJSIcon, name: 'Next.js' },
  { Icon: ReactIcon, name: 'React' },
  { Icon: TypeScriptIcon, name: 'TypeScript' },
  { Icon: TailwindIcon, name: 'Tailwind' },
  { Icon: NodeJSIcon, name: 'Node.js' },
  { Icon: PostgreSQLIcon, name: 'PostgreSQL' },
  { Icon: DockerIcon, name: 'Docker' },
  { Icon: AWSIcon, name: 'AWS' },
  { Icon: VercelIcon, name: 'Vercel' },
  { Icon: StripeIcon, name: 'Stripe' },
  { Icon: ShadcnIcon, name: 'shadcn/ui' },
  { Icon: FramerMotionIcon, name: 'Motion' },
  { Icon: ThreeJSIcon, name: 'Three.js' },
  { Icon: HTMLIcon, name: 'HTML5' },
]

const heroRow2 = [
  { Icon: OpenAIIcon, name: 'OpenAI' },
  { Icon: ClaudeIcon, name: 'Claude' },
  { Icon: GeminiIcon, name: 'Gemini' },
  { Icon: LangchainIcon, name: 'LangChain' },
  { Icon: CloudflareIcon, name: 'Cloudflare' },
  { Icon: SupabaseIcon, name: 'Supabase' },
  { Icon: ConvexIcon, name: 'Convex' },
  { Icon: ExpressIcon, name: 'Express' },
  { Icon: ClerkIcon, name: 'Clerk' },
  { Icon: GoogleCloudIcon, name: 'GCP' },
  { Icon: DigitalOceanIcon, name: 'DigitalOcean' },
  { Icon: RadixUIIcon, name: 'Radix UI' },
  { Icon: PostHogIcon, name: 'PostHog' },
]

function HeroMarquee() {
  const doubled1 = [...heroRow1, ...heroRow1]
  const doubled2 = [...heroRow2, ...heroRow2]

  return (
    <div className="relative h-full flex flex-col justify-center gap-3 overflow-hidden rounded-2xl py-4" style={{
      maskImage: 'linear-gradient(180deg, transparent, black 15%, black 85%, transparent)',
      WebkitMaskImage: 'linear-gradient(180deg, transparent, black 15%, black 85%, transparent)',
    }}>
      {/* Row 1 — scrolls left */}
      <div className="overflow-hidden" style={{
        maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
      }}>
        <div className="flex gap-3 whitespace-nowrap" style={{
          animation: 'heroMarqueeLeft 30s linear infinite',
          width: 'max-content',
        }}>
          {doubled1.map((tech, i) => (
            <div key={`r1-${tech.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg shrink-0" style={{
              backgroundColor: 'rgb(var(--card))',
              border: '1px solid rgb(var(--border) / 0.5)',
              boxShadow: '0 2px 8px rgb(var(--foreground) / 0.03)',
            }}>
              <tech.Icon className="w-5 h-5" />
              <span className="text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>{tech.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right */}
      <div className="overflow-hidden" style={{
        maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)',
      }}>
        <div className="flex gap-3 whitespace-nowrap" style={{
          animation: 'heroMarqueeRight 35s linear infinite',
          width: 'max-content',
        }}>
          {doubled2.map((tech, i) => (
            <div key={`r2-${tech.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg shrink-0" style={{
              backgroundColor: 'rgb(var(--card))',
              border: '1px solid rgb(var(--border) / 0.5)',
              boxShadow: '0 2px 8px rgb(var(--foreground) / 0.03)',
            }}>
              <tech.Icon className="w-5 h-5" />
              <span className="text-xs font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>{tech.name}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes heroMarqueeLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes heroMarqueeRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Tech Icon Cell ─────────────────────────────────────────

function TechIcon({ Icon, name }: {
  Icon: React.ComponentType<{ className?: string }>; name: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-all hover:scale-110 hover:shadow-md group cursor-default" style={{
      backgroundColor: 'rgb(var(--muted) / 0.4)',
      border: '1px solid rgb(var(--border) / 0.3)',
    }}>
      <Icon className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-110" />
      <span className="text-[9px] sm:text-[10px] font-medium text-center leading-tight" style={{
        color: 'rgb(var(--muted-foreground))',
      }}>{name}</span>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function Page() {
  const [bootDone, setBootDone] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bootDone') === 'true'
    }
    return false
  })

  const projects = portfolioProjects

  const techCategories = [
    {
      title: 'Frontend',
      icons: [
        { Icon: NextJSIcon, name: 'Next.js' },
        { Icon: ReactIcon, name: 'React' },
        { Icon: TypeScriptIcon, name: 'TypeScript' },
        { Icon: TailwindIcon, name: 'Tailwind' },
        { Icon: ShadcnIcon, name: 'shadcn/ui' },
        { Icon: RadixUIIcon, name: 'Radix UI' },
        { Icon: FramerMotionIcon, name: 'Motion' },
        { Icon: HTMLIcon, name: 'HTML5' },
        { Icon: ThreeJSIcon, name: 'Three.js' },
      ],
    },
    {
      title: 'Backend & Data',
      icons: [
        { Icon: NodeJSIcon, name: 'Node.js' },
        { Icon: ExpressIcon, name: 'Express' },
        { Icon: PostgreSQLIcon, name: 'PostgreSQL' },
        { Icon: SupabaseIcon, name: 'Supabase' },
        { Icon: ConvexIcon, name: 'Convex' },
        { Icon: StripeIcon, name: 'Stripe' },
        { Icon: ClerkIcon, name: 'Clerk' },
      ],
    },
    {
      title: 'AI & ML',
      icons: [
        { Icon: OpenAIIcon, name: 'OpenAI' },
        { Icon: GeminiIcon, name: 'Gemini' },
        { Icon: ClaudeIcon, name: 'Claude' },
        { Icon: LangchainIcon, name: 'LangChain' },
        { Icon: PostHogIcon, name: 'PostHog' },
      ],
    },
    {
      title: 'Infrastructure',
      icons: [
        { Icon: DockerIcon, name: 'Docker' },
        { Icon: AWSIcon, name: 'AWS' },
        { Icon: GoogleCloudIcon, name: 'GCP' },
        { Icon: CloudflareIcon, name: 'Cloudflare' },
        { Icon: VercelIcon, name: 'Vercel' },
        { Icon: DigitalOceanIcon, name: 'DigitalOcean' },
      ],
    },
  ]

  return (
    <div className="w-full" style={{ color: 'rgb(var(--foreground))' }}>
      {!bootDone && <BootSequence onComplete={() => {
        setBootDone(true)
        sessionStorage.setItem('bootDone', 'true')
      }} />}

      <div style={{ opacity: bootDone ? 1 : 0, transition: 'opacity 0.6s ease 0.2s' }}>

        {/* ── Hero ───────────────────────────────────── */}
        <section className="relative pb-16 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left — text content */}
            <div className="lg:col-span-7">
              <Reveal>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-8">
                    <div className="h-6 w-[3px] rounded-full" style={{ backgroundColor: 'rgb(var(--primary))' }} />
                    <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'rgb(var(--primary))' }}>
                      Available for hire
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.06] mb-6 tracking-tight">
                    I build
                    <span className="relative ml-2 sm:ml-3 inline-block">
                      <span className="relative z-10">experiences</span>
                      <span className="absolute bottom-0.5 sm:bottom-1 left-0 right-0 h-2 sm:h-3 opacity-20 rounded" style={{ backgroundColor: 'rgb(var(--primary))' }} />
                    </span>
                    <br />
                    <span style={{ color: 'rgb(var(--primary))' }}>digital & physical</span>
                    <br />
                    for humans.
                  </h1>
                  <p className="text-base sm:text-lg max-w-xl mb-10 leading-relaxed" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    Full-stack engineer with 4+ years shipping web applications from zero to production. I write the code, think about the user, and care about the business outcome.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="flex flex-wrap gap-3">
                  {[
                    { n: 10, s: '+', l: 'Products' },
                    { n: 4, s: '+', l: 'Years' },
                    { n: 12, s: '', l: 'Devs Led' },
                  ].map(stat => (
                    <DepthCard key={stat.l} depth={2} className="px-6 py-4">
                      <div className="text-2xl sm:text-3xl font-bold" style={{
                        color: 'rgb(var(--primary))',
                        fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                      }}>
                        <AnimatedCounter target={stat.n} suffix={stat.s} />
                      </div>
                      <div className="text-[10px] uppercase tracking-wider mt-1 font-medium" style={{ color: 'rgb(var(--muted-foreground))' }}>
                        {stat.l}
                      </div>
                    </DepthCard>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right — tech marquee */}
            <div className="hidden lg:block lg:col-span-5">
              <Reveal delay={0.3}>
                <HeroMarquee />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── About ──────────────────────────────────── */}
        <section className="py-12 sm:py-16">
          <Reveal>
            <DepthCard depth={2} className="p-8 sm:p-10 relative">
              <div className="absolute -top-3 left-8 px-3 py-1 rounded-md text-xs font-semibold tracking-wider uppercase" style={{
                backgroundColor: 'rgb(var(--primary))',
                color: 'rgb(var(--primary-foreground))',
              }}>About</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                <p className="text-base leading-relaxed" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  My stack is React, TypeScript, Next.js, Node.js, Python, and PostgreSQL—and lately I've been deep in AI agents and LLM workflows.
                </p>
                <div>
                  <p className="text-base leading-relaxed mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    I've shipped 10+ products across startups in Toronto and Silicon Valley. From event platforms to AI-powered tools to e-commerce.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#28c840' }} />
                    <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>Toronto · Remote across North America</span>
                  </div>
                </div>
              </div>
            </DepthCard>
          </Reveal>
        </section>

        {/* ── Selected Works (Video Carousel) ────────── */}
        <section className="py-12 sm:py-16">
          <Reveal>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'rgb(var(--primary))' }}>
                Selected Works
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <PortfolioCarousel projects={portfolioProjects.map(p => ({
              id: p.id,
              title: p.shortTitle,
              url: p.url,
              video: p.video,
              shortDescription: p.shortDescription,
              technologies: p.technologies,
            }))} />
          </Reveal>
        </section>

        {/* ── What I Build (Tilt Cards) ──────────────── */}
        <section className="py-12 sm:py-16">
          <Reveal>
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase mb-8" style={{ color: 'rgb(var(--primary))' }}>
              What I Build
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { num: '01', title: 'Full-stack applications', text: 'React/Next.js frontends, Node.js/Python backends, PostgreSQL databases. Auth flows, payment integration, real-time features.' },
              { num: '02', title: 'AI-native features', text: 'LLM integrations, AI agents, prompt engineering, workflow automation. I know when AI adds real value vs. buzzword.' },
              { num: '03', title: 'Infrastructure', text: 'Docker, AWS, CI/CD pipelines, Vercel, Cloudflare. Monitoring, reliability, and keeping things boring in the best way.' },
              { num: '04', title: 'Product-aware code', text: 'I talk to users before writing a line. Every feature ships with a "why," success metrics, and a plan to iterate.' },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <TiltCard className="h-full">
                  <DepthCard depth={2} className="p-6 h-full relative overflow-hidden">
                    <span className="absolute top-3 right-4 text-5xl font-bold opacity-[0.04]" style={{
                      fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                    }}>{item.num}</span>
                    <div className="relative">
                      <h3 className="font-bold mb-2">{item.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--muted-foreground))' }}>{item.text}</p>
                    </div>
                  </DepthCard>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Toolkit (Icon Grid + Skills) ───────────── */}
        <section className="py-12 sm:py-16">
          <Reveal>
            <h2 className="text-xs font-semibold tracking-[0.15em] uppercase mb-8" style={{ color: 'rgb(var(--primary))' }}>
              Toolkit
            </h2>
          </Reveal>

          {/* Tech Stack Icon Grid */}
          <Reveal delay={0.1}>
            <DepthCard depth={2} className="p-6 sm:p-8 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {techCategories.map((category) => (
                  <div key={category.title}>
                    <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: 'rgb(var(--primary))' }}>
                      {category.title}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {category.icons.map((tech) => (
                        <TechIcon key={tech.name} Icon={tech.Icon} name={tech.name} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DepthCard>
          </Reveal>

          {/* Product & Collaboration Skills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Reveal delay={0.2}>
              <DepthCard depth={1} className="p-5 h-full">
                <h3 className="font-bold text-sm mb-3" style={{ color: 'rgb(var(--primary))' }}>Product Thinking</h3>
                <ul className="space-y-2">
                  {['User research & interviews', 'Roadmapping & specs', 'A/B testing & experimentation', 'KPI dashboards', 'JTBD framework', 'SQL & data analysis'].map(item => (
                    <li key={item} className="text-xs flex items-center gap-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: 'rgb(var(--primary))' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </DepthCard>
            </Reveal>
            <Reveal delay={0.3}>
              <DepthCard depth={1} className="p-5 h-full">
                <h3 className="font-bold text-sm mb-3" style={{ color: 'rgb(var(--primary))' }}>Collaboration</h3>
                <ul className="space-y-2">
                  {['Async-first communication', 'Working directly with founders', 'Shipping on startup timelines', 'Code reviews & mentorship', 'Cross-functional teamwork'].map(item => (
                    <li key={item} className="text-xs flex items-center gap-2" style={{ color: 'rgb(var(--muted-foreground))' }}>
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: 'rgb(var(--primary))' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </DepthCard>
            </Reveal>
          </div>
        </section>

        {/* ── Pilot CTA ──────────────────────────────── */}
        <section className="py-12 sm:py-16">
          <Reveal>
            <div className="rounded-2xl p-8 sm:p-12 relative overflow-hidden" style={{
              background: 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--accent)))',
              color: 'rgb(var(--primary-foreground))',
              boxShadow: '0 20px 60px rgb(var(--primary) / 0.2)',
            }}>
              {/* Layered depth strips */}
              <div className="absolute top-0 right-0 w-1/3 h-full opacity-10" style={{ background: 'linear-gradient(90deg, transparent, currentColor)' }} />
              <div className="absolute bottom-0 left-0 w-full h-1/3 opacity-5" style={{ background: 'linear-gradient(0deg, currentColor, transparent)' }} />
              <div className="relative">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">Want proof before you hire?</h2>
                <p className="text-sm sm:text-base mb-6 opacity-90 max-w-2xl leading-relaxed">
                  I offer a 1-week pilot project for any company I'm seriously interested in joining. 30-min call, I build it in one week, you evaluate. No risk, just results.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      const { getCalApi } = await import('@calcom/embed-react')
                      const cal = await getCalApi({ namespace: 'problem-ranter' })
                      cal('modal', { calLink: 'createclub/problem-ranter', config: { layout: 'month_view' } })
                    }}
                    className="text-sm font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 cursor-pointer"
                    style={{ backgroundColor: 'rgb(var(--primary-foreground))', color: 'rgb(var(--primary))' }}>
                    Let&apos;s Talk
                  </button>
                  <a href="mailto:raj9dholakia@gmail.com"
                    className="text-sm font-medium px-6 py-3 rounded-xl border-2 transition-all hover:scale-105"
                    style={{ borderColor: 'currentColor' }}>
                    raj9dholakia@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Contact Footer ─────────────────────────── */}
        <section className="py-8 pb-4">
          <Reveal>
            <DepthCard depth={1} className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#28c840' }} />
                  <span className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
                    Open to Full-Stack / AI Developer roles
                  </span>
                </div>
                <div className="flex gap-5">
                  <a href="https://linkedin.com/in/raj-dholakia" target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: 'rgb(var(--primary))' }}>
                    LinkedIn
                  </a>
                  <a href="mailto:raj9dholakia@gmail.com"
                    className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: 'rgb(var(--primary))' }}>
                    Email
                  </a>
                  <a href="https://github.com/radroid" target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: 'rgb(var(--primary))' }}>
                    GitHub
                  </a>
                </div>
              </div>
            </DepthCard>
          </Reveal>
        </section>

      </div>
    </div>
  )
}
