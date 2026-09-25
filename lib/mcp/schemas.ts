/**
 * Zod (v4) input and output schemas for the MCP tools. The SDK turns these into the JSON Schema
 * agents see in tools/list and validates tool input and `structuredContent` against them.
 */
import { z } from 'zod'
import type { Limits } from '@/lib/env'

const SOURCE_KINDS = ['resume', 'profile', 'interview', 'note', 'correction'] as const
const PROVIDERS = ['anthropic', 'workers-ai'] as const
const VERDICTS = ['strong', 'promising', 'mixed', 'weak'] as const

// ── Inputs ───────────────────────────────────────────────────────────────────

export function askInput(limits: Pick<Limits, 'maxQuestionChars'>) {
  return {
    question: z
      .string()
      .trim()
      .min(1)
      .max(limits.maxQuestionChars)
      .describe('One question for Raj, e.g. "How do you decide whether a RAG change is safe to ship?"'),
    context: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .describe('Optional framing, e.g. the role and company you are evaluating him for. Keep it short: role title plus key requirements.'),
  }
}

export function fitInput(limits: Pick<Limits, 'maxJobDescriptionChars'>) {
  return {
    role_title: z.string().trim().min(1).max(200).describe('Role title, e.g. "Senior AI Engineer".'),
    job_description: z
      .string()
      .trim()
      .min(1)
      .max(limits.maxJobDescriptionChars)
      .describe('The full job description. Paste it as-is; requirements and responsibilities matter most.'),
    company: z.string().trim().max(200).optional().describe('Company name.'),
    culture_notes: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .describe('Anything about the team or culture: values, pace, remote/office, how decisions get made.'),
  }
}

export const resumeInput = {
  format: z.enum(['markdown', 'json']).default('markdown').describe('markdown (default) for reading, json for structured data.'),
}

export const evaluatePromptArgs = {
  role_title: z.string().describe('The role you are evaluating Raj for.'),
  job_description: z.string().optional().describe('The job description, if you have it.'),
  company: z.string().optional().describe('The hiring company.'),
}

// ── Outputs ──────────────────────────────────────────────────────────────────

export const mcpSourceSchema = z.object({
  n: z.number().int().describe('Citation number, as used in [n] markers.'),
  id: z.string(),
  kind: z.enum(SOURCE_KINDS),
  visibility: z.enum(['public', 'private']),
  title: z.string().describe('Citation label. For private interview answers this is the question only.'),
  topic: z.string().nullable(),
  section: z.string().nullable().describe('Resume section, public sources only.'),
  snippet: z.string().nullable().describe('Source text, public sources only. Private text never leaves the server.'),
  url: z.string().nullable().describe('Link to the exact line on the website, public sources only.'),
  cited: z.boolean().describe('Whether the answer cites this source.'),
})

export const askOutput = {
  answer: z.string().describe('First-person answer from the clone, with [n] citation markers.'),
  sources: z.array(mcpSourceSchema),
  cited: z.array(z.number().int()).describe('Source numbers the answer cites, in first-use order.'),
  guarded: z.boolean().describe('True if a safety guard cut the answer short.'),
  provider: z.enum(PROVIDERS),
  model: z.string(),
}

const fitDimensionSchema = z.object({
  score: z.number().min(1).max(5).describe('1 (poor) to 5 (excellent).'),
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  evidence: z.array(z.number().int()).describe('Source numbers backing this dimension.'),
})

export const fitOutput = {
  roleTitle: z.string(),
  company: z.string().nullable(),
  overall: z.object({ score: z.number().min(1).max(5), verdict: z.enum(VERDICTS), summary: z.string() }),
  technical: fitDimensionSchema,
  culture: fitDimensionSchema,
  unknowns: z.array(z.string()).describe('Requirements with no evidence either way. Ask Raj.'),
  questionsForRaj: z.array(z.string()),
  sources: z.array(mcpSourceSchema),
  provider: z.enum(PROVIDERS),
  model: z.string(),
}

export const topicSchema = z.object({
  topic: z.string(),
  label: z.string(),
  blurb: z.string().nullable(),
  count: z.number().int().nullable().describe('Number of sources on the topic; null when coverage is unknown.'),
})

export const topicsOutput = {
  topics: z.array(topicSchema),
  source: z.enum(['live', 'static']).describe('live: counted from the knowledge base. static: the planned topic list, coverage unconfirmed.'),
  note: z.string(),
}

export const profileOutput = {
  name: z.string(),
  role: z.string(),
  headline: z.string(),
  pitch: z.string(),
  location: z.string(),
  email: z.string(),
  links: z.array(z.object({ label: z.string(), href: z.string() })),
  summary: z.array(z.string()),
  currentRole: z.object({ company: z.string(), role: z.string(), period: z.string() }).nullable(),
  skills: z.array(z.object({ id: z.string(), label: z.string(), items: z.array(z.string()) })),
  topics: z.array(topicSchema),
  topicsSource: z.enum(['live', 'static']),
  howToReach: z.string(),
}

export type McpSource = z.infer<typeof mcpSourceSchema>
export type McpTopic = z.infer<typeof topicSchema>
