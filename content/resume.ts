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
}

export interface ResumeBuild {
  id: string
  title: string
  period: string
  stack: string[]
  bullets: ResumeBullet[]
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
      label: 'MCP and agents',
      items: [
        { id: 'mcp', label: 'MCP servers (Streamable HTTP, stdio, per-user auth, RBAC)' },
        { id: 'agents', label: 'AI agents' },
        { id: 'langchain', label: 'LangChain' },
        { id: 'llm-apis', label: 'Anthropic and OpenAI APIs' },
      ],
    },
    {
      id: 'retrieval',
      label: 'Retrieval',
      items: [
        { id: 'rag', label: 'RAG pipelines end to end' },
        { id: 'vector-search', label: 'pgvector, Supabase, Qdrant, multi-vector search' },
        { id: 'rrf', label: 'Reciprocal Rank Fusion and reranking' },
        { id: 'citations', label: 'Grounded answers with citations' },
      ],
    },
    {
      id: 'evals',
      label: 'Evaluation and safety',
      items: [
        { id: 'evals', label: 'Golden sets, LLM-as-judge, hit@k, recall@k, MRR, Inspect AI' },
        { id: 'guardrails', label: 'Input sanitization, jailbreak detection, output guards' },
        { id: 'rate-limiting', label: 'Rate limiting' },
        { id: 'pii', label: 'PII-safe logging' },
      ],
    },
    {
      id: 'code',
      label: 'Languages and data',
      items: [
        { id: 'python', label: 'Python' },
        { id: 'typescript', label: 'TypeScript' },
        { id: 'csharp', label: 'C#/.NET' },
        { id: 'nextjs', label: 'Next.js and Node.js' },
        { id: 'postgres', label: 'PostgreSQL and SQL' },
        { id: 'etl', label: 'ETL and REST APIs' },
      ],
    },
    {
      id: 'cloud',
      label: 'Cloud and operations',
      items: [
        { id: 'aws', label: 'AWS (EC2, ECS, Lambda, RDS, S3, API Gateway, CDK)' },
        { id: 'azure', label: 'Azure Storage Queues' },
        { id: 'gcp', label: 'GCP' },
        { id: 'cloudflare', label: 'Cloudflare Workers' },
        { id: 'docker', label: 'Docker and CI/CD' },
        { id: 'kafka', label: 'Kafka' },
        { id: 'monitoring', label: 'Logging, monitoring, incident response' },
      ],
    },
    {
      id: 'ways',
      label: 'Ways of working',
      items: [
        { id: 'claude-code', label: 'Claude Code, interactive and headless' },
        { id: 'leadership', label: 'Leading teams and mentoring' },
        { id: 'product', label: 'Product thinking and technical documentation' },
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
      blurb:
        'Eddy makes water-leak detection hardware. I lead software on the team that turns that device data into web apps and insights, and I own the GenAI tooling for the engineering team.',
      bullets: [
        {
          id: 'tracker',
          text: "Built the company's work tracker from scratch (Next.js, TypeScript, self-hosted PostgreSQL) so Service, Product and Tech teams, field technicians and third-party vendors hand work to each other in one system. It replaced a shared Excel sheet where items were routinely lost.",
          tags: ['nextjs', 'typescript', 'postgres', 'product'],
        },
        {
          id: 'mcp',
          text: "Built and run the company's MCP server on top of the tracker: Streamable HTTP for humans with personal access tokens, stdio for the unattended maintainer bot. Every tool call is authenticated, resolved to a real actor and authorized against the web app's own role and visibility rules, so a viewer cannot create tickets and a comment is attributed to the person who made it, not to a shared token.",
          tags: ['mcp', 'agents', 'typescript'],
        },
        {
          id: 'mcp-inprocess',
          text: 'Hosted the MCP server in-process in the existing Next.js app against the same core write paths, rather than as a sidecar, so deploy, auth and the database stay one system and the remote path never calls itself over HTTP.',
          tags: ['mcp', 'nextjs'],
        },
        {
          id: 'rag',
          text: 'Architected a RAG system over internal engineering documentation with two modes, Explain and Assess, gated by an Inspect AI evaluation suite that scores answer quality before any change ships.',
          tags: ['rag', 'evals', 'citations'],
        },
        {
          id: 'telemetry',
          text: 'Build and monitor the web apps, Python commissioning scripts and internal tools that turn telemetry from a 150,000+ LoRaWAN device fleet, ingested through Azure Storage Queues, into insights for customers and field teams.',
          tags: ['python', 'azure', 'monitoring'],
        },
        {
          id: 'services',
          text: 'Lead production C#/.NET and TypeScript services on AWS, owning features from design through deployment, with structured logging and monitoring on the paths I own.',
          tags: ['csharp', 'typescript', 'aws', 'monitoring', 'leadership'],
        },
        {
          id: 'claude-code',
          text: 'Build with Claude Code daily, interactive and headless. Rolled it and GitHub Copilot out to the engineering team and shipped an app the team now uses to record its own engineering decisions, within the first month.',
          tags: ['claude-code', 'leadership'],
        },
      ],
    },
    {
      id: 'create-club',
      company: 'Create Club (ARK Experiences)',
      role: 'Co-Founder & AI Engineer',
      location: 'Toronto, ON',
      period: 'Aug 2024 – Mar 2026',
      start: '2024-08',
      end: '2026-03',
      blurb: 'A small studio that built web applications and AI tooling for clients in Toronto and the Bay Area.',
      bullets: [
        {
          id: 'beverage-agents',
          text: 'Built AI agents on the Anthropic and OpenAI APIs with LangChain for a global beverage company (via a consultancy) that download the weekly reports, apply the required changes and load the data into internal systems. They replaced 80+ manual weekly processes and cut manual work by about 60%.',
          tags: ['agents', 'langchain', 'llm-apis', 'python'],
        },
        {
          id: 'monitoring',
          text: "Built the monitoring and dashboards on top of that data so the operations team could see each week's runs and catch failures without opening the files.",
          tags: ['monitoring', 'product'],
        },
        {
          id: 'imap-mcp',
          text: "Prototyped an MCP server over a client's self-hosted IMAP mail so an agent could search and read email on their behalf. Measured tool latency, showed that acceptable response times needed a local index plus a response cache, costed the production version, and recommended stopping there.",
          tags: ['mcp', 'agents', 'product'],
        },
        {
          id: 'client-apps',
          text: 'Shipped 10+ production applications for clients (Next.js, Node.js, PostgreSQL, Docker).',
          tags: ['nextjs', 'postgres', 'docker'],
        },
        {
          id: 'review',
          text: 'Integrated AI-assisted code review and automated testing into the delivery workflow so every change is reviewed and tested before it ships.',
          tags: ['claude-code', 'docker'],
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
          text: 'Led a team of 12 developers, owning architecture decisions, the REST API layer behind the web and mobile apps, Agile sprint planning and code review, and mentoring engineers on design patterns and coding standards.',
          tags: ['leadership', 'etl', 'product'],
        },
        {
          id: 'cicd',
          text: 'Built a Docker and infrastructure-as-code CI/CD pipeline on AWS that cut deploy time from 15 minutes to 2, with health monitoring and automated rollbacks.',
          tags: ['aws', 'docker', 'monitoring'],
        },
        {
          id: 'kafka',
          text: 'Introduced Kafka for event-driven data flow between services so producers and consumers could scale and fail independently.',
          tags: ['kafka'],
        },
        {
          id: 'recs-poc',
          text: 'Ran a LangChain proof of concept for personalized home recommendations, matching buyers to listings from the images and tags they liked. It worked, but per-user inference cost against expected traffic did not justify shipping it, so I recommended against it and documented the trade-off for when model prices fell.',
          tags: ['langchain', 'product'],
        },
      ],
    },
    {
      id: 'aro',
      company: 'ARO Inc.',
      role: 'Lead Application Developer, Full Stack & Automation',
      location: 'Toronto, ON',
      period: 'May 2022 – Dec 2023',
      start: '2022-05',
      end: '2023-12',
      blurb: 'Application Developer until January 2023.',
      bullets: [
        {
          id: 'automation',
          text: 'Deployed ML-powered Python automations for document processing that tripled report-generation throughput through automated extraction and NLU-based classification.',
          tags: ['python'],
        },
        {
          id: 'etl',
          text: 'Built ETL and integration layers connecting enterprise ERP and CRM systems, cutting manual processing time by 50%.',
          tags: ['etl'],
        },
        {
          id: 'docs',
          text: 'Owned the technical documentation repository and on-call incident response, with preventive measures that reduced recurring incidents by 20%.',
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
          text: 'Built a fintech analytics platform on GCP (Python, SQL) that computed buy/sell signals over NSE market data, cutting signal latency from 15 seconds to 5.',
          tags: ['gcp', 'python', 'postgres'],
        },
        {
          id: 'team',
          text: 'Led a remote team of 3, deploying Cloud Functions and IAM for the backend and the data-aggregation pipelines feeding real-time dashboards.',
          tags: ['gcp', 'leadership'],
        },
      ],
    },
  ],
  builds: [
    {
      id: 'regdocs',
      title: 'Grounded regulatory assistant for the Canadian nuclear industry',
      period: 'Apr – Jul 2026',
      stack: ['Next.js', 'TypeScript', 'OpenAI', 'Supabase pgvector', 'Cloudflare Workers'],
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
      id: 'jobsearch',
      title: 'Natural-language search over 100K job postings',
      period: 'Feb 2026',
      stack: ['Python', 'OpenAI', 'Qdrant'],
      bullets: [
        {
          id: 'vectors',
          text: 'Built a search engine over ~100K US job postings (8 GB JSONL) using Qdrant with three named embedding vectors per posting: explicit, inferred and company.',
          tags: ['vector-search', 'python'],
        },
        {
          id: 'pipeline',
          text: "Query pipeline parses the user's request into structured intent with an LLM (including negations), embeds it, runs three filtered vector searches (remote, seniority, state, industry), fuses results with intent-weighted Reciprocal Rank Fusion, then applies salary and keyword boosts, a negation penalty and near-duplicate collapsing to return a top 10.",
          tags: ['rrf', 'vector-search', 'llm-apis'],
        },
        {
          id: 'refinement',
          text: 'Supported conversational refinement by merging each follow-up into the previous intent.',
          tags: ['agents'],
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
    const header = `Independent build: ${build.title} (${build.period}; ${build.stack.join(', ')}).`
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
    lines.push(`### ${b.title}`, `${b.period} · ${b.stack.join(', ')}`, '', ...b.bullets.map((x) => `- ${x.text}`), '')
  }
  lines.push('## Education', '', ...data.education.map((e) => `- ${e.credential}, ${e.school} (${e.period})`), '')
  return lines.join('\n')
}
