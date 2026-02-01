import { getR2VideoUrl } from './r2-config'

export interface PortfolioProject {
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

export const portfolioProjects: PortfolioProject[] = [
  {
    id: 'penguin-mail',
    title: 'Penguin Mail – AI-first email client',
    shortTitle: 'Penguin Mail',
    url: 'https://www.penguinmail.app/',
    video: getR2VideoUrl('/penguin mail landing.mov'),
    shortDescription: 'AI-powered email client. LLM-based filtering that understands natural language rules — not just keywords.',
    role: 'Product Lead & Builder',
    problem: 'Knowledge workers drown in low-value email; most clients treat all messages the same, forcing users to manually triage updates, promotions, and real conversations.',
    description: 'Led product discovery, defined AI-powered filtering concepts, wrote specs, and built the v1 prototype (Next.js, TypeScript, AI APIs).',
    aiComponent: 'Designed an AI filter where users describe their ideal inbox in natural language; system translates this into routing rules and classification prompts. Evaluated LLM providers, latency trade-offs, and fallback rules.',
    productDecisions: [
      'Segmented email into Conversations / Notifications / Bulk based on intent instead of folder rules.',
      'Scoped MVP to a Gmail-connected web app with a single "training" surface to avoid overwhelming onboarding.',
    ],
    impact: [
      'Ran 10 user interviews with heavy email users; 8/10 preferred the "conversation-only inbox" view conceptually.',
    ],
    technologies: [
      'Google Gemini',
      'Langchain',
      'Google Cloud',
      'Docker',
      'Next.js',
      'TypeScript'
    ],
  },
  {
    id: 'ark-experience',
    title: 'ARK Experience – IRL team-building game',
    shortTitle: 'ARK Experience',
    url: 'https://www.funwithark.ca/',
    video: getR2VideoUrl('/ARK experiences.mov'),
    shortDescription: 'Full-stack event platform. Location-based puzzle experiences with automated operations, reducing manual work by 80%.',
    role: 'Co-founder, Product & Ops',
    problem: 'Teams wanted memorable group experiences, not another generic tour.',
    description: 'Designed a location-based puzzle experience with narrative, constraints (2 hours, walkable downtown), and repeatable operations.',
    productDecisions: [
      'Structured the 7-step customer journey from discovery to completion.',
      'Tested clue difficulty through multiple iterations.',
      'Optimized route based on feedback and completion times.',
    ],
    impact: [
      'Multiple cohorts run with high satisfaction ratings.',
      'Repeat bookings and B2B clients.',
    ],
    technologies: [
      'Next.js 15',
      'React 19',
      'TypeScript 5',
      'Convex',
      'Clerk',
      'Tailwind CSS 4',
      'shadcn/ui',
      'Framer Motion',
      'A-Frame',
      'AR.js',
      'Kibo UI',
      'Lucide React',
      'next-themes',
      'next-pwa',
      'Service Workers',
      'react-dropzone',
      'sonner',
      'cmdk',
      'class-variance-authority',
      'HTML5',
      'Vercel',
      'Supabase'
    ],
  },
  {
    id: 'bridger',
    title: 'Bridger – AI image generation SaaS',
    shortTitle: 'Bridger',
    url: 'https://bridger.atawalk.ca/',
    video: getR2VideoUrl('/Atawalk Bridges.mov'),
    shortDescription: 'AI image generation tool. Custom bridge designs with subscription tiers — from idea to live production app with Stripe billing.',
    role: 'Product + Engineering',
    problem: 'Users wanted to generate custom bridge images but existing tools lacked specialized prompts and pricing models.',
    description: 'AI-powered image generation tool for custom bridge designs. Defined plans and pricing based on image-generation cost models, chose image model and prompt strategy, iterated on prompt presets with early users.',
    aiComponent: 'Chose image model, prompt strategy, and safety constraints; iterated on prompt presets with early users. Defined plans and pricing based on image-generation cost models.',
    productDecisions: [
      'Built end-to-end from idea → scoped MVP → pricing tiers → live production app with subscription plans.',
      'Integrated PostHog for analytics to track conversion and usage patterns.',
    ],
    impact: [
      'Live production app with subscription plans.',
    ],
    technologies: [
      'Next.js 15',
      'React 19',
      'TypeScript',
      'Tailwind CSS',
      'Node.js',
      'Express.js',
      'PostgreSQL',
      'Clerk',
      'Stripe',
      'Radix UI',
      'Framer Motion',
      'React Hook Form',
      'Zod',
      'Next Themes',
      'Leonardo AI',
      'PostHog',
      'Nodemailer',
      'Lucide React',
      'Sonner',
      'React Icons',
      'Helmet',
      'Express Rate Limiting',
      'CORS',
      'JWT',
      'Multer',
      'ChatGPT',
      'Digital Ocean',
    ],
  },
  {
    id: 'stella56',
    title: 'Stella 56 Diamonds – E-commerce platform',
    shortTitle: 'Stella 56 Diamonds',
    url: 'https://www.stella56diamonds.com/',
    video: getR2VideoUrl('/Stella 56 Diamonds.mov'),
    shortDescription: 'E-commerce platform. Manufacturer-direct lab-grown diamonds with custom product catalog and inventory management.',
    role: 'Product + Engineering',
    problem: 'Consumers wanted transparent, ethical diamond options with certification and detailed product information.',
    description: 'Manufacturer-direct lab-grown diamonds platform. Led product development, defined user flows for diamond selection and certification, integrated AI for product recommendations, and built analytics dashboards to track conversion and engagement.',
    aiComponent: 'Integrated AI for product recommendations based on user preferences and browsing behavior.',
    productDecisions: [
      'Defined user flows for diamond selection and certification.',
      'Built analytics dashboards to track conversion and engagement.',
    ],
    impact: [
      'Live e-commerce platform with IGI/GIA-certified diamonds.',
    ],
    technologies: [
      'Next.js 15',
      'React 19',
      'TypeScript 5.9',
      'Tailwind CSS 4.1',
      'Shadcn/ui',
      'Framer Motion',
      'Radix UI',
      'Motion',
      'Motion One',
      'Three.js',
      'React Hook Form',
      'Zod',
      'Hookform Resolvers',
      'Lucide React',
      'Recharts',
      'TSParticles',
      'Next Themes',
      'Sonner',
      'Vaul',
      'Biome',
      'Cloudflare',
      'Claude AI'
    ],
  },
  {
    id: 'playground',
    title: 'Playground – Developer tool',
    shortTitle: 'Playground',
    url: 'https://playground.createplus.club/',
    video: getR2VideoUrl('/Playground CN.mov'),
    shortDescription: 'Ship UI faster. Design, tweak, and copy Shadcn components with instant previews and live code editing.',
    role: 'Product + Engineering',
    problem: 'Developers wanted a faster way to browse, customize, and copy Shadcn components without setting up local environments.',
    description: 'Design, tweak, and copy Shadcn components with instant previews. Defined the component library structure, prioritized features based on developer feedback, and built the live editing experience with code export functionality.',
    productDecisions: [
      'Defined the component library structure for easy navigation.',
      'Prioritized features based on developer feedback.',
      'Built the live editing experience with code export functionality.',
    ],
    impact: [
      'Live tool for developers to quickly prototype with Shadcn components.',
    ],
    technologies: [
      'Next.js 16',
      'React 19',
      'TypeScript',
      'Tailwind CSS v4',
      'Shadcn UI',
      'Sandpack',
      'Radix UI',
      'Lucide React',
      'Motion',
      'React Hook Form',
      'Zod',
      '@hookform/resolvers',
      'Recharts',
      'Embla Carousel',
      'Sonner',
      'Vaul',
      'CMDK',
      'React Resizable Panels',
      'next-themes',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'date-fns',
      'JSZip',
    ],
  },
]

export function getProject(slug: string): PortfolioProject | undefined {
  return portfolioProjects.find((project) => project.id === slug)
}

export function getAllProjects(): PortfolioProject[] {
  return portfolioProjects
}

