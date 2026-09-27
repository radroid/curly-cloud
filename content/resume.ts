import type { SourceInput } from '@/lib/rag/types'

/**
 * Raj's public AI Engineer resume, structured. This is the single source for the website,
 * the terminal's filesystem, GET /api/profile, the MCP `get_resume` tool, and the public
 * half of the clone's knowledge base (see `resumeSources`). Everything here is public.
 */

export interface ResumeBullet {
  id: string
  text: string
  /** Skill ids from `skills[].id` plus free tags; drives the website's skill filter. */
  tags: string[]
}

export interface ResumeRole {
  id: string
  company: string
  role: string
  location: string
  period: string
  start: string
  end: string | null
  blurb: string | null
  bullets: ResumeBullet[]
  /** Public site for the organisation, when there is one. */
  url?: string
}

export interface ResumeBuild {
  id: string
  title: string
  period: string
  stack: string[]
  bullets: ResumeBullet[]
  /** Public page for the build (live app, write-up or video), as linked from the PDF resume. */
  link?: { label: string; href: string }
}

export interface SkillGroup {
  id: string
  label: string
  items: { id: string; label: string }[]
}

export interface ResumeData {
  name: string
  role: string
  headline: string
  pitch: string
  location: string
  email: string
  links: { label: string; href: string }[]
  summary: string[]
  skills: SkillGroup[]
  experience: ResumeRole[]
  builds: ResumeBuild[]
  /** Community work outside the day job. Same shape as a role. */
  community: ResumeRole[]
  education: { id: string; credential: string; school: string; period: string }[]
}

