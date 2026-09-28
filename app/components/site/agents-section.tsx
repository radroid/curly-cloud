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

const PICK = 'Pick a tool to see what it does.'

type Tab = 'claude-code' | 'claude-ai' | 'json' | 'curl'

/** C13. The MCP endpoint, setup snippets as tabs, and the tools as chips. */
export function AgentsSection() {
  const [origin, setOrigin] = useState('https://curlycloud.dev')
  const [tab, setTab] = useState<Tab>('claude-code')
  const [tool, setTool] = useState<string | null>(null)
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
  const tabs = Object.keys(snippets) as Tab[]

  // Tabs pattern: arrows, Home and End move between tabs; Tab moves on to the snippet.
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const n = tabs.length
    const keys: Record<string, number> = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }
    const to = keys[e.key]
    if (to === undefined) return
    e.preventDefault()
    setTab(tabs[to])
    document.getElementById(`agents-tab-${tabs[to]}`)?.focus()
  }

  const line = (t: (typeof TOOLS)[number]) => (
    <>
      <code className="font-mono text-[0.9em] text-ink">
        {t.name}({t.args})
      </code>{' '}
      {t.does}
    </>
  )
  const current = TOOLS.find((t) => t.name === tool)

  return (
    <section id="agents" aria-labelledby="agents-title" className="scroll-mt-16 pt-14 sm:pt-24">
      <SectionHeading id="agents-title" index={4} title="Agents" />
      <p className="mb-8 max-w-[54ch] text-[17px] leading-relaxed text-muted">
        Point your screening agent here. It can interview my clone, pull my resume and run a fit check over MCP.
      </p>

      <div className="max-w-[820px] overflow-hidden rounded-[18px] bg-night text-term-text print:border print:border-rule print:bg-transparent print:text-ink">
        <div className="flex items-center gap-3 border-b border-term-text/15 py-3.5 pl-4 pr-3 print:border-rule">
          <span className="sr-only">MCP endpoint:</span>
          <code className="min-w-0 flex-1 truncate font-mono text-[15px]">{url}</code>
          <CopyButton text={url} label="Copy the endpoint" />
        </div>
        <div className="flex items-center gap-2 px-3 pt-3 print:hidden">
          <div role="tablist" aria-label="Setup snippets" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
            {tabs.map((k, i) => (
              <button
                key={k}
                id={`agents-tab-${k}`}
                role="tab"
                type="button"
                aria-selected={tab === k}
                aria-controls="agents-snippet"
                tabIndex={tab === k ? 0 : -1}
                onClick={() => setTab(k)}
                onKeyDown={(e) => onTabKey(e, i)}
                className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] text-term-dim transition-colors hover:text-term-text aria-selected:bg-term-text/10 aria-selected:text-term-text pointer-coarse:min-h-11"
              >
                {snippets[k].label}
              </button>
            ))}
          </div>
          <CopyButton text={snippets[tab].code} label="Copy the snippet" />
        </div>
        <pre
          id="agents-snippet"
          role="tabpanel"
          aria-labelledby={`agents-tab-${tab}`}
          tabIndex={0}
          className="overflow-x-auto px-4 pb-5 pt-3.5 font-mono text-[13px] leading-[1.7] outline-offset-[-4px] [scrollbar-color:var(--color-term-dim)_transparent] [scrollbar-width:thin]"
        >
          <code>{snippets[tab].code}</code>
        </pre>
        <p className="border-t border-term-text/15 px-4 py-3 text-xs text-term-dim print:border-rule print:text-muted">
          With a key, add the header <span className="font-mono text-term-text print:text-ink">Authorization: Bearer rc_…</span>
        </p>
      </div>

      <ul aria-label="Tools" className="mt-[22px] flex max-w-[820px] flex-wrap gap-2">
        {TOOLS.map((t) => (
          <li key={t.name}>
            <button
              type="button"
              aria-expanded={tool === t.name}
              aria-controls="agents-tool"
              onFocus={() => setTool(t.name)}
              onClick={() => setTool(t.name)}
              className="inline-flex min-h-9 items-center rounded-lg border border-rule bg-white px-3 font-mono text-[13px] transition-colors hover:border-forest aria-expanded:border-forest aria-expanded:bg-forest aria-expanded:text-paper pointer-coarse:min-h-11"
            >
              {t.name}()
            </button>
          </li>
        ))}
      </ul>
      {/* Every description sits in the same grid cell, so the line keeps the height of the longest. */}
      <div className="mt-3 grid max-w-[820px] text-[15px] leading-normal text-muted wrap-anywhere">
        {[PICK, ...TOOLS].map((t) => (
          <p key={typeof t === 'string' ? t : t.name} aria-hidden className="invisible col-start-1 row-start-1">
            {typeof t === 'string' ? t : line(t)}
          </p>
        ))}
        <p id="agents-tool" aria-live="polite" className="col-start-1 row-start-1">
          {current ? line(current) : PICK}
        </p>
      </div>
      <p className="mt-2 font-mono text-[13px] leading-relaxed text-muted wrap-anywhere">
        Also: resource <code className="text-ink">resume://raj-dholakia/ai-engineer</code>, prompt <code className="text-ink">evaluate_candidate</code>, a
        plain-text brief at{' '}
        <a href="/llms.txt" className="text-forest underline decoration-current/45 underline-offset-4 hover:decoration-current">
          /llms.txt
        </a>
        .
      </p>
      <p className="mt-2 font-mono text-[13px] leading-relaxed text-muted">
        Anonymous access has a daily limit. For more,{' '}
        <a
          href={`mailto:${RESUME.email}?subject=MCP%20key`}
          className="text-forest underline decoration-current/45 underline-offset-4 hover:decoration-current"
        >
          email me for a key
        </a>
        .
      </p>
    </section>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={done ? 'Copied' : label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        })
      }}
      className="shrink-0 rounded-md border border-term-text/30 px-2.5 py-1 text-xs text-term-dim transition-colors hover:border-term-text hover:text-term-text pointer-coarse:min-h-11 pointer-coarse:px-3.5 print:hidden"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}
