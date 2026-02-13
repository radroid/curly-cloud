'use client'

import { useEffect, useRef, useState } from 'react'

const timelineData = [
  { year: '2014', title: 'International Baccalaureate', description: 'Foundation years. Rigorous academics and the beginning of a global perspective that would eventually take me from Mumbai to Manchester to Toronto.', location: 'Mumbai, IN', coords: '19.08\u00b0N, 72.88\u00b0E', photo: '/history/mumbai-ib.jpg' },
  { year: '2016', title: 'University of Manchester', description: 'Mechanical Engineering with Nuclear Engineering. Three years of complex systems, precision thinking, and safety-first design. The engineering mindset stuck.', location: 'Manchester, UK', coords: '53.48\u00b0N, 2.24\u00b0W', photo: '/history/manchester-1.jpg' },
  { year: '2019', title: 'GATE Preparation', description: 'Prepared for the Graduate Aptitude Test in Engineering. Then a global pandemic changed the plan entirely.', location: 'Mumbai, IN', coords: '19.08\u00b0N, 72.88\u00b0E', photo: '/history/mumbai-1.jpg' },
  { year: '2020', title: 'The Pivot', description: 'COVID shut down the world. Pivoted from engineering to software development. Started with Python for data science and algorithmic trading.', location: 'Mumbai, IN', coords: '19.08\u00b0N, 72.88\u00b0E', photo: '/history/mumbai-2.jpg' },
  { year: '2020', title: 'First Software Role', description: 'Joined DUIT.io. Built a fintech analytics platform on Google Cloud. Led a team of three. Cut decision-making latency by 67%.', location: 'Remote', coords: '\u2014', photo: '/history/remote-work.jpg' },
  { year: '2021', title: 'Graduate Certificates in AI & Data', description: 'Durham College, Canada. Data Analytics for Business Decision Making + AI Design, Implementation & Architecture.', location: 'Oshawa, CA', coords: '43.90\u00b0N, 78.87\u00b0W', photo: '/history/durham.jpg' },
  { year: '2022', title: 'Going Deep in Enterprise', description: 'Joined ARO Inc. as an Application Developer. Promoted to Lead in 8 months. Built full-stack automation, deployed ML models, led database migration.', location: 'Toronto, CA', coords: '43.65\u00b0N, 79.38\u00b0W', photo: '/history/toronto-office.jpg' },
  { year: '2024', title: 'First Startup & Consulting', description: 'Co-founded Pinhous \u2014 my first real startup. Led product and engineering simultaneously. Also started Create Club to help other founders ship their products.', location: 'Toronto, CA', coords: '43.65\u00b0N, 79.38\u00b0W', photo: '/history/toronto-1.jpg' },
  { year: '2025', title: 'Learning from Failure', description: "Pinhous didn't work out. A real estate startup where I led 12 developers, built the AWS/Docker pipeline, and learned that shipping an imperfect product beats perfecting one that never launches.", location: 'Toronto, CA', coords: '43.65\u00b0N, 79.38\u00b0W', photo: '/history/toronto-2.jpg' },
  { year: '2025', title: 'Building & Shipping', description: 'Co-founded ARK Experiences \u2014 built the full-stack event platform from scratch (React, Next.js, Node.js, PostgreSQL). Running Create Club simultaneously \u2014 shipping production apps for startups across Toronto and Silicon Valley. Launched Stella 56 Diamonds.', location: 'Toronto, CA', coords: '43.65\u00b0N, 79.38\u00b0W', photo: '/history/toronto-3.jpg' },
]