export const RESUME: ResumeData = {
  name: 'Raj Dholakia',
  role: 'Lead Software Developer',
  headline: 'Building at the edge of AI development, now on agent orchestration.',
  pitch:
    'I build LLM features that make it past the demo: MCP servers, RAG pipelines, agents, and the evals and guardrails around them.',
  location: 'Toronto, ON',
  email: 'raj9dholakia@gmail.com',
  links: [
    { label: 'LinkedIn', href: 'https://linkedin.com/in/raj-dholakia' },
    { label: 'GitHub', href: 'https://github.com/radroid' },
    { label: 'curlycloud.dev', href: 'https://curlycloud.dev' },
  ],
  summary: [
    'Software engineer with 6 years shipping production systems, the last two and a half focused on LLM-powered products.',
    'I work in focused deep dives: take one problem, go to the bottom of it for a few weeks, ship it, then carry what I learned into the next domain. That is how I moved from nuclear engineering into software, and from full-stack work into GenAI infrastructure.',
    'I design for reliability first, because the people using these systems make decisions with the answers. I build with Claude Code daily.',
  ],
  skills: [
    {
      id: 'genai',
      label: 'GenAI',
      items: [
        { id: 'mcp', label: 'MCP servers (tool design, context engineering)' },
        { id: 'langchain', label: 'LangChain' },
        { id: 'llm-apis', label: 'Anthropic and OpenAI APIs' },
        { id: 'rag', label: 'RAG (retrieval quality, chunking strategy, hybrid search, BM25)' },
        { id: 'vector-search', label: 'pgvector, Qdrant Query API (named vectors, filtered multi-vector search)' },
        { id: 'rrf', label: 'Reranking' },
        { id: 'evals', label: 'LLM-based evaluations, Inspect AI' },
        { id: 'guardrails', label: 'Guardrails' },
        { id: 'rate-limiting', label: 'Rate limiting' },
      ],
    },
    {
      id: 'code',
      label: 'Code and data',
      items: [
        { id: 'python', label: 'Python' },
        { id: 'typescript', label: 'TypeScript' },
        { id: 'csharp', label: 'C#/.NET' },
        { id: 'nextjs', label: 'Node.js and Next.js' },
        { id: 'postgres', label: 'PostgreSQL' },
        { id: 'etl', label: 'ETL and REST APIs' },
        { id: 'kafka', label: 'Kafka' },
        { id: 'azure', label: 'Azure Storage Queues' },
        { id: 'auth', label: 'AuthN and AuthZ' },
      ],
    },
    {
      id: 'cloud',
      label: 'Cloud and tooling',
      items: [
        { id: 'aws', label: 'AWS (EC2, ECS, Lambda, RDS, S3, API Gateway, CloudFormation)' },
        { id: 'kubernetes', label: 'Kubernetes/EKS' },
        { id: 'gcp', label: 'GCP' },
        { id: 'cloudflare', label: 'Cloudflare Workers' },
        { id: 'docker', label: 'Docker and GitHub Actions' },
        { id: 'monitoring', label: 'Monitoring' },
        { id: 'claude-code', label: 'Codex/Claude CLI' },
      ],
    },
  ],
  experience: [
    {
      id: 'eddy',
      company: 'Eddy Solutions',
      role: 'Lead Software Developer',
      location: 'Toronto, ON',
      period: 'Apr 2026 – Present',
      start: '2026-04',
      end: null,
      blurb: 'Eddy makes water-leak detection hardware. I lead software on the team that turns that device data into web apps and insights.',
      bullets: [
        {
          id: 'rag',
          text: 'Building a RAG system over internal sensor engineering docs and ISO whitepapers, gated by an Inspect AI eval suite.',
          tags: ['rag', 'evals'],
        },
        {
          id: 'tracker',
          text: "Built the company's work tracker from scratch (Next.js, PostgreSQL), with adoption across Service, Product, Tech, field technicians and vendors in place of a shared Excel sheet, Jira and email chains.",
          tags: ['nextjs', 'postgres', 'product'],
        },
        {
          id: 'mcp',
          text: 'Built an MCP server and agent on top of the work tracker inside the same Next.js app, so users can ask questions, search and update work items with chat history storing important context about specific incidents/work items.',
          tags: ['mcp', 'agents', 'nextjs'],
        },
        {
          id: 'services',
          text: 'Led C#/.NET and TypeScript services on AWS and Azure; added monitoring in web apps, Python scripts that turn telemetry from 150,000+ LoRaWAN devices (via Azure Storage Queues) into actionable insights.',
          tags: ['csharp', 'typescript', 'aws', 'azure', 'python', 'monitoring', 'leadership'],
        },
        {
          id: 'claude-code',
          text: 'Agent-driven development with Codex/Claude CLI, rolled out AGENTS.md instructions and pull request review guidelines to several repositories while being thoughtful about context stuffing.',
          tags: ['claude-code'],
        },
      ],
    },
    {
      id: 'create-club',
      company: 'Create Club',
      role: 'Co-Founder & AI Engineer',
      location: 'Toronto, ON',
      period: 'Aug 2024 – Mar 2026',
      start: '2024-08',
      end: '2026-03',
      blurb: 'A small studio that built web applications and AI tooling for clients.',
      bullets: [
        {
          id: 'beverage-agents',
          text: 'Built LangChain agents on the Anthropic and OpenAI APIs for a global beverage company (via a consultancy) that pulled weekly reports, applied required changes and loaded them into internal systems, replacing 80+ weekly processes and cutting manual work by about 60%.',
          tags: ['agents', 'langchain', 'llm-apis'],
        },
        {
          id: 'imap-mcp',
          text: "Prototyped an MCP server over a client's self-hosted IMAP mail. Showed that acceptable latency needed a local index plus a response cache and estimated the cost to build and run it.",
          tags: ['mcp', 'product'],
        },
        {
          id: 'client-apps',
          text: 'Shipped 4+ production apps including production-grade payment flows for clients (Next.js, Node.js, PostgreSQL, Docker, Stripe API).',
          tags: ['nextjs', 'postgres', 'docker'],
        },
      ],
    },
    {
      id: 'pinhous',
      company: 'Pinhous Inc.',
      role: 'Product Lead & Cloud Engineer',
      location: 'Toronto, ON',
      period: 'Jan 2024 – Feb 2025',
      start: '2024-01',
      end: '2025-02',
      blurb: null,
      bullets: [
        {
          id: 'team',
          text: "Led 3 interns, including 2 developers and 1 designer, building the company's React web and mobile apps: owned the architecture and shared REST API layer, ran sprint planning and code review, and mentored on design patterns.",
          tags: ['leadership', 'etl', 'product'],
        },
        {
          id: 'kafka',
          text: 'Introduced Kafka to make the backend event-driven: with data showing a buyer co-located properties from several sources, and streamed their updates as new events.',
          tags: ['kafka'],
        },
        {
          id: 'cicd',
          text: 'Built the AWS deploy pipeline (GitHub Actions, Docker images to ECS, stacks in CloudFormation via CDK): reduced deployments from 15 minutes to 2, with health checks and automatic rollbacks.',
          tags: ['aws', 'docker', 'monitoring'],
        },
        {
          id: 'recs-poc',
          text: 'Ran a LangChain PoC for personalized home recommendations from images and tags buyers liked; concluded that per-user cost was too high to ship.',
          tags: ['langchain', 'product'],
        },
      ],
    },
    {
      id: 'aro',
      company: 'ARO Inc.',
      role: 'Lead Application Developer',
      location: 'Toronto, ON',
      period: 'May 2022 – Dec 2023',
      start: '2022-05',
      end: '2023-12',
      blurb: 'Application Developer until January 2023.',
      bullets: [
        {
          id: 'automation',
          text: 'Built Python document-processing automations (automated extraction, tagging) that better aligned with downstream use-cases.',
          tags: ['python'],
        },
        {
          id: 'etl',
          text: 'Built ETL and integration layers between client and internal CRM systems, cutting manual work for 40% of the workflows.',
          tags: ['etl'],
        },
        {
          id: 'docs',
          text: 'Owned the technical documentation and on-call preventive fixes that cut repeat incidents by 20%.',
          tags: ['monitoring', 'product'],
        },
      ],
    },
    {
      id: 'duit',
      company: 'Duit.io',
      role: 'Associate Software Engineer',
      location: 'Mumbai, India (remote)',
      period: 'Sep 2020 – Aug 2021',
      start: '2020-09',
      end: '2021-08',
      blurb: null,
      bullets: [
        {
          id: 'signals',
          text: 'Built a fintech analytics platform on GCP (Python, SQL) that computed buy/sell signals over NSE market data; cut signal latency from 15 seconds to 5.',
          tags: ['gcp', 'python'],
        },
        {
          id: 'pipelines',
          text: 'Deployed Cloud Functions and IAM roles for the backends and data pipelines behind real-time dashboards.',
          tags: ['gcp', 'etl'],
        },
      ],
    },
  ],
  builds: [
    {
      id: 'regdocs',
      title: 'Grounded regulatory assistant for the Canadian nuclear industry',
      period: 'Jul 2026',
      stack: ['Next.js', 'TypeScript', 'OpenAI', 'Supabase pgvector', 'Cloudflare Workers'],
      link: { label: 'Live app', href: 'https://npx.curlycloud.dev/knowledge-hub' },
      bullets: [
        {
          id: 'corpus',
          text: 'Built a RAG chat over 40+ Canadian Nuclear Safety Commission documents: 15 priority REGDOCs plus 26 best-practice documents spanning all 14 safety and control areas. Answers cite the source document and section, and requirements (shall/must) are visually separated from guidance (should/may).',
          tags: ['rag', 'citations', 'nextjs', 'cloudflare'],
        },
        {
          id: 'pipeline',
          text: 'Ingested and chunked the documents with section metadata and a requirement-type tag, embedded with text-embedding-3-large stored as half-precision vectors in pgvector, and retrieved and reranked top-k chunks that are wrapped as untrusted context before generation.',
          tags: ['rag', 'vector-search', 'rrf'],
        },
        {
          id: 'evals',
          text: 'Wrote an evaluation harness with a golden set, LLM-as-judge faithfulness and citation-support scoring, out-of-corpus rejection probes and ID-based hit@k and MRR. Used it to justify the embedding upgrade (hit@8 95.7% to 96.7%, recall@8 82.6% to 86.0%), and later to catch a real regression when the corpus grew (hit@8 96.7% to 91.3%, 15 queries worse, none better). Root-caused it to near-identical boilerplate sections colliding in retrieval, recovered half the loss by dropping them, and held the production release pending a generation eval.',
          tags: ['evals', 'rag'],
        },
        {
          id: 'guardrails',
          text: 'Added production guardrails: per-tier rate limiting, input sanitization with jailbreak-pattern detection, a streaming output guard that truncates on deny-list hits, and PII-safe logging that hashes IPs and user IDs with a daily salt and never stores query or response text.',
          tags: ['guardrails', 'rate-limiting', 'pii'],
        },
        {
          id: 'licensing',
          text: 'Built a licence-manifest-driven fetcher for growing the corpus: 15 US NRC regulatory guides fetched and validated through the PDF path but held from ingestion until citations are source-aware, and 16 IAEA standards catalogued as reference-only because their licence does not allow full-corpus storage.',
          tags: ['rag', 'product'],
        },
      ],
    },
    {
      id: 'pulse',
      title: 'The Pulse, a living-analytics app',
      period: 'May 2026',
      stack: ['Next.js', 'Cloudflare Workers'],
      link: { label: 'System design explanation', href: 'https://opendoor.curlycloud.dev/system' },
      bullets: [
        {
          id: 'app',
          text: "Shipped The Pulse, a Next.js / Cloudflare Workers living-analytics app ranking a pricing leader's decisions from a semantic mart.",
          tags: ['nextjs', 'cloudflare'],
        },
      ],
    },
    {
      id: 'jobsearch',
      title: 'Natural-language search over 100K job postings',
      period: 'Feb 2026',
      stack: ['Python', 'OpenAI', 'Qdrant'],
      link: { label: 'YouTube explainer', href: 'https://youtu.be/y9iwp3zfpJc' },
      bullets: [
        {
          id: 'vectors',
          text: 'Built a search engine over ~100K US job postings (8 GB JSONL) using Qdrant with three named embedding vectors per posting: explicit, inferred and company.',
          tags: ['vector-search', 'python'],
        },
        {
          id: 'pipeline',
          text: "Query pipeline parses the user's request into structured intent with an LLM (including negations), embeds it, runs three filtered vector searches through the Qdrant Query API (remote, seniority, state, industry), fuses results with intent-weighted Reciprocal Rank Fusion, then applies salary and keyword boosts, a negation penalty and near-duplicate collapsing to return a top 10.",
          tags: ['rrf', 'vector-search', 'llm-apis'],
        },
        {
          id: 'refinement',
          text: 'Supported conversational refinement by merging each follow-up into the previous intent.',
          tags: ['agents'],
        },
      ],
    },
    {
      id: 'earned',
      title: 'Earned, a habit-tracking app with an AI coach',
      period: 'Jan 2026',
      stack: [],
      link: { label: 'Live app', href: 'https://75.createplus.club/' },
      bullets: [
        {
          id: 'coach',
          text: 'Built Earned, a habit-tracking app whose AI coach remembers user context to create personalized routines and recommend challenges.',
          tags: ['llm-apis', 'product'],
        },
      ],
    },
  ],
  community: [
    {
      id: 'open-invite',
      company: 'Open Invite',
      role: 'Co-host & builder',
      location: 'Toronto, ON',
      period: 'Jul 2026 – Present',
      start: '2026-07',
      end: null,
      blurb: 'Open Invite puts on small, open-to-everyone community events in Toronto. I help host them and built the platform behind them.',
      url: 'https://openinviteto.ca',
      bullets: [
        {
          id: 'events',
          text: 'Help host small community events in Toronto, from the Cake Picnic, where every guest brings a cake to share, to Sip & Bedazzle, a crafts evening at a neighbourhood cafe.',
          tags: ['community', 'product'],
        },
        {
          id: 'platform',
          text: 'Built openinviteto.ca end to end on Next.js and Cloudflare Workers with D1: ticket-shaped event cards that morph into each event page, Stripe Checkout fulfilled only by a signed webhook, Google Wallet passes and transactional email.',
          tags: ['nextjs', 'typescript', 'cloudflare', 'community'],
        },
        {
          id: 'ops',
          text: "Built the team's operations dashboard for sales, guests, expenses and settlement, including an LLM pipeline that reads invoices from photos into the expense ledger and records every processing step so a wrong extraction can be traced and fixed on the spot.",
          tags: ['llm-apis', 'product', 'community'],
        },
      ],
    },
  ],
  education: [
    { id: 'tpm', credential: 'Certificate in Technical Product Management', school: 'BrainStation, Toronto', period: '2024' },
    { id: 'ai', credential: 'Graduate Certificate in AI Design & Implementation', school: 'Durham College, Toronto', period: '2021 – 2022' },
    { id: 'beng', credential: 'BEng Mechanical (Nuclear) Engineering', school: 'University of Manchester, UK', period: '2016 – 2019' },
  ],
}

