'use client'

import { useEffect, useState } from 'react'
import { RESUME } from '@/content/resume'
import { SectionHeading } from './resume'

const TOOLS: { name: string; args: string; does: string }[] = [
  { name: 'ask_raj', args: 'question, context?', does: 'Ask anything. First-person answer with cited sources.' },
  { name: 'assess_fit', args: 'role_title, job_description, company?, culture_notes?', does: 'Structured technical + culture fit, with evidence and open questions.' },
  { name: 'get_profile', args: '', does: 'Who I am, skills, links, and the topics the clone can speak to.' },
  { name: 'get_resume', args: 'format', does: 'The full resume as Markdown or JSON.' },
  { name: 'list_topics', args: '', does: 'What the clone knows about, with coverage counts.' },
]

type Tab = 'claude-code' | 'claude-ai' | 'json' | 'curl'

export function AgentsSection() {
  const [origin, setOrigin] = useState('https://curlycloud.dev')
  const [tab, setTab] = useState<Tab>('claude-code')
  useEffect(() => setOrigin(window.location.origin), [])
  const url = `${origin}/mcp`

  const snippets: Record<Tab, { label: string; code: string }> = {
    'claude-code': { label: 'Claude Code', code: `claude mcp add --transport http raj-dholakia ${url}` },
    'claude-ai': {
      label: 'Claude app',
      code: `Settings → Connectors → Add custom connector\n\nName: Raj Dholakia\nURL:  ${url}`,
    },
    json: {
      label: '.mcp.json / Cursor',
      code: JSON.stringify({ mcpServers: { 'raj-dholakia': { type: 'http', url } } }, null, 2),
    },
    curl: {
      label: 'curl',
      code: `curl -s ${url} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ask_raj","arguments":{"question":"What are you building now?"}}}'`,
    },
  }

  return (
    <section id="agents" aria-labelledby="agents-title" className="mb-16 scroll-mt-24">
      <SectionHeading id="agents-title" index="08" title="For agents: connect over MCP" meta="Streamable HTTP" />
      <div className="max-w-[62ch] space-y-3 text-[0.95rem] leading-relaxed">
        <p>
          If your team screens candidates with an agent, point it here. It can interview my clone directly, pull my resume, and run a
          structured fit assessment against your role — every answer cites its sources.
        </p>
        <p className="text-muted">
          Anonymous access works with a daily limit. For higher limits, and so I know whose agent is asking, email me for a key at{' '}
          <a href={`mailto:${RESUME.email}?subject=MCP%20key`} className="text-forest underline underline-offset-2">
            {RESUME.email}
          </a>
          .
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-term-bg text-term-text">
        <div className="flex items-center gap-3 border-b border-term-dim/25 px-4 py-3">
          <span className="font-mono text-xs text-term-dim">endpoint</span>
          <code className="min-w-0 flex-1 truncate font-mono text-sm">{url}</code>
          <CopyButton text={url} />
        </div>
        <div className="flex items-center gap-2 px-3 pt-3">
          <div role="tablist" aria-label="Setup snippets" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
            {(Object.keys(snippets) as Tab[]).map((k) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${tab === k ? 'bg-term-text/10 text-term-text' : 'text-term-dim hover:text-term-text'}`}
              >
                {snippets[k].label}
              </button>
            ))}
          </div>
          <CopyButton text={snippets[tab].code} />
        </div>
        <pre role="tabpanel" className="overflow-x-auto px-4 pb-5 pt-3 font-mono text-[0.78rem] leading-relaxed">
          <code>{snippets[tab].code}</code>
        </pre>
        <p className="border-t border-term-dim/25 px-4 py-3 text-xs text-term-dim">
          With a key, add the header <span className="font-mono text-term-text">Authorization: Bearer rc_…</span>
        </p>
      </div>

      <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-2">
        {TOOLS.map((t) => (
          <li key={t.name} className="bg-white px-4 py-3">
            <p className="font-mono text-[0.8rem]">
              <span className="font-medium text-forest">{t.name}</span>
              <span className="text-muted">({t.args})</span>
            </p>
            <p className="mt-0.5 text-sm text-muted">{t.does}</p>
          </li>
        ))}
        <li className="bg-white px-4 py-3 text-sm text-muted">
          Plus resource <code className="font-mono text-xs text-ink">resume://raj-dholakia/ai-engineer</code>, prompt{' '}
          <code className="font-mono text-xs text-ink">evaluate_candidate</code>, and a plain-text brief at{' '}
          <a href="/llms.txt" className="font-mono text-xs text-forest underline underline-offset-2">
            /llms.txt
          </a>
          .
        </li>
      </ul>
    </section>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        })
      }}
      className="shrink-0 rounded-md border border-term-dim/40 px-2 py-0.5 text-xs text-term-dim hover:border-term-text hover:text-term-text"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}
