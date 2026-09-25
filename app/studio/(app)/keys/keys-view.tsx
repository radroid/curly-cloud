'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ConfirmButton, CopyButton, Modal } from '@/app/studio/_components/overlays'
import { btn, cx, Empty, Eyebrow, Field, input, Notice, PageHeader, Panel, Spinner, Tag } from '@/app/studio/_components/ui'
import { studio, type ApiFailure } from '@/lib/studio/api'
import { fmtDate, fmtDateTime, fmtNum, timeAgo } from '@/lib/studio/shared'
import type { CreatedKey, KeyItem } from '@/lib/studio/types'

const PLACEHOLDER = 'rc_YOUR_KEY'

// ── Snippets ─────────────────────────────────────────────────────────────────

type SnippetId = 'claude-code' | 'cursor' | 'claude-desktop' | 'curl'

const SNIPPET_TABS: { id: SnippetId; label: string; where: string }[] = [
  { id: 'claude-code', label: 'Claude Code', where: 'Run in a terminal.' },
  { id: 'cursor', label: 'Cursor', where: 'Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project).' },
  { id: 'claude-desktop', label: 'Claude Desktop', where: 'Add to claude_desktop_config.json. Uses mcp-remote to bridge the HTTP server.' },
  { id: 'curl', label: 'curl', where: 'One-off call to the ask_raj tool.' },
]

