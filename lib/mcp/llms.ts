/**
 * /llms.txt: a plain-text brief for agents (llmstxt.org convention) covering who Raj is, what the
 * site offers, and how to connect to the MCP server.
 */
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import { RESUME } from '@/content/resume'
import type { Limits } from '@/lib/env'
import { DEFAULT_ORIGIN } from '@/lib/mcp/format'
import { MAX_BODY_BYTES } from '@/lib/mcp/http'
import { MCP_SERVER_NAME, RESUME_URI } from '@/lib/mcp/server'

export function buildLlmsTxt(origin: string, limits: Limits): string {
  const mcpUrl = `${origin}/mcp`
  const production = `${DEFAULT_ORIGIN}/mcp`
  const current = RESUME.experience.find((r) => r.end === null)
  const init = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'curl', version: '0' } },
  })
  const cursorConfig = JSON.stringify(
    { mcpServers: { [MCP_SERVER_NAME]: { url: mcpUrl, headers: { Authorization: 'Bearer rc_YOUR_KEY' } } } },
    null,
    2,
  )
  const desktopConfig = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          command: 'npx',
          args: ['-y', 'mcp-remote', mcpUrl, '--header', 'Authorization:${AUTH_HEADER}'],
          env: { AUTH_HEADER: 'Bearer rc_YOUR_KEY' },
        },
      },
    },
    null,
    2,
  )

  return `# ${RESUME.name}: AI Engineer

> ${RESUME.name} is a ${RESUME.role}${current ? ` at ${current.company}` : ''} in ${RESUME.location}. In his words: "${RESUME.pitch}" This site is his interactive resume plus an AI clone of him that answers questions in his voice, grounded in his resume and his own interview answers, with citations. Agents can evaluate him for a role over MCP.

## About Raj

- Role: ${RESUME.role}. ${RESUME.headline}
- Location: ${RESUME.location}
- Email: ${RESUME.email}
${RESUME.links.map((l) => `- ${l.label}: ${l.href}`).join('\n')}

${RESUME.summary.join('\n\n')}
${RESUME.community.map((c) => `\nOutside work: ${c.company} (${c.role}). ${c.blurb ?? ''}`).join('')}

## What this site offers

- [Interactive resume](${origin}/): the human view, with the AI clone embedded.
- [MCP server](${mcpUrl}): tools for agents to read his profile and resume, ask his AI clone questions and assess fit for a role.
- [Resume and profile as JSON](${origin}/api/profile): the same public data, no MCP needed.
- [llms.txt](${origin}/llms.txt): this file.

## MCP server

Endpoint: ${mcpUrl}${mcpUrl === production ? '' : ` (production: ${production})`}
Transport: Streamable HTTP, stateless, JSON responses (POST only). Protocol ${LATEST_PROTOCOL_VERSION}; earlier versions are negotiated.
Auth: optional. Send "Authorization: Bearer rc_…" if you have an API key.${limits.mcpRequireKey ? ' A key is currently required.' : ' Without one you get the anonymous tier.'}

### Connect

Claude Code:

    claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl}
    # with an API key:
    claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl} --header "Authorization: Bearer rc_YOUR_KEY"

Cursor (~/.cursor/mcp.json) and other clients that take a URL (drop "headers" if you have no key):

${indent(cursorConfig)}

Claude Desktop: Settings → Connectors → Add custom connector, with the URL ${mcpUrl} (anonymous). With an API key, add this to claude_desktop_config.json instead:

${indent(desktopConfig)}

Raw JSON-RPC over HTTP:

    curl -sS ${mcpUrl} \\
      -H 'content-type: application/json' \\
      -H 'accept: application/json, text/event-stream' \\
      -d '${init}'

    curl -sS ${mcpUrl} \\
      -H 'content-type: application/json' \\
      -H 'accept: application/json, text/event-stream' \\
      -H 'mcp-protocol-version: ${LATEST_PROTOCOL_VERSION}' \\
      -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_profile","arguments":{}}}'

### Tools

- get_profile(): public profile, skills, the topics the clone can speak to, and how to reach Raj. Start here.
- get_resume(format = "markdown" | "json"): the full public resume.
- list_topics(): topics the clone has knowledge about, with source counts.
- ask_raj(question, context?): a first-person answer from the AI clone, with numbered citations and a source list.
- assess_fit(role_title, job_description, company?, culture_notes?): overall verdict, technical and culture scores with strengths, gaps and evidence, unknowns, and questions for Raj.

Resource: ${RESUME_URI} (text/markdown, the full resume).
Prompt: evaluate_candidate(role_title, job_description?, company?): a step-by-step, evidence-based fit evaluation.

Suggested flow: get_profile, then assess_fit with the full job description, then ask_raj follow-ups on each gap or unknown. Confirm conclusions with Raj.

## About the answers

- ask_raj and assess_fit are answered by an AI clone of Raj, not by Raj. They are AI-generated.
- The clone is grounded in his public resume and his own private interview answers. It cites numbered sources [n] and says when its sources do not cover something.
- Public sources come with the resume section, a snippet and a link. Private sources are shown by label only; their text never leaves the server.
- Questions are logged, with emails and phone numbers redacted, to improve the clone.
- Confirm anything important (hiring decisions, availability, compensation) with Raj at ${RESUME.email}.

## Limits

- Only ask_raj and assess_fit count. get_profile, get_resume, list_topics, the resource and the prompt are free.
- Anonymous: ${limits.mcpAnonPerDay} ask_raj/assess_fit calls per day per client.
- API key: a per-key daily limit (500 by default).
- assess_fit: at most ${limits.fitPerDay} per day per client or key.
- Limit errors come back as tool results with isError: true and a retry time. Limits reset at 00:00 UTC.
- Request bodies are capped at ${MAX_BODY_BYTES / 1024} KB; questions at ${limits.maxQuestionChars} characters and job descriptions at ${limits.maxJobDescriptionChars}.

## API keys

A key gives your company's agent its own higher daily limit and lets Raj see which company asked what. To request one, email ${RESUME.email} with your company name and what your agent will do. Send it as "Authorization: Bearer rc_…".
`
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n')
}
