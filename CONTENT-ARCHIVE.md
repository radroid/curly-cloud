# CONTENT ARCHIVE

Comprehensive content archive of the portfolio website at `curlycloud.dev` prior to major redesign.
Archived on 2026-04-01.

---

## Table of Contents

1. [Personal Info & Identity](#personal-info--identity)
2. [Homepage Content](#homepage-content)
3. [Boot Sequence](#boot-sequence)
4. [Projects (All 5)](#projects-all-5)
5. [Blog Posts (Full MDX)](#blog-posts-full-mdx)
6. [History / Timeline](#history--timeline)
7. [Nav & Footer](#nav--footer)
8. [Theme System (All 4 Themes with Variables)](#theme-system-all-4-themes-with-variables)
9. [SEO & Metadata](#seo--metadata)
10. [Technical Config](#technical-config)

---

## Personal Info & Identity

- **Name:** Raj
- **Job Title (schema.org):** Software Engineer & Entrepreneur
- **Base URL:** https://curlycloud.dev
- **Email:** raj9dholakia@gmail.com
- **Location:** Toronto, CA (Remote across North America)
- **Avatar:** `/raj-avatar.webp`
- **Cal.com link:** `createclub/problem-ranter` (namespace: `problem-ranter`)
- **Google Maps link:** https://maps.app.goo.gl/eWDPAqVgfkHyWv4T9

### Social Links

| Platform       | URL                                        |
| -------------- | ------------------------------------------ |
| X (Twitter)    | https://x.com/curlycloud__                 |
| GitHub         | https://github.com/radroid                 |
| LinkedIn       | https://linkedin.com/in/raj-dholakia       |

### JSON-LD (Person)

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Raj",
  "url": "https://curlycloud.dev",
  "jobTitle": "Software Engineer & Entrepreneur",
  "sameAs": [
    "https://x.com/curlycloud__",
    "https://github.com/radroid",
    "https://linkedin.com/in/raj-dholakia"
  ]
}
```

---

## Homepage Content

Source: `app/page.tsx` (client component, `'use client'`)

### Hero Section

**Status badge:** "Available for hire"

**Heading:**
```
I build experiences
digital & physical
for humans.
```

**Sub-heading:**
> Full-stack engineer with 4+ years shipping web applications from zero to production. I write the code, think about the user, and care about the business outcome.

### Hero Stats

| Value | Suffix | Label      |
| ----- | ------ | ---------- |
| 10    | +      | Products   |
| 4     | +      | Years      |
| 12    |        | Devs Led   |

### Hero Tech Marquee

**Row 1 (scrolls left):**
Next.js, React, TypeScript, Tailwind, Node.js, PostgreSQL, Docker, AWS, Vercel, Stripe, shadcn/ui, Motion, Three.js, HTML5

**Row 2 (scrolls right):**
OpenAI, Claude, Gemini, LangChain, Cloudflare, Supabase, Convex, Express, Clerk, GCP, DigitalOcean, Radix UI, PostHog

### About Section

**Label badge:** "About"

**Left column:**
> My stack is React, TypeScript, Next.js, Node.js, Python, and PostgreSQL--and lately I've been deep in AI agents and LLM workflows.

**Right column:**
> I've shipped 10+ products across startups in Toronto and Silicon Valley. From event platforms to AI-powered tools to e-commerce.

**Status indicator:** Green dot, pulsing
> Toronto . Remote across North America

### Selected Works

Section heading: "Selected Works"

Renders a `PortfolioCarousel` component showing all 5 projects with shortTitle, url, video, shortDescription, and technologies.

### What I Build (4 Tilt Cards)

| #  | Title                    | Description                                                                                                                          |
| -- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 01 | Full-stack applications  | React/Next.js frontends, Node.js/Python backends, PostgreSQL databases. Auth flows, payment integration, real-time features.         |
| 02 | AI-native features       | LLM integrations, AI agents, prompt engineering, workflow automation. I know when AI adds real value vs. buzzword.                    |
| 03 | Infrastructure           | Docker, AWS, CI/CD pipelines, Vercel, Cloudflare. Monitoring, reliability, and keeping things boring in the best way.                |
| 04 | Product-aware code       | I talk to users before writing a line. Every feature ships with a "why," success metrics, and a plan to iterate.                     |

### Toolkit Section

Section heading: "Toolkit"

#### Tech Stack Icon Grid (4 categories)

**Frontend:**
Next.js, React, TypeScript, Tailwind, shadcn/ui, Radix UI, Motion, HTML5, Three.js

**Backend & Data:**
Node.js, Express, PostgreSQL, Supabase, Convex, Stripe, Clerk

**AI & ML:**
OpenAI, Gemini, Claude, LangChain, PostHog

**Infrastructure:**
Docker, AWS, GCP, Cloudflare, Vercel, DigitalOcean

#### Product Thinking Skills

- User research & interviews
- Roadmapping & specs
- A/B testing & experimentation
- KPI dashboards
- JTBD framework
- SQL & data analysis

#### Collaboration Skills

- Async-first communication
- Working directly with founders
- Shipping on startup timelines
- Code reviews & mentorship
- Cross-functional teamwork

### Pilot CTA Section

**Badge:** "Zero Risk Offer" (with pulsing white dot)

**Heading:**
> Want proof before you hire?

**Body:**
> I offer a 1-week pilot project for any company I'm seriously interested in joining. 30-min call, I build it in one week, you evaluate. No risk, just results.

**Primary CTA button:** "Let's Talk" (opens Cal.com modal at `createclub/problem-ranter`, layout: `month_view`)

**Secondary CTA:** "Email Me" (mailto:raj9dholakia@gmail.com)

---

## Boot Sequence

Source: `app/page.tsx`, `BootSequence` component

Displayed on first visit per session (stored in `sessionStorage` as `bootDone`). Overlay with blurred background at z-index 80.

**Steps (shown sequentially with typing animation):**

```
raj --version 4.0                           (delay: 120ms)
Loading modules...                          (delay: 180ms)
  -> frontend: React, Next.js, TypeScript   (delay: 100ms)
  -> backend: Node.js, Python, PostgreSQL   (delay:  80ms)
  -> ai: LLMs, Agents, LangChain           (delay: 100ms)
  -> infra: Docker, AWS, Cloudflare         (delay:  80ms)
All systems operational. Ready.             (delay: 120ms)
```

Each line starts with an empty circle (loading) that fills to a solid dot (done) in the primary color. A blinking cursor appears at the bottom while lines are still loading. Fades out 200ms after completion.

If `prefers-reduced-motion` is set, all lines appear instantly with "done" status.

---

## Projects (All 5)

Source: `app/lib/projects.ts`

### PortfolioProject Interface

```typescript
interface PortfolioProject {
  id: string
  title: string
  shortTitle: string
  url: string
  video?: string
  shortDescription: string
  description: string
  role: string
  problem?: string
  aiComponent?: string
  productDecisions?: string[]
  impact?: string[]
  technologies: string[]
}
```

### Project 1: Penguin Mail

- **id:** `penguin-mail`
- **title:** Penguin Mail -- AI-first email client
- **shortTitle:** Penguin Mail
- **url:** https://www.penguinmail.app/
- **video:** `https://videos.curlycloud.dev/penguin mail landing.mov`
- **shortDescription:** AI-powered email client. LLM-based filtering that understands natural language rules -- not just keywords.
- **role:** Product Lead & Builder
- **problem:** Knowledge workers drown in low-value email; most clients treat all messages the same, forcing users to manually triage updates, promotions, and real conversations.
- **description:** Led product discovery, defined AI-powered filtering concepts, wrote specs, and built the v1 prototype (Next.js, TypeScript, AI APIs).
- **aiComponent:** Designed an AI filter where users describe their ideal inbox in natural language; system translates this into routing rules and classification prompts. Evaluated LLM providers, latency trade-offs, and fallback rules.
- **productDecisions:**
  1. Segmented email into Conversations / Notifications / Bulk based on intent instead of folder rules.
  2. Scoped MVP to a Gmail-connected web app with a single "training" surface to avoid overwhelming onboarding.
- **impact:**
  1. Ran 10 user interviews with heavy email users; 8/10 preferred the "conversation-only inbox" view conceptually.
- **technologies:** Google Gemini, Langchain, Google Cloud, Docker, Next.js, TypeScript

### Project 2: ARK Experience

- **id:** `ark-experience`
- **title:** ARK Experience -- IRL team-building game
- **shortTitle:** ARK Experience
- **url:** https://www.funwithark.ca/
- **video:** `https://videos.curlycloud.dev/ARK experiences.mov`
- **shortDescription:** Full-stack event platform. Location-based puzzle experiences with automated operations, reducing manual work by 80%.
- **role:** Co-founder, Product & Ops
- **problem:** Teams wanted memorable group experiences, not another generic tour.
- **description:** Designed a location-based puzzle experience with narrative, constraints (2 hours, walkable downtown), and repeatable operations.
- **productDecisions:**
  1. Structured the 7-step customer journey from discovery to completion.
  2. Tested clue difficulty through multiple iterations.
  3. Optimized route based on feedback and completion times.
- **impact:**
  1. Multiple cohorts run with high satisfaction ratings.
  2. Repeat bookings and B2B clients.
- **technologies:** Next.js 15, React 19, TypeScript 5, Convex, Clerk, Tailwind CSS 4, shadcn/ui, Framer Motion, A-Frame, AR.js, Kibo UI, Lucide React, next-themes, next-pwa, Service Workers, react-dropzone, sonner, cmdk, class-variance-authority, HTML5, Vercel, Supabase

### Project 3: Bridger

- **id:** `bridger`
- **title:** Bridger -- AI image generation SaaS
- **shortTitle:** Bridger
- **url:** https://bridger.atawalk.ca/
- **video:** `https://videos.curlycloud.dev/Atawalk Bridges.mov`
- **shortDescription:** AI image generation tool. Custom bridge designs with subscription tiers -- from idea to live production app with Stripe billing.
- **role:** Product + Engineering
- **problem:** Users wanted to generate custom bridge images but existing tools lacked specialized prompts and pricing models.
- **description:** AI-powered image generation tool for custom bridge designs. Defined plans and pricing based on image-generation cost models, chose image model and prompt strategy, iterated on prompt presets with early users.
- **aiComponent:** Chose image model, prompt strategy, and safety constraints; iterated on prompt presets with early users. Defined plans and pricing based on image-generation cost models.
- **productDecisions:**
  1. Built end-to-end from idea -> scoped MVP -> pricing tiers -> live production app with subscription plans.
  2. Integrated PostHog for analytics to track conversion and usage patterns.
- **impact:**
  1. Live production app with subscription plans.
- **technologies:** Next.js 15, React 19, TypeScript, Tailwind CSS, Node.js, Express.js, PostgreSQL, Clerk, Stripe, Radix UI, Framer Motion, React Hook Form, Zod, Next Themes, Leonardo AI, PostHog, Nodemailer, Lucide React, Sonner, React Icons, Helmet, Express Rate Limiting, CORS, JWT, Multer, ChatGPT, Digital Ocean

### Project 4: Stella 56 Diamonds

- **id:** `stella56`
- **title:** Stella 56 Diamonds -- E-commerce platform
- **shortTitle:** Stella 56 Diamonds
- **url:** https://www.stella56diamonds.com/
- **video:** `https://videos.curlycloud.dev/Stella 56 Diamonds.mov`
- **shortDescription:** E-commerce platform. Manufacturer-direct lab-grown diamonds with custom product catalog and inventory management.
- **role:** Product + Engineering
- **problem:** Consumers wanted transparent, ethical diamond options with certification and detailed product information.
- **description:** Manufacturer-direct lab-grown diamonds platform. Led product development, defined user flows for diamond selection and certification, integrated AI for product recommendations, and built analytics dashboards to track conversion and engagement.
- **aiComponent:** Integrated AI for product recommendations based on user preferences and browsing behavior.
- **productDecisions:**
  1. Defined user flows for diamond selection and certification.
  2. Built analytics dashboards to track conversion and engagement.
- **impact:**
  1. Live e-commerce platform with IGI/GIA-certified diamonds.
- **technologies:** Next.js 15, React 19, TypeScript 5.9, Tailwind CSS 4.1, Shadcn/ui, Framer Motion, Radix UI, Motion, Motion One, Three.js, React Hook Form, Zod, Hookform Resolvers, Lucide React, Recharts, TSParticles, Next Themes, Sonner, Vaul, Biome, Cloudflare, Claude AI

### Project 5: Playground

- **id:** `playground`
- **title:** Playground -- Developer tool
- **shortTitle:** Playground
- **url:** https://playground.createplus.club/
- **video:** `https://videos.curlycloud.dev/Playground CN.mov`
- **shortDescription:** Ship UI faster. Design, tweak, and copy Shadcn components with instant previews and live code editing.
- **role:** Product + Engineering
- **problem:** Developers wanted a faster way to browse, customize, and copy Shadcn components without setting up local environments.
- **description:** Design, tweak, and copy Shadcn components with instant previews. Defined the component library structure, prioritized features based on developer feedback, and built the live editing experience with code export functionality.
- **productDecisions:**
  1. Defined the component library structure for easy navigation.
  2. Prioritized features based on developer feedback.
  3. Built the live editing experience with code export functionality.
- **impact:**
  1. Live tool for developers to quickly prototype with Shadcn components.
- **technologies:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Shadcn UI, Sandpack, Radix UI, Lucide React, Motion, React Hook Form, Zod, @hookform/resolvers, Recharts, Embla Carousel, Sonner, Vaul, CMDK, React Resizable Panels, next-themes, clsx, tailwind-merge, class-variance-authority, date-fns, JSZip

---

## Blog Posts (Full MDX)

Source: `app/blog/posts/index.ts`, individual `.mdx` files

### Post Registration System

Posts are registered in `app/blog/posts/index.ts`. They use `?raw` suffix imports and a custom frontmatter parser. Posts are NOT auto-discovered.

**Registered slugs:**
1. `building-for-humans`
2. `generalism-future`
3. `physical-digital-tension`

### Blog Utilities

Source: `app/blog/utils.ts`

- `getBlogPosts()`: Returns all posts with metadata (title, publishedAt, summary, image?) and content
- `formatDate(date, includeRelative?)`: Formats dates as "Month Day, Year" with optional relative suffix ("Xd ago", "Xmo ago", "Xy ago", "Today")

---

### Post 1: Building Product for Humans, Not Metrics

- **slug:** `building-for-humans`
- **publishedAt:** 2026-01-15
- **summary:** The best products measure success by whether people grew, not just whether numbers went up.

**Full MDX content:**

```mdx
---
title: 'Building Product for Humans, Not Metrics'
publishedAt: '2026-01-15'
summary: 'The best products measure success by whether people grew, not just whether numbers went up.'
---

I measure success by whether people grew. Not by DAU, retention curves, or conversion rates--though those matter. The real question: did this product make someone's life better?

## The Metrics Trap

It's easy to optimize for numbers. A/B test button colors, gamify engagement, push notifications. But when metrics become the goal, you lose sight of the human on the other side.

## What Humans Actually Want

People want to feel capable. They want to connect. They want experiences that surprise and delight. At ARK Experiences, we didn't measure success by bookings alone--we measured it by whether people left with stories they'd tell for years.

## The Framework

Before building, ask:
1. What problem are we actually solving?
2. How will this make someone feel?
3. What's the human outcome we're optimizing for?

If you can't answer these, you're building for metrics, not humans. And metrics don't remember your product. Humans do.
```

---

### Post 2: Why Generalism is the Future

- **slug:** `generalism-future`
- **publishedAt:** 2025-02-10
- **summary:** As AI commoditizes specialists, generalists who can think across domains become the premium asset.

**Full MDX content:**

```mdx
---
title: 'Why Generalism is the Future'
publishedAt: '2025-02-10'
summary: 'As AI commoditizes specialists, generalists who can think across domains become the premium asset.'
---

The future belongs to generalists. While AI tools can now write code, design interfaces, and analyze data, they struggle to connect dots across disciplines. That's where generalists thrive.

## The Specialist Trap

Specialization made sense when knowledge was scarce. But in 2025, AI can generate boilerplate, debug common issues, and follow established patterns. The specialist who only knows React or only designs UIs is competing with tools that do their job faster and cheaper. PS: of course it makes sense,

## The Generalist Advantage

Generalists see systems, not silos. When building ARK Adventures, I didn't just code--I understood user psychology, business economics, and physical experience design. That cross-domain thinking is what creates breakthrough products.

## What This Means

By 2030, the premium will shift from "knowing React" to "understanding how React fits into a product strategy that serves humans." Generalists who can architect experiences, not just implement features, will command the highest value.

The question isn't whether you're a specialist or generalist. It's whether you can think beyond your domain and build for humans, not just metrics.
```

---

### Post 3: The Tension Between Physical & Digital

- **slug:** `physical-digital-tension`
- **publishedAt:** 2025-03-05
- **summary:** Building ARK Adventures taught me that the best experiences bridge the gap between what happens on screen and what happens in real life.

**Full MDX content:**

```mdx
---
title: 'The Tension Between Physical & Digital'
publishedAt: '2025-03-05'
summary: 'Building ARK Adventures taught me that the best experiences bridge the gap between what happens on screen and what happens in real life.'
---

There's a gap between digital products and lived experiences. Most builders live in one world or the other. The magic happens in the bridge.

## Two Worlds

Digital products scale infinitely. Physical experiences create memories. Most companies pick one: either you're a software company or an experience company. But the future belongs to those who merge both.

## What I Learned at ARK

Building ARK Adventures forced me to think about both sides. The booking flow had to be frictionless (digital), but the actual adventure had to be unforgettable (physical). The product wasn't the app--it was the entire journey from discovery to memory.

## The Bridge

The best products don't just live on your phone. They enhance what happens when you put it down. Whether it's a travel app that makes you want to explore, or a fitness tracker that changes how you move, the goal is the same: make the digital serve the physical.

That's where the real innovation happens--not in pixels, but in the moments between.
```

---

## History / Timeline

Source: `app/history/page.tsx` (client component, `'use client'`)

### Hero

**Title:** HISTORY

**Subtitle:**
> From nuclear engineering to shipping software -- through pivots, failures, and a lot of building.

**Stats:**

| Value | Label     |
| ----- | --------- |
| 03    | COUNTRIES |
| 10+   | PRODUCTS  |
| 05+   | YEARS     |

**Scroll cue:** "Scroll" with down arrow animation

### Timeline Entries (10 entries)

#### Entry 01 -- 2014: International Baccalaureate
- **Location:** Mumbai, IN
- **Coords:** 19.08 N, 72.88 E
- **Photo:** `/history/mumbai-ib.jpg`
- **Description:** Foundation years. Rigorous academics and the beginning of a global perspective that would eventually take me from Mumbai to Manchester to Toronto.

#### Entry 02 -- 2016: University of Manchester
- **Location:** Manchester, UK
- **Coords:** 53.48 N, 2.24 W
- **Photo:** `/history/manchester-1.jpg`
- **Description:** Mechanical Engineering with Nuclear Engineering. Three years of complex systems, precision thinking, and safety-first design. The engineering mindset stuck.

#### Entry 03 -- 2019: GATE Preparation
- **Location:** Mumbai, IN
- **Coords:** 19.08 N, 72.88 E
- **Photo:** `/history/mumbai-1.jpg`
- **Description:** Prepared for the Graduate Aptitude Test in Engineering. Then a global pandemic changed the plan entirely.

#### Entry 04 -- 2020: The Pivot
- **Location:** Mumbai, IN
- **Coords:** 19.08 N, 72.88 E
- **Photo:** `/history/mumbai-2.jpg`
- **Description:** COVID shut down the world. Pivoted from engineering to software development. Started with Python for data science and algorithmic trading.

#### Entry 05 -- 2020: First Software Role
- **Location:** Remote
- **Coords:** (em dash)
- **Photo:** `/history/remote-work.jpg`
- **Description:** Joined DUIT.io. Built a fintech analytics platform on Google Cloud. Led a team of three. Cut decision-making latency by 67%.

#### Entry 06 -- 2021: Graduate Certificates in AI & Data
- **Location:** Oshawa, CA
- **Coords:** 43.90 N, 78.87 W
- **Photo:** `/history/durham.jpg`
- **Description:** Durham College, Canada. Data Analytics for Business Decision Making + AI Design, Implementation & Architecture.

#### Entry 07 -- 2022: Going Deep in Enterprise
- **Location:** Toronto, CA
- **Coords:** 43.65 N, 79.38 W
- **Photo:** `/history/toronto-office.jpg`
- **Description:** Joined ARO Inc. as an Application Developer. Promoted to Lead in 8 months. Built full-stack automation, deployed ML models, led database migration.

#### Entry 08 -- 2024: First Startup & Consulting
- **Location:** Toronto, CA
- **Coords:** 43.65 N, 79.38 W
- **Photo:** `/history/toronto-1.jpg`
- **Description:** Co-founded Pinhous -- my first real startup. Led product and engineering simultaneously. Also started Create Club to help other founders ship their products.

#### Entry 09 -- 2025: Learning from Failure
- **Location:** Toronto, CA
- **Coords:** 43.65 N, 79.38 W
- **Photo:** `/history/toronto-2.jpg`
- **Description:** Pinhous didn't work out. A real estate startup where I led 12 developers, built the AWS/Docker pipeline, and learned that shipping an imperfect product beats perfecting one that never launches.

#### Entry 10 -- 2025: Building & Shipping
- **Location:** Toronto, CA
- **Coords:** 43.65 N, 79.38 W
- **Photo:** `/history/toronto-3.jpg`
- **Description:** Co-founded ARK Experiences -- built the full-stack event platform from scratch (React, Next.js, Node.js, PostgreSQL). Running Create Club simultaneously -- shipping production apps for startups across Toronto and Silicon Valley. Launched Stella 56 Diamonds.

### Current / 2026 Entry (revealed on scroll)

- **Year:** 2026
- **Title:** Looking for What's Next
- **Line 1:** Full-Stack AI Developer . AI Product Manager
- **Line 2:** Vector search & app workflows -- web and iOS
- **Location:** Toronto, CA
- **Coords:** 43.65 N, 79.38 W

### NOW Node

Displayed after the 2026 entry with the label "Now" in primary color.

### Frozen Bottom Banner

A sticky banner that appears when the user scrolls past the hero and hides when the 2026 inline entry is visible. Shows the 2026 entry data with a pulsing dot animation.

---

## Nav & Footer

### Navigation

Source: `app/components/nav.tsx`

**Nav items:**

| Path      | Display Name |
| --------- | ------------ |
| `/`       | home         |
| `/history` | history     |
| `/blog`   | thinking     |

- Fixed position, z-index 40
- Uses `TextScramble` component for text display
- Active item has animated background pill via `motion.span` with `layoutId="nav-active"`
- Glassmorphism: blurred background (`blur(12px)`)
- Transitions from floating pill (rounded, fit-content) to full-width bar on scroll

### Footer

Source: `app/components/footer.tsx`

- Avatar image linking to Google Maps location
- Tooltip on avatar: "I love strawberry matcha"
- Social icons: X (Twitter), GitHub, LinkedIn (same URLs as Personal Info section)
- Copyright: `(c) {current year}` (dynamic)

---

## Theme System (All 4 Themes with Variables)

Source: `app/global.css`, `app/components/theme-provider.tsx`, `app/components/theme-switcher.tsx`

### Theme Schedule (Automatic)

| Theme     | Time Range         | Hours       |
| --------- | ------------------ | ----------- |
| Morning   | 6 AM -- 12 PM     | 6:00-11:59  |
| Afternoon | 12 PM -- 6 PM     | 12:00-17:59 |
| Night     | 6 PM -- 12 AM     | 18:00-23:59 |
| Starry    | 12 AM -- 6 AM     | 0:00-5:59   |

### Theme Switcher Behavior

- **Click:** Cycles through morning -> afternoon -> night -> starry -> morning
- **Double-click:** Resets to automatic (time-based) theme
- **localStorage key:** `theme-override`
- **Tooltip:** "Click to switch themes" (shown once, stored in `localStorage` as `theme-tooltip-seen`)
- **Position:** Fixed, bottom-left, z-index 30

### Theme Icons & Colors

| Theme     | Icon (Lucide) | Icon Color             |
| --------- | ------------- | ---------------------- |
| Morning   | Sunrise       | rgb(251, 191, 36)      |
| Afternoon | Sun           | rgb(250, 204, 21)      |
| Night     | Moon          | rgb(251, 146, 60)      |
| Starry    | Stars         | rgb(167, 139, 250)     |

### Inline Theme Script (Flash Prevention)

In `app/layout.tsx`, a blocking `<script>` runs before paint:

```javascript
(function(){
  try {
    var t = localStorage.getItem('theme-override');
    if (t && ['morning','afternoon','night','starry'].indexOf(t) !== -1) {
      document.documentElement.setAttribute('data-theme', t);
      return;
    }
    var h = new Date().getHours();
    document.documentElement.setAttribute('data-theme',
      h >= 6 && h < 12 ? 'morning' :
      h >= 12 && h < 18 ? 'afternoon' :
      h >= 18 ? 'night' : 'starry'
    );
  } catch(e) {}
})()
```

### CSS Variables (All values are space-separated RGB triplets)

#### Morning Theme (`html[data-theme='morning']`)

```
--background:           224 242 254
--foreground:           15 23 42
--card:                 255 255 255
--card-foreground:      15 23 42
--popover:              255 255 255
--popover-foreground:   15 23 42
--primary:              245 158 11
--primary-foreground:   255 255 255
--secondary:            254 243 199
--secondary-foreground: 146 64 14
--muted:                249 250 251
--muted-foreground:     107 114 128
--accent:               251 191 36
--accent-foreground:    146 64 14
--destructive:          239 68 68
--destructive-foreground: 255 255 255
--border:               229 231 235
--input:                229 231 235
--ring:                 245 158 11
--chart-1:              245 158 11
--chart-2:              251 191 36
--chart-3:              254 240 138
--chart-4:              255 237 213
--chart-5:              255 251 235
--tooltip-shadow:       0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)
--orb-primary:          245 158 11
--orb-marker-strong:    30 58 138
--orb-marker-weak:      59 130 246
--orb-center:           30 58 138
--orb-date:             107 114 128
--orb-clock-bg:         255 255 255
```

#### Afternoon Theme (`html[data-theme='afternoon']`)

```
--background:           255 255 255
--foreground:           15 23 42
--card:                 255 255 255
--card-foreground:      15 23 42
--popover:              255 255 255
--popover-foreground:   15 23 42
--primary:              13 148 136
--primary-foreground:   255 255 255
--secondary:            204 251 241
--secondary-foreground: 17 94 89
--muted:                249 250 251
--muted-foreground:     107 114 128
--accent:               20 184 166
--accent-foreground:    5 68 63
--destructive:          239 68 68
--destructive-foreground: 255 255 255
--border:               229 231 235
--input:                229 231 235
--ring:                 13 148 136
--chart-1:              13 148 136
--chart-2:              20 184 166
--chart-3:              94 234 212
--chart-4:              153 246 228
--chart-5:              204 251 241
--tooltip-shadow:       0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)
--orb-primary:          13 148 136
--orb-marker-strong:    15 23 42
--orb-marker-weak:      15 23 42
--orb-center:           15 23 42
--orb-date:             107 114 128
--orb-clock-bg:         255 255 255
```

#### Night Theme (`html[data-theme='night']`)

```
--background:           15 23 42
--foreground:           248 250 252
--card:                 30 41 59
--card-foreground:      248 250 252
--popover:              30 41 59
--popover-foreground:   248 250 252
--primary:              251 146 60
--primary-foreground:   15 23 42
--secondary:            71 85 105
--secondary-foreground: 248 250 252
--muted:                51 65 85
--muted-foreground:     148 163 184
--accent:               251 191 36
--accent-foreground:    15 23 42
--destructive:          239 68 68
--destructive-foreground: 248 250 252
--border:               51 65 85
--input:                51 65 85
--ring:                 251 146 60
--chart-1:              251 146 60
--chart-2:              251 191 36
--chart-3:              252 211 77
--chart-4:              254 240 138
--chart-5:              255 251 235
--tooltip-shadow:       0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.2), 0 0 0 1px rgba(248,250,252,0.1)
--orb-primary:          251 146 60
--orb-marker-strong:    248 250 252
--orb-marker-weak:      248 250 252
--orb-center:           248 250 252
--orb-date:             148 163 184
--orb-clock-bg:         15 23 42
```

#### Starry Theme (`html[data-theme='starry']`)

```
--background:           2 6 23
--foreground:           248 250 252
--card:                 15 23 42
--card-foreground:      248 250 252
--popover:              15 23 42
--popover-foreground:   248 250 252
--primary:              139 92 246
--primary-foreground:   255 255 255
--secondary:            51 65 85
--secondary-foreground: 226 232 240
--muted:                30 41 59
--muted-foreground:     148 163 184
--accent:               167 139 250
--accent-foreground:    15 23 42
--destructive:          239 68 68
--destructive-foreground: 248 250 252
--border:               30 41 59
--input:                30 41 59
--ring:                 139 92 246
--chart-1:              139 92 246
--chart-2:              167 139 250
--chart-3:              196 181 253
--chart-4:              221 214 254
--chart-5:              237 233 254
--tooltip-shadow:       0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.3), 0 0 0 1px rgba(248,250,252,0.1)
--orb-primary:          167 139 250
--orb-marker-strong:    248 250 252
--orb-marker-weak:      248 250 252
--orb-center:           248 250 252
--orb-date:             148 163 184
--orb-clock-bg:         2 6 23
```

#### Default (No Theme Set) -- Mirrors Morning

```
--background:           255 255 255
--foreground:           15 23 42
--card:                 255 255 255
--card-foreground:      15 23 42
--popover:              255 255 255
--popover-foreground:   15 23 42
--primary:              245 158 11
--primary-foreground:   255 255 255
--secondary:            254 243 199
--secondary-foreground: 146 64 14
--muted:                249 250 251
--muted-foreground:     107 114 128
--accent:               251 191 36
--accent-foreground:    146 64 14
--destructive:          239 68 68
--destructive-foreground: 255 255 255
--border:               229 231 235
--input:                229 231 235
--ring:                 245 158 11
--chart-1:              245 158 11
--chart-2:              251 191 36
--chart-3:              254 240 138
--chart-4:              255 237 213
--chart-5:              255 251 235
--tooltip-shadow:       0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)
--orb-primary:          245 158 11
--orb-marker-strong:    30 58 138
--orb-marker-weak:      59 130 246
--orb-center:           30 58 138
--orb-date:             107 114 128
--orb-clock-bg:         255 255 255
```

### Global Root Variables

```css
--sh-class:        #2d5e9d
--sh-identifier:   #354150
--sh-sign:         #8996a3
--sh-string:       #007f7a
--sh-keyword:      #e02518
--sh-comment:      #a19595
--sh-jsxliterals:  #6266d1
--sh-property:     #e25a1c
--sh-entity:       #e25a1c
--font-sans:       var(--font-antic), ui-sans-serif, sans-serif, system-ui
--font-serif:      'Signifier', Georgia, serif
--font-mono:       'JetBrains Mono', 'Courier New', monospace
```

### Z-index Scale

```
--z-base:     0
--z-dropdown: 10
--z-sticky:   20
--z-fixed:    30
--z-nav:      40
--z-overlay:  50
--z-modal:    60
--z-toast:    70
--z-boot:     80
```

### Dark Mode Syntax Highlighting Overrides

```css
@media (prefers-color-scheme: dark) {
  --sh-class:      #4c97f8
  --sh-identifier: white
  --sh-keyword:    #f47067
  --sh-string:     #0fa295
}
```

### Selection Colors

```css
::selection {
  background-color: #47a3f3;
  color: #fefefe;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Global Keyframe Animations

```css
@keyframes heroMarqueeLeft {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

@keyframes heroMarqueeRight {
  0%   { transform: translateX(-50%); }
  100% { transform: translateX(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## SEO & Metadata

### Site Metadata (from `app/layout.tsx`)

```
metadataBase:  https://curlycloud.dev
title.default: Raj | Software Engineer & Entrepreneur
title.template: %s | Software Engineer & Entrepreneur
description:   I build experiences--both digital and physical. Engineering background. Founder at ARK Expereinces.
icon:          /raj-avatar.webp
apple-icon:    /raj-avatar.webp
color-scheme:  light dark
theme-color:   #f59e0b
canonical:     https://curlycloud.dev
```

### Open Graph

```
og:title:       Raj | Software Engineer & Entrepreneur
og:description: I build experiences--both digital and physical. Engineering background. Founder at ARK Expereinces.
og:url:         https://curlycloud.dev
og:site_name:   Raj
og:locale:      en_US
og:type:        website
og:image:       https://curlycloud.dev/og?title=Raj%20%7C%20Software%20Engineer%20%26%20Entrepreneur
og:image:width: 1200
og:image:height: 630
```

### Robots

```
index: true
follow: true
googleBot:
  index: true
  follow: true
  max-video-preview: -1
  max-image-preview: large
  max-snippet: -1
```

### Sitemap (`app/sitemap.ts`)

**Base URL:** `https://curlycloud.dev`

**Static routes:**
- `https://curlycloud.dev/`
- `https://curlycloud.dev/blog`
- `https://curlycloud.dev/history`

**Blog routes (from posts):**
- `https://curlycloud.dev/blog/building-for-humans` (lastModified: 2026-01-15)
- `https://curlycloud.dev/blog/generalism-future` (lastModified: 2025-02-10)
- `https://curlycloud.dev/blog/physical-digital-tension` (lastModified: 2025-03-05)

**Project routes (from projects):**
- `https://curlycloud.dev/projects/penguin-mail`
- `https://curlycloud.dev/projects/ark-experience`
- `https://curlycloud.dev/projects/bridger`
- `https://curlycloud.dev/projects/stella56`
- `https://curlycloud.dev/projects/playground`

### Robots.txt (`app/robots.ts`)

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /_next/
Sitemap: https://curlycloud.dev/sitemap.xml
Host: https://curlycloud.dev
```

---

## Technical Config

### Fonts

| Font           | Source       | CSS Variable    | Usage                |
| -------------- | ------------ | --------------- | -------------------- |
| Antic          | Google Fonts | `--font-antic`  | Body / sans-serif    |
| JetBrains Mono | Google Fonts | `--font-mono`   | Code / monospace     |
| Sora           | (referenced) | `--font-sora`   | History page headers |
| Signifier      | (referenced) | `--font-serif`  | Serif fallback       |

### R2 Video Configuration

- **Base URL:** `https://videos.curlycloud.dev`
- **Env vars:** `NEXT_PUBLIC_R2_VIDEO_BASE_URL`, `R2_VIDEO_BASE_URL`
- **CDN preconnect:** `https://deifkwefumgah.cloudfront.net`, `https://videos.curlycloud.dev`

### Video File Paths

| Project         | Video Path                                                 |
| --------------- | ---------------------------------------------------------- |
| Penguin Mail    | `https://videos.curlycloud.dev/penguin mail landing.mov`   |
| ARK Experience  | `https://videos.curlycloud.dev/ARK experiences.mov`        |
| Bridger         | `https://videos.curlycloud.dev/Atawalk Bridges.mov`       |
| Stella 56       | `https://videos.curlycloud.dev/Stella 56 Diamonds.mov`    |
| Playground      | `https://videos.curlycloud.dev/Playground CN.mov`          |

### Layout Structure

- `<html>` with font CSS variables, `lang="en"`
- Blocking theme script (flash prevention)
- Skip-to-content link (`#main-content`)
- `ThemeProvider` (auto time-based theming)
- `Navbar` (fixed, z-40)
- `LazyClockWrapper` (lazy-loaded)
- `LazyCalFloatingButton` (lazy-loaded)
- `ThemeSwitcher` (fixed, bottom-left, z-30)
- `<main id="main-content">` with max-w-7xl container, responsive padding (pt-36 sm:pt-44, pb-4 sm:pb-8)
- `Footer` inside main
- `LazyMouseFollowingEyes` (lazy-loaded, outside main)

### Component Boundaries

| File                         | Type   | Directive      |
| ---------------------------- | ------ | -------------- |
| `app/page.tsx`               | Client | `'use client'` |
| `app/history/page.tsx`       | Client | `'use client'` |
| `app/blog/[slug]/page.tsx`   | Server | (none)         |
| `app/projects/[slug]/page.tsx` | Server | (none)       |

### CSS Architecture

- Tailwind CSS v4 alpha with `@tailwindcss/postcss`
- No `tailwind.config.ts` (Tailwind v4 does not use one)
- Single CSS file: `app/global.css`
- CSS import: `@import 'tailwindcss'`
- All theme colors are space-separated RGB triplets consumed as `rgb(var(--variable))`
- No Tailwind color tokens (`text-foreground`, `bg-card`, etc.) -- all theme-aware colors use inline styles

### TypeScript

- `strict: false` with `strictNullChecks: true`
- `baseUrl: "."` with paths alias `"@/*": ["./*"]`

---

*End of content archive.*