function BoldEntry({ entry, index }: { entry: (typeof timelineData)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const num = String(index + 1).padStart(2, '0')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el) } }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.04}s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.04}s`,
      }}
    >
      {/* Desktop */}
      <div
        className="hidden md:grid cursor-default"
        style={{ gridTemplateColumns: '140px 48px 1fr 260px' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Year — LARGE */}
        <div className="pt-5 text-right pr-4">
          <div
            className="text-3xl font-bold tabular-nums transition-colors duration-200"
            style={{
              fontFamily: "'Sora', sans-serif",
              color: hovered ? 'rgb(var(--primary))' : 'rgb(var(--foreground))',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {entry.year}
          </div>
          <div className="text-[9px] mt-1.5 tracking-wider font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))', opacity: 0.4 }}>
            {entry.coords}
          </div>
        </div>

        {/* Timeline — thick */}
        <div className="flex flex-col items-center">
          <div
            className="w-[10px] h-[10px] rounded-full mt-6 flex-shrink-0 transition-all duration-200"
            style={{
              background: hovered ? 'rgb(var(--primary))' : 'rgb(var(--foreground))',
              boxShadow: hovered ? '0 0 0 4px rgb(var(--primary) / 0.15)' : 'none',
            }}
          />
          <div className="flex-1" style={{ width: '3px', background: 'rgb(var(--border))' }} />
        </div>

        {/* Content */}
        <div className="pt-4 pb-20 pl-5">
          {/* Location */}
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgb(var(--muted-foreground))', opacity: 0.5 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-[10px] font-medium tracking-wide" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
              {entry.location}
            </span>
          </div>

          {/* Number + Title */}
          <div className="flex items-baseline gap-3 mb-3">
            <span
              className="text-[11px] font-bold tabular-nums transition-colors duration-200"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: hovered ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))' }}
            >
              {num}
            </span>
            <h3
              className="text-xl font-semibold tracking-tight"
              style={{ fontFamily: "'Sora', sans-serif", color: 'rgb(var(--foreground))', letterSpacing: '-0.02em' }}
            >
              <span className="relative">
                {entry.title}
                <span className="absolute bottom-[-2px] left-0 h-[2px] transition-all duration-300" style={{ width: hovered ? '100%' : '0%', background: 'rgb(var(--primary))' }} />
              </span>
            </h3>
          </div>

          {/* Description */}
          <p className="text-[12px] leading-[1.8] max-w-lg" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
            {entry.description}
          </p>
        </div>

        {/* Image column — bold presentation */}
        <div className="pt-4 pl-4">
          <div
            className="overflow-hidden relative"
            style={{
              height: '170px',
              opacity: hovered ? 1 : 0,
              transform: hovered ? 'translateX(0)' : 'translateX(16px)',
              transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              background: 'rgb(var(--muted))',
            }}
          >
            <img src={entry.photo} alt={entry.title} className="w-full h-full object-cover" style={{ filter: 'grayscale(20%)' }} />
            {/* Primary accent edge */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'rgb(var(--primary))' }} />
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden pb-14">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgb(var(--foreground))' }} />
          <span className="text-xl font-bold tabular-nums" style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '-0.04em' }}>{entry.year}</span>
          <span className="text-[10px] font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>{entry.location}</span>
        </div>
        <div className="pl-5 ml-[3px]" style={{ borderLeft: '3px solid rgb(var(--border))' }}>
          <h3 className="text-base font-semibold mb-1 tracking-tight" style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '-0.02em' }}>
            <span className="text-[10px] font-bold mr-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>{num}</span>
            {entry.title}
          </h3>
          <p className="text-[11px] leading-[1.75]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>{entry.description}</p>
        </div>
      </div>
    </div>
  )
}

const current2026 = {
  year: '2026',
  title: 'Looking for What\u2019s Next',
  line1: 'Full-Stack AI Developer · AI Product Manager',
  line2: 'Vector search & app workflows — web and iOS',
  location: 'Toronto, CA',
  coords: '43.65\u00b0N, 79.38\u00b0W',
}

export default function HistoryPage() {
  const [heroVisible, setHeroVisible] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const pastHeroRef = useRef(false)
  const reachedEndRef = useRef(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [inlineRevealed, setInlineRevealed] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setHeroVisible(true) }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Single observer: hero out of view = show banner, end in view = hide banner + reveal inline
  useEffect(() => {
    const heroEl = heroRef.current
    const endEl = endRef.current
    if (!heroEl || !endEl) return

    const updateBanner = () => {
      setBannerVisible(pastHeroRef.current && !reachedEndRef.current)
    }

    const heroObs = new IntersectionObserver(([e]) => {
      pastHeroRef.current = !e.isIntersecting
      updateBanner()
    }, { threshold: 0 })

    const endObs = new IntersectionObserver(([e]) => {
      reachedEndRef.current = e.isIntersecting
      if (e.isIntersecting) setInlineRevealed(true)
      updateBanner()
    }, { threshold: 0.1 })

    heroObs.observe(heroEl)
    endObs.observe(endEl)
    return () => { heroObs.disconnect(); endObs.disconnect() }
  }, [])

  return (
    <section className="w-full min-h-screen" style={{ color: 'rgb(var(--foreground))' }}>
      {/* Hero — BOLD */}
      <div
        ref={heroRef}
        className="flex flex-col justify-center items-center text-center min-h-[60vh] mb-12 md:mb-20"
        style={{
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h1
          className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter mb-6"
          style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '-0.06em', lineHeight: 0.9 }}
        >
          HISTORY
        </h1>

        <p className="text-[12px] max-w-md leading-relaxed mb-4" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
          From nuclear engineering to shipping software — through pivots, failures, and a lot of building.
        </p>

        {/* Bold stats */}
        <div className="flex gap-8 mt-4 mb-10">
          {[{ v: '03', l: 'COUNTRIES' }, { v: '10+', l: 'PRODUCTS' }, { v: '05+', l: 'YEARS' }].map(s => (
            <div key={s.l} className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '-0.03em' }}>{s.v}</div>
              <div className="text-[8px] tracking-[0.2em] font-medium mt-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <div className="flex flex-col items-center gap-2" style={{ color: 'rgb(var(--muted-foreground))', opacity: 0.35, animation: 'boldBob 2.5s ease-in-out infinite' }}>
          <span className="text-[9px] tracking-[0.2em] uppercase font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Scroll</span>
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 2v14M7 16l5-5M7 16l-5-5" /></svg>
        </div>
      </div>

      {/* Thick divider */}
      <div className="h-[3px] w-full mb-10" style={{ background: 'rgb(var(--foreground))' }} />

      {/* Timeline */}
      <div className="max-w-6xl pb-8">
        {timelineData.map((entry, index) => (
          <BoldEntry key={index} entry={entry} index={index} />
        ))}

        {/* 2026 inline entry — revealed when user scrolls to end */}
        <div
          ref={endRef}
          style={{
            opacity: inlineRevealed ? 1 : 0,
            transform: inlineRevealed ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Desktop 2026 */}
          <div className="hidden md:grid" style={{ gridTemplateColumns: '140px 48px 1fr 260px' }}>
            <div className="pt-5 text-right pr-4">
              <div
                className="text-3xl font-bold tabular-nums"
                style={{ fontFamily: "'Sora', sans-serif", color: 'rgb(var(--primary))', letterSpacing: '-0.04em', lineHeight: 1 }}
              >
                {current2026.year}
              </div>
              <div className="text-[9px] mt-1.5 tracking-wider font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))', opacity: 0.4 }}>
                {current2026.coords}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div
                className="w-[10px] h-[10px] rounded-full mt-6 flex-shrink-0"
                style={{ background: 'rgb(var(--primary))', boxShadow: '0 0 0 4px rgb(var(--primary) / 0.15)' }}
              />
              <div className="flex-1" style={{ width: '3px', background: 'rgb(var(--border))' }} />
            </div>
            <div className="pt-4 pb-14 pl-5">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-[11px] font-bold tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--primary))' }}>
                  {String(timelineData.length + 1).padStart(2, '0')}
                </span>
                <h3 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif", color: 'rgb(var(--foreground))', letterSpacing: '-0.02em' }}>
                  <span className="relative">
                    {current2026.title}
                    <span className="absolute bottom-[-2px] left-0 h-[2px]" style={{ width: '100%', background: 'rgb(var(--primary))' }} />
                  </span>
                </h3>
              </div>
              <p className="text-[12px] leading-[1.8]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
                {current2026.line1}
              </p>
              <p className="text-[12px] leading-[1.8]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
                {current2026.line2}
              </p>
            </div>
            <div />
          </div>

          {/* Mobile 2026 */}
          <div className="md:hidden pb-14">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgb(var(--primary))' }} />
              <span className="text-xl font-bold tabular-nums" style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '-0.04em', color: 'rgb(var(--primary))' }}>{current2026.year}</span>
              <span className="text-[10px] font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>{current2026.location}</span>
            </div>
            <div className="pl-5 ml-[3px]" style={{ borderLeft: '3px solid rgb(var(--border))' }}>
              <h3 className="text-base font-semibold mb-1 tracking-tight" style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '-0.02em' }}>
                <span className="text-[10px] font-bold mr-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--primary))' }}>{String(timelineData.length + 1).padStart(2, '0')}</span>
                {current2026.title}
              </h3>
              <p className="text-[11px] leading-[1.75]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>{current2026.line1}</p>
              <p className="text-[11px] leading-[1.75]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>{current2026.line2}</p>
            </div>
          </div>
        </div>

        {/* NOW node */}
        <div className="hidden md:grid pb-16" style={{ gridTemplateColumns: '140px 48px 1fr 260px' }}>
          <div />
          <div className="flex justify-center"><div className="w-3 h-3 rounded-full" style={{ background: 'rgb(var(--primary))' }} /></div>
          <div className="pl-5">
            <span className="text-[10px] tracking-[0.15em] uppercase font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--primary))' }}>Now</span>
          </div>
          <div />
        </div>

        {/* Mobile NOW */}
        <div className="md:hidden pb-14">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'rgb(var(--primary))' }} />
            <span className="text-[10px] tracking-[0.15em] uppercase font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--primary))' }}>Now</span>
          </div>
        </div>
      </div>

      {/* Frozen bottom banner — visible after scrolling past hero, hidden when 2026 is inline */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
        style={{
          opacity: bannerVisible ? 1 : 0,
          transform: bannerVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="pointer-events-auto"
          style={{
            background: 'linear-gradient(to top, rgb(var(--background)) 60%, rgb(var(--background) / 0))',
            paddingTop: '48px',
          }}
        >
          <div className="max-w-7xl mx-auto w-full px-4 md:px-8">
          <div className="max-w-6xl pb-6">
            {/* Desktop banner */}
            <div className="hidden md:grid" style={{ gridTemplateColumns: '140px 48px 1fr 260px' }}>
              <div className="text-right pr-4">
                <div
                  className="text-2xl font-bold tabular-nums"
                  style={{ fontFamily: "'Sora', sans-serif", color: 'rgb(var(--primary))', letterSpacing: '-0.04em', lineHeight: 1 }}
                >
                  2026
                </div>
              </div>
              <div className="flex justify-center">
                <div
                  className="w-[10px] h-[10px] rounded-full flex-shrink-0"
                  style={{
                    background: 'rgb(var(--primary))',
                    boxShadow: '0 0 0 4px rgb(var(--primary) / 0.15)',
                    animation: 'bannerPulse 2s ease-in-out infinite',
                  }}
                />
              </div>
              <div className="pl-5">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-[11px] font-bold tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--primary))' }}>
                    {String(timelineData.length + 1).padStart(2, '0')}
                  </span>
                  <span className="text-base font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif", color: 'rgb(var(--foreground))', letterSpacing: '-0.02em' }}>
                    {current2026.title}
                  </span>
                </div>
                <p className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
                  {current2026.line1}
                </p>
                <p className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
                  {current2026.line2}
                </p>
              </div>
              <div />
            </div>

            {/* Mobile banner */}
            <div className="md:hidden">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: 'rgb(var(--primary))', animation: 'bannerPulse 2s ease-in-out infinite' }}
                />
                <span className="text-lg font-bold tabular-nums" style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '-0.04em', color: 'rgb(var(--primary))' }}>2026</span>
                <span className="text-sm font-semibold" style={{ fontFamily: "'Sora', sans-serif", color: 'rgb(var(--foreground))' }}>{current2026.title}</span>
              </div>
              <p className="pl-5 ml-[3px] text-[10px] leading-[1.6]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgb(var(--muted-foreground))' }}>
                {current2026.line1}<br />{current2026.line2}
              </p>
            </div>
          </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes boldBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @keyframes bannerPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgb(var(--primary) / 0.15); }
          50% { box-shadow: 0 0 0 8px rgb(var(--primary) / 0.08); }
        }
      `}</style>
    </section>
  )
}
