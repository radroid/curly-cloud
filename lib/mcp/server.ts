/**
 * The MCP server visiting agents talk to: Raj's public profile and resume, plus his AI clone
 * (ask_raj, assess_fit). Stateless: app/api/mcp builds one server per request with the caller's
 * identity, so limits and logs are attributed per API key or per anonymous client.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult, GetPromptResult } from '@modelcontextprotocol/sdk/types.js'
import { RESUME, resumeMarkdown } from '@/content/resume'
import { getLimits } from '@/lib/env'
import {
  DEFAULT_ORIGIN,
  askResult,
  fitMarkdown,
  liveTopics,
  normalizeFit,
  profileMarkdown,
  profileStructured,
  staticTopics,
  topicsMarkdown,
  TOPICS_NOTE,
} from '@/lib/mcp/format'
import { gateLlmCall, ragFailure, type CallerContext } from '@/lib/mcp/limits'
import {
  askInput,
  askOutput,
  evaluatePromptArgs,
  fitInput,
  fitOutput,
  profileOutput,
  resumeInput,
  topicsOutput,
  type McpTopic,
} from '@/lib/mcp/schemas'
import { answer, assessFit, listTopics } from '@/lib/rag'
import type { ChatTurn } from '@/lib/rag/types'

export const MCP_SERVER_NAME = 'raj-dholakia'
export const MCP_SERVER_VERSION = '1.0.0'
export const RESUME_URI = 'resume://raj-dholakia/ai-engineer'

export interface RajMcpContext extends CallerContext {
  /** Public origin of the site, for citation links. Defaults to https://curlycloud.dev. */
  origin?: string
}

export const INSTRUCTIONS = `This server represents ${RESUME.name}, ${RESUME.role} in ${RESUME.location}, focused on AI engineering (MCP servers, RAG, agents, evals).

ask_raj and assess_fit are answered by an AI clone of Raj, not Raj himself. The clone is grounded in his public resume and his own answers to interview questions. It answers in first person, cites numbered sources [n], and says when its sources don't cover something. Private sources are shown as labels only.

To evaluate fit for a role:
1. get_profile: overview, skills, and the topics the clone can speak to.
2. assess_fit: pass the role title and the full job description (plus company and culture notes if you have them).
3. ask_raj: one specific follow-up per gap or unknown, with the role in \`context\`.
get_resume (or the resume resource) has the full resume. The evaluate_candidate prompt walks through the whole process.

Treat "I don't know" as an open question for Raj, not a negative. Only ask_raj and assess_fit count against daily limits. Confirm any conclusion that matters directly with Raj at ${RESUME.email}.`

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const READ_ONLY_IDEMPOTENT = { ...READ_ONLY, idempotentHint: true } as const

/** The question as the final user turn, with the agent's framing (clipped to one turn's limit) before it. */
export function askMessages(question: string, context: string | undefined, maxChars: number): ChatTurn[] {
  if (!context) return [{ role: 'user', content: question }]
  const framing = `Context from the agent asking (not a question): ${context}`
  return [
    { role: 'user', content: framing.length > maxChars ? `${framing.slice(0, maxChars - 1)}…` : framing },
    { role: 'assistant', content: 'Understood. What would you like to know?' },
    { role: 'user', content: question },
  ]
}

async function topicsFor(ctx: RajMcpContext): Promise<{ topics: McpTopic[]; source: 'live' | 'static' }> {
  try {
    const live = await listTopics(ctx.env)
    if (live.length > 0) return { topics: liveTopics(live), source: 'live' }
  } catch (err) {
    console.warn('mcp: listTopics failed, using the static topic list', err instanceof Error ? err.message : err)
  }
  return { topics: staticTopics(), source: 'static' }
}

