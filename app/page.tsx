'use client'

import { PortfolioCarousel } from 'app/components/portfolio-carousel'
import { TechnologyCarousel, extractUniqueTechnologies } from 'app/components/technology-carousel'
import { portfolioProjects } from '@/app/lib/projects'

export default function Page() {
  const uniqueTechnologies = extractUniqueTechnologies(portfolioProjects)

  return (
    <>
      <section className="w-full">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tighter mb-4">
            I build experiences—both digital and physical—for humans.
          </h1>
          <p className="mb-4 font-semibold" style={{ color: 'rgb(var(--foreground))' }}>
            Full-Stack Engineer · Product Thinker · Builder
          </p>
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            4+ years shipping web applications from zero to production. I write the code, think about the user, and care about the business outcome. My stack is React, TypeScript, Next.js, Node.js, Python, and PostgreSQL—and lately I've been deep in AI agents and LLM workflows.
          </p>
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            I've shipped 10+ products across startups in Toronto and Silicon Valley. From event platforms to AI-powered tools to e-commerce. I don't just write features—I ask why we're building them, ship fast, measure what matters, and iterate.
          </p>
          <p className="mb-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Open to Full-Stack / AI Developer roles at high-growth startups. Toronto or remote across North America.
          </p>
        </div>

        {/* What I Build Section */}
        <div className="mb-8">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4">What I Build</h2>
          <ul className="space-y-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <li>• <strong>Full-stack applications</strong> — React/Next.js frontends, Node.js/Python backends, PostgreSQL databases. Auth flows, payment integration, real-time features. I ship the whole stack.</li>
            <li>• <strong>AI-native features</strong> — LLM integrations, AI agents, prompt engineering, workflow automation. I know when AI adds real value and when it's just a buzzword.</li>
            <li>• <strong>Infrastructure that doesn't break at 3am</strong> — Docker, AWS, CI/CD pipelines, Vercel, Cloudflare. I care about what happens after deploy: monitoring, reliability, and keeping things boring in the best way.</li>
            <li>• <strong>Product-aware code</strong> — I talk to users before writing a line of code. Every feature ships with a "why," success metrics, and a plan to iterate.</li>
          </ul>
        </div>

        <TechnologyCarousel technologies={uniqueTechnologies} />
        <PortfolioCarousel projects={portfolioProjects.map(p => ({
          id: p.id,
          title: p.shortTitle,
          url: p.url,
          video: p.video,
          shortDescription: p.shortDescription,
          technologies: p.technologies,
        }))} />

        {/* What I've Shipped Recently Section */}
        <div className="mt-12 mb-8">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4">What I've Shipped Recently</h2>
          <ul className="space-y-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <li>• <strong>Zero to production, fast</strong> — Shipped ARK Experiences' full platform in under 3 weeks. React/Next.js frontend, Node.js/PostgreSQL backend, automated workflows. Customer satisfaction jumped from 4.0 to 4.8 stars.</li>
            <li>• <strong>AI integration with taste</strong> — Built Penguin Mail's LLM-based email filtering and Bridger's AI image generation. Balanced cost, latency, and UX—not just "slap an API on it."</li>
            <li>• <strong>Team leadership</strong> — Led 12 developers at Pinhous. Built the AWS/Docker deployment pipeline, ran code reviews, and cut deploy time from 2 hours to 15 minutes.</li>
            <li>• <strong>Client delivery at scale</strong> — Through Create Club, shipped 10+ production apps for clients across Toronto and Silicon Valley. Full lifecycle: requirements → architecture → deploy → iterate.</li>
          </ul>
        </div>

        {/* Skills Section */}
        <div className="mb-8">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4">Skills</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>Engineering</h3>
              <ul className="space-y-1 text-sm">
                <li>• Next.js, TypeScript</li>
                <li>• React, Node.js, Express.js</li>
                <li>• Python, PostgreSQL, MongoDB</li>
                <li>• Docker, AWS, CI/CD</li>
                <li>• Supabase, Convex, Vercel</li>
                <li>• Stripe, Cloudflare</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>AI & Automation</h3>
              <ul className="space-y-1 text-sm">
                <li>• LLMs (OpenAI, Gemini, Claude)</li>
                <li>• AI Agents, LangChain</li>
                <li>• Prompt engineering</li>
                <li>• Vector search & embeddings</li>
                <li>• Workflow automation</li>
                <li>• Analytics (PostHog, GA)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>Product Thinking</h3>
              <ul className="space-y-1 text-sm">
                <li>• User research & interviews</li>
                <li>• Roadmapping & specs</li>
                <li>• A/B testing & experimentation</li>
                <li>• KPI definition & dashboards</li>
                <li>• JTBD framework</li>
                <li>• SQL & data analysis</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>Collaboration</h3>
              <ul className="space-y-1 text-sm">
                <li>• Async-first communication</li>
                <li>• Working directly with founders</li>
                <li>• Shipping on startup timelines</li>
                <li>• Code reviews & mentorship</li>
                <li>• Cross-functional teamwork</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Pilot Project Offer Section */}
        <div className="mb-8 p-6 rounded-lg border-2" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--primary))' }}>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-3">Want proof before you hire?</h2>
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            I believe the best way to evaluate a developer is to watch them build. That's why I offer a 1-week pilot project for any company I'm seriously interested in joining.
          </p>
          <p className="mb-2 font-medium" style={{ color: 'rgb(var(--foreground))' }}>Here's how it works:</p>
          <ul className="space-y-1 mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            <li>→ 30-minute call to pick a feature or backlog item</li>
            <li>→ I build it in one week, using your stack</li>
            <li>→ You evaluate the code, the thinking, and the output</li>
            <li>→ If it's a fit, we talk full-time. If not, the code is yours. No strings.</li>
          </ul>
          <p className="font-semibold" style={{ color: 'rgb(var(--foreground))' }}>No risk. Just results.</p>
        </div>

        {/* Currently Building Section */}
        <div className="mb-8 p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--card))' }}>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-3">Currently building</h2>
          <p className="mb-3 font-medium" style={{ color: 'rgb(var(--foreground))' }}>
            Full-Stack Engineer · AI Developer · Product Engineer
          </p>
          <p className="mb-3" style={{ color: 'rgb(var(--muted-foreground))' }}>
            At Series B/C startups and AI-native companies that ship fast, care about craft, and measure impact over hours logged.
          </p>
          <p className="mb-4" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Toronto (onsite/hybrid) · Remote across North America
          </p>
          <p className="text-sm" style={{ color: 'rgb(var(--muted-foreground))' }}>
            Let's talk → <a href="https://linkedin.com/in/raj-dholakia" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70">LinkedIn</a> · <a href="mailto:raj9dholakia@gmail.com" className="underline hover:opacity-70">raj9dholakia@gmail.com</a>
          </p>
        </div>
      </section>
    </>
  )
}