/** DOM anchor for a resume bullet or block, shared by the website and citations. */
export function resumeAnchor(...parts: string[]): string {
  return ['r', ...parts].join('-')
}

/**
 * The public half of the knowledge base: one source per resume bullet (precise citations that
 * highlight the exact line on the website), plus summary, skills, education and profile.
 */
export function resumeSources(data: ResumeData = RESUME): SourceInput[] {
  const out: SourceInput[] = []
  out.push({
    id: 'resume:summary',
    kind: 'resume',
    visibility: 'public',
    title: 'Resume · Summary',
    topic: 'summary',
    anchor: resumeAnchor('summary'),
    body: [`${data.name}, ${data.role}. ${data.headline}`, data.pitch, ...data.summary].join('\n\n'),
  })
  for (const role of data.experience) {
    const header = `${role.role} at ${role.company}, ${role.location} (${role.period}).`
    if (role.blurb) {
      out.push({
        id: `resume:exp:${role.id}:about`,
        kind: 'resume',
        visibility: 'public',
        title: `Resume · ${role.company}`,
        topic: 'experience',
        anchor: resumeAnchor('exp', role.id),
        body: `${header} ${role.blurb}`,
      })
    }
    for (const b of role.bullets) {
      out.push({
        id: `resume:exp:${role.id}:${b.id}`,
        kind: 'resume',
        visibility: 'public',
        title: `Resume · ${role.company}`,
        topic: 'experience',
        anchor: resumeAnchor('exp', role.id, b.id),
        body: `${header} ${b.text}`,
        meta: { tags: b.tags },
      })
    }
  }
  for (const build of data.builds) {
    const header = `Independent build: ${build.title} (${[build.period, build.stack.join(', ')].filter(Boolean).join('; ')}).`
    for (const b of build.bullets) {
      out.push({
        id: `resume:build:${build.id}:${b.id}`,
        kind: 'resume',
        visibility: 'public',
        title: `Resume · ${build.title}`,
        topic: 'builds',
        anchor: resumeAnchor('build', build.id, b.id),
        body: `${header} ${b.text}`,
        meta: { tags: b.tags },
      })
    }
  }
  for (const c of data.community) {
    const header = `${c.role}, ${c.company}, ${c.location} (${c.period}).`
    if (c.blurb) {
      out.push({
        id: `resume:community:${c.id}:about`,
        kind: 'resume',
        visibility: 'public',
        title: `Resume · ${c.company}`,
        topic: 'community',
        anchor: resumeAnchor('community', c.id),
        body: `${header} ${c.blurb}`,
      })
    }
    for (const b of c.bullets) {
      out.push({
        id: `resume:community:${c.id}:${b.id}`,
        kind: 'resume',
        visibility: 'public',
        title: `Resume · ${c.company}`,
        topic: 'community',
        anchor: resumeAnchor('community', c.id, b.id),
        body: `${header} ${b.text}`,
        meta: { tags: b.tags },
      })
    }
  }
  out.push({
    id: 'resume:skills',
    kind: 'resume',
    visibility: 'public',
    title: 'Resume · Skills',
    topic: 'skills',
    anchor: resumeAnchor('skills'),
    body: data.skills.map((g) => `${g.label}: ${g.items.map((i) => i.label).join('; ')}.`).join('\n'),
  })
  out.push({
    id: 'resume:education',
    kind: 'resume',
    visibility: 'public',
    title: 'Resume · Education',
    topic: 'education',
    anchor: resumeAnchor('education'),
    body: data.education.map((e) => `${e.credential}, ${e.school}, ${e.period}.`).join('\n'),
  })
  out.push({
    id: 'profile:contact',
    kind: 'profile',
    visibility: 'public',
    title: 'Profile · Contact',
    topic: 'profile',
    anchor: resumeAnchor('contact'),
    body: `${data.name} is based in ${data.location}. Email: ${data.email}. ${data.links
      .map((l) => `${l.label}: ${l.href}`)
      .join('. ')}.`,
  })
  return out
}