export function snippet(id: SnippetId, origin: string, token: string): string {
  const url = `${origin}/mcp`
  switch (id) {
    case 'claude-code':
      return `claude mcp add --transport http raj-dholakia ${url} --header "Authorization: Bearer ${token}"`
    case 'cursor':
      return JSON.stringify({ mcpServers: { 'raj-dholakia': { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
    case 'claude-desktop':
      return JSON.stringify(
        {
          mcpServers: {
            'raj-dholakia': {
              command: 'npx',
              args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${AUTH_HEADER}'],
              env: { AUTH_HEADER: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      )
    case 'curl':
      return [
        `curl -s ${url} \\`,
        `  -H "Authorization: Bearer ${token}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -H "Accept: application/json, text/event-stream" \\`,
        `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ask_raj","arguments":{"question":"What are you building right now?"}}}'`,
      ].join('\n')
  }
}

function Snippets({ origin, token }: { origin: string; token: string }) {
  const [tab, setTab] = useState<SnippetId>('claude-code')
  const current = SNIPPET_TABS.find((t) => t.id === tab) ?? SNIPPET_TABS[0]
  const text = snippet(tab, origin, token)
  return (
    <div className="overflow-hidden rounded-md border border-rule bg-white">
      <div role="tablist" aria-label="Client" className="flex overflow-x-auto border-b border-rule bg-paper/60 [scrollbar-width:none]">
        {SNIPPET_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'shrink-0 border-b-2 px-3 py-2 text-[13px]',
              tab === t.id ? 'border-forest font-medium text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{current.where}</p>
          <CopyButton text={text} />
        </div>
        <pre className="overflow-x-auto rounded bg-term-bg p-3 font-mono text-[12px] leading-5 text-term-text">{text}</pre>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function KeysView() {
  const [items, setItems] = useState<KeyItem[] | null>(null)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [label, setLabel] = useState('')
  const [limit, setLimit] = useState('500')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedKey | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [origin, setOrigin] = useState('https://curlycloud.dev')

  useEffect(() => setOrigin(window.location.origin), [])

  const load = useCallback(async () => {
    const res = await studio.keys.list()
    if (res.ok) {
      setItems(res.data.items)
      setError(null)
    } else setError(res)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    const dailyLimit = Number(limit)
    setCreating(true)
    setCreateError(null)
    const res = await studio.keys.create(label.trim(), Number.isFinite(dailyLimit) && dailyLimit > 0 ? Math.round(dailyLimit) : undefined)
    setCreating(false)
    if (res.ok) {
      setCreated(res.data)
      setLabel('')
      void load()
    } else setCreateError(res.message)
  }

  async function revoke(id: string) {
    setRevoking(id)
    const res = await studio.keys.revoke(id)
    setRevoking(null)
    if (!res.ok) setError(res)
    void load()
  }

  const active = items?.filter((k) => !k.revokedAt) ?? []
  const revoked = items?.filter((k) => k.revokedAt) ?? []

  return (
    <>
      <PageHeader
        index="04"
        section="Keys"
        title="MCP keys for companies"
        description="Give a company’s agent its own key: you’ll see which company asked what, it gets its own daily limit, and you can revoke it any time. Agents without a key use the anonymous tier."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Panel title="New key" className="self-start">
          <form onSubmit={create} className="space-y-3">
            <Field label="Who it’s for" htmlFor="key-label" hint="Shown next to every question this key asks.">
              <input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Acme — AI platform team"
                maxLength={120}
                required
                className={input}
              />
            </Field>
            <Field label="Daily limit" htmlFor="key-limit" hint="MCP calls per UTC day.">
              <input
                id="key-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className={cx(input, 'font-mono')}
              />
            </Field>
            {createError ? <Notice tone="error">{createError}</Notice> : null}
            <button type="submit" className={cx(btn.primary, 'w-full')} disabled={creating || !label.trim()}>
              {creating ? (
                <>
                  <Spinner /> Creating…
                </>
              ) : (
                'Create key'
              )}
            </button>
          </form>
        </Panel>

        <Panel title="Keys" meta={items ? `${active.length} active · ${revoked.length} revoked` : undefined} bodyClassName="p-0">
          {error ? (
            <div className="p-4">
              <Notice tone="error">{error.message}</Notice>
            </div>
          ) : null}
          {!items && !error ? (
            <p className="px-4 py-10 text-center text-sm text-muted">
              <Spinner className="mr-2" /> Loading…
            </p>
          ) : items && !items.length ? (
            <Empty>No keys yet. Create one for the first company that asks to connect an agent.</Empty>
          ) : (
            <ul className="divide-y divide-rule">
              {[...active, ...revoked].map((k) => (
                <KeyRow key={k.id} item={k} busy={revoking === k.id} onRevoke={() => revoke(k.id)} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section className="mt-6">
        <details className="group rounded-lg border border-rule bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <span>
              <span className="block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink">Connection snippets</span>
              <span className="mt-0.5 block text-sm text-muted">What to send a company, with a placeholder instead of the key.</span>
            </span>
            <span aria-hidden className="font-mono text-muted transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="border-t border-rule p-4">
            <Snippets origin={origin} token={PLACEHOLDER} />
          </div>
        </details>
      </section>

      <Modal open={!!created} onClose={() => setCreated(null)} title={created ? `Key for ${created.record.label}` : ''} dismissLabel="I’ve copied it">
        {created ? (
          <div className="space-y-4">
            <Notice tone="warn" title="This is the only time you’ll see this key">
              Only a hash is stored. If it’s lost, revoke it and create another.
            </Notice>
            <div>
              <Eyebrow>Key</Eyebrow>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 select-all break-all rounded-md border border-rule bg-white px-3 py-2 font-mono text-[13px] text-ink">{created.token}</code>
                <CopyButton text={created.token} className="h-9 px-3" />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-muted">
                {fmtNum(created.record.dailyLimit)} calls/day · created {fmtDateTime(created.record.createdAt)}
              </p>
            </div>
            <div>
              <Eyebrow className="mb-1.5">Ready to paste</Eyebrow>
              <Snippets origin={origin} token={created.token} />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}

function KeyRow({ item, busy, onRevoke }: { item: KeyItem; busy: boolean; onRevoke: () => void }) {
  const share = item.dailyLimit ? Math.min(1, item.usedToday / item.dailyLimit) : 0
  const revoked = !!item.revokedAt
  return (
    <li className={cx('grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center', revoked && 'bg-paper/50')}>
      <div className="min-w-0">
        <p className={cx('truncate text-sm font-medium', revoked ? 'text-muted' : 'text-ink')}>{item.label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
          <span>{item.prefix}…</span>
          {revoked ? <Tag tone="muted">revoked {fmtDate(item.revokedAt)}</Tag> : <Tag tone="forest">active</Tag>}
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] tabular-nums">
          <span className="text-muted">today</span>
          <span className="text-ink">
            {fmtNum(item.usedToday)} <span className="text-muted">/ {fmtNum(item.dailyLimit)}</span>
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-ink/[0.06]">
          <div className={cx('h-full rounded-full', share > 0.8 ? 'bg-coral' : 'bg-forest')} style={{ width: `${share * 100}%` }} />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums md:grid-cols-3">
        <div>
          <dt className="text-muted">calls</dt>
          <dd className="text-ink">{fmtNum(item.useCount)}</dd>
        </div>
        <div>
          <dt className="text-muted">asked</dt>
          <dd>
            <Link href={`/studio/logs?channel=mcp&key=${encodeURIComponent(item.id)}`} className="text-forest hover:underline" title="Questions this key asked (today / all)">
              {fmtNum(item.questionsToday)}/{fmtNum(item.questionsTotal)}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted">last used</dt>
          <dd className="truncate text-ink" title={fmtDateTime(item.lastUsedAt)}>
            {item.lastUsedAt ? timeAgo(item.lastUsedAt) : 'never'}
          </dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="font-mono text-[11px] text-muted md:hidden">created {fmtDate(item.createdAt)}</span>
        {revoked ? (
          <span className="hidden font-mono text-[11px] text-muted md:inline">created {fmtDate(item.createdAt)}</span>
        ) : (
          <ConfirmButton label="Revoke" confirmLabel="Revoke key" onConfirm={onRevoke} busy={busy} />
        )}
      </div>
    </li>
  )
}