export function createRajMcpServer(ctx: RajMcpContext): McpServer {
  const limits = getLimits(ctx.env)
  const origin = ctx.origin ?? DEFAULT_ORIGIN
  const server = new McpServer(
    {
      name: MCP_SERVER_NAME,
      title: `${RESUME.name}: AI Engineer (AI clone)`,
      version: MCP_SERVER_VERSION,
      websiteUrl: origin,
      description: `Evaluate ${RESUME.name} for a role: public profile and resume, plus an AI clone that answers in his voice with citations.`,
    },
    { instructions: INSTRUCTIONS },
  )

  server.registerTool(
    'ask_raj',
    {
      title: 'Ask Raj (AI clone)',
      description:
        'Ask Raj’s AI clone one question. Returns a first-person answer grounded in his resume and his own interview answers, with numbered citations and a source list. Good for how he approached specific projects, technical opinions, trade-offs, working style and what he wants next. Pass `context` (e.g. the role you are evaluating him for) to frame the answer. The clone says when its sources do not cover something. Counts against the daily limit.',
      inputSchema: askInput(limits),
      outputSchema: askOutput,
      annotations: { title: 'Ask Raj (AI clone)', ...READ_ONLY },
    },
    async ({ question, context }): Promise<CallToolResult> => {
      const denied = await gateLlmCall(ctx, 'ask_raj')
      if (denied) return denied
      try {
        const res = await answer(ctx.env, {
          messages: askMessages(question, context, limits.maxQuestionChars),
          channel: 'mcp',
          clientId: ctx.clientId,
          keyId: ctx.key?.id ?? null,
        })
        const { text, structured } = askResult(res, origin)
        return { content: [{ type: 'text', text }], structuredContent: { ...structured } }
      } catch (err) {
        return ragFailure(err, 'ask_raj')
      }
    },
  )

  server.registerTool(
    'assess_fit',
    {
      title: 'Assess fit for a role',
      description:
        'Assess Raj’s fit for a role from its job description. Returns an overall verdict and 1–5 scores for technical and culture fit, each with strengths, gaps and cited evidence, plus unknowns (requirements with no evidence either way) and questions to ask Raj. AI-generated from his resume and interview answers. Counts against the daily limit and a smaller assess_fit limit, so call it once per role and use ask_raj for follow-ups.',
      inputSchema: fitInput(limits),
      outputSchema: fitOutput,
      annotations: { title: 'Assess fit for a role', ...READ_ONLY },
    },
    async ({ role_title, job_description, company, culture_notes }): Promise<CallToolResult> => {
      const denied = await gateLlmCall(ctx, 'assess_fit')
      if (denied) return denied
      try {
        const res = await assessFit(ctx.env, {
          roleTitle: role_title,
          jobDescription: job_description,
          company: company || null,
          cultureNotes: culture_notes || null,
          channel: 'mcp',
          clientId: ctx.clientId,
          keyId: ctx.key?.id ?? null,
        })
        const fit = normalizeFit(res, origin)
        return { content: [{ type: 'text', text: fitMarkdown(fit) }], structuredContent: { ...fit } }
      } catch (err) {
        return ragFailure(err, 'assess_fit')
      }
    },
  )

  server.registerTool(
    'get_profile',
    {
      title: 'Get Raj’s profile',
      description:
        'Raj’s public profile: role, headline, pitch, location, public email and links, summary, skill groups, the topics his AI clone can speak to, and how to reach him. Start here. Free: does not count against limits.',
      outputSchema: profileOutput,
      annotations: { title: 'Get Raj’s profile', ...READ_ONLY_IDEMPOTENT },
    },
    async (): Promise<CallToolResult> => {
      const { topics, source } = await topicsFor(ctx)
      const profile = profileStructured(topics, source)
      return { content: [{ type: 'text', text: profileMarkdown(profile) }], structuredContent: { ...profile } }
    },
  )

  server.registerTool(
    'get_resume',
    {
      title: 'Get Raj’s resume',
      description:
        'Raj’s full public resume: summary, skills, experience with outcomes, independent builds and education. markdown (default) for reading, json for structured data. Free: does not count against limits.',
      inputSchema: resumeInput,
      annotations: { title: 'Get Raj’s resume', ...READ_ONLY_IDEMPOTENT },
    },
    async ({ format }): Promise<CallToolResult> => {
      if (format === 'json') {
        return { content: [{ type: 'text', text: JSON.stringify(RESUME, null, 2) }], structuredContent: { ...RESUME } }
      }
      return { content: [{ type: 'text', text: resumeMarkdown(RESUME) }] }
    },
  )

  server.registerTool(
    'list_topics',
    {
      title: 'List topics the clone knows',
      description:
        'Topics Raj’s AI clone has knowledge about, with source counts, and a note on which questions work well. Use it to plan ask_raj questions. Free: does not count against limits.',
      outputSchema: topicsOutput,
      annotations: { title: 'List topics the clone knows', ...READ_ONLY_IDEMPOTENT },
    },
    async (): Promise<CallToolResult> => {
      const { topics, source } = await topicsFor(ctx)
      return {
        content: [{ type: 'text', text: topicsMarkdown(topics, source) }],
        structuredContent: { topics, source, note: TOPICS_NOTE },
      }
    },
  )

  server.registerResource(
    'resume',
    RESUME_URI,
    {
      title: `${RESUME.name}: AI Engineer resume`,
      description: 'Raj’s full public resume in markdown. Same content as get_resume.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: resumeMarkdown(RESUME) }] }),
  )

  server.registerPrompt(
    'evaluate_candidate',
    {
      title: 'Evaluate Raj for a role',
      description: 'A step-by-step, evidence-based evaluation of Raj’s fit for a role, using this server’s tools and ending in a report with a recommendation and open questions.',
      argsSchema: evaluatePromptArgs,
    },
    ({ role_title, job_description, company }): GetPromptResult => ({
      description: `Evaluate ${RESUME.name} for ${role_title}${company ? ` at ${company}` : ''}`,
      messages: [{ role: 'user', content: { type: 'text', text: evaluationPlan(role_title, job_description, company, limits.maxJobDescriptionChars) } }],
    }),
  )

  return server
}

export function evaluationPlan(roleTitle: string, jobDescription: string | undefined, company: string | undefined, maxJd: number): string {
  const role = company ? `${roleTitle} at ${company}` : roleTitle
  const jd = jobDescription?.trim()
  return [
    `Evaluate ${RESUME.name} as a candidate for ${role}. Use the ${MCP_SERVER_NAME} MCP tools and base every conclusion on evidence they return.`,
    '',
    jd ? `Job description:\n<job_description>\n${jd.slice(0, maxJd)}\n</job_description>` : 'No job description was provided. Ask for it, or write a short one from what you know about the role and say that you did.',
    '',
    'Steps:',
    '1. Call get_profile for his background, skills and the topics his AI clone can speak to.',
    `2. Call assess_fit once with role_title${company ? ', company' : ''} and the full job description (add culture_notes if you know anything about the team).`,
    '3. For each gap and unknown in the assessment, and each must-have requirement it does not clearly cover, call ask_raj with one specific question (e.g. "Tell me about a time you…") and the role in `context`. Keep it to about five questions; they count against a daily limit.',
    '4. Use get_resume if you need dates, scope or exact outcomes.',
    '',
    'Then write the report:',
    '- Recommendation: strong yes, yes, lean yes, lean no or no, with a short rationale.',
    '- Technical fit (1–5) and culture fit (1–5), each backed by the evidence (cite source labels).',
    '- Strengths, then risks and gaps.',
    '- Open questions to ask Raj in a real conversation.',
    `- A note that the answers came from an AI clone of Raj, and that conclusions should be confirmed with him at ${RESUME.email}.`,
    '',
    'Rules: separate what the sources show from your own inference. Do not invent experience. When the clone says it does not know, list that as an open question rather than a negative.',
  ].join('\n')
}