/** Plain-markdown rendering, used by the MCP `get_resume` tool and the terminal. */
export function resumeMarkdown(data: ResumeData = RESUME): string {
  const lines: string[] = [
    `# ${data.name}`,
    '',
    `**${data.role}**. ${data.headline}`,
    `${data.location} · ${data.email} · ${data.links.map((l) => l.href).join(' · ')}`,
    '',
    '## Summary',
    '',
    ...data.summary.flatMap((p) => [p, '']),
    '## Skills',
    '',
    ...data.skills.map((g) => `- **${g.label}:** ${g.items.map((i) => i.label).join(', ')}`),
    '',
    '## Experience',
    '',
  ]
  for (const r of data.experience) {
    lines.push(`### ${r.role}, ${r.company}`, `${r.location} · ${r.period}`, '')
    if (r.blurb) lines.push(r.blurb, '')
    lines.push(...r.bullets.map((b) => `- ${b.text}`), '')
  }
  lines.push('## Independent builds', '')
  for (const b of data.builds) {
    lines.push(`### ${b.title}`, [b.period, b.stack.join(', ')].filter(Boolean).join(' · '), '')
    if (b.link) lines.push(`${b.link.label}: ${b.link.href}`, '')
    lines.push(...b.bullets.map((x) => `- ${x.text}`), '')
  }
  if (data.community.length) {
    lines.push('## Community', '')
    for (const c of data.community) {
      lines.push(`### ${c.role}, ${c.company}`, `${c.location} · ${c.period}`, '')
      if (c.blurb) lines.push(c.blurb, '')
      lines.push(...c.bullets.map((b) => `- ${b.text}`), '')
    }
  }
  lines.push('## Education', '', ...data.education.map((e) => `- ${e.credential}, ${e.school} (${e.period})`), '')
  return lines.join('\n')
}
