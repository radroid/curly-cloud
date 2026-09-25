import type { Metadata } from 'next'
import Link from 'next/link'
import { ChannelMark, cx, Eyebrow, Figure, KindMark, Notice, PageHeader, Panel, Tag } from '@/app/studio/_components/ui'
import { Sparkline } from '@/app/studio/_components/sparkline'
import { getAppEnv } from '@/lib/env'
import type { SourceKind } from '@/lib/rag/types'
import { requireStudioSession } from '@/lib/studio/session'
import { SOURCE_KINDS, fmtCompact, fmtNum, timeAgo, truncate } from '@/lib/studio/shared'
import { getStudioStats } from '@/lib/studio/stats'
import type { StudioStats } from '@/lib/studio/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  await requireStudioSession()
  const stats = await getStudioStats(await getAppEnv())
  const totalSources = Object.values(stats.sourcesByKind).reduce((a, b) => a + b, 0)
  const privateSources = stats.sourcesByKind.interview + stats.sourcesByKind.note + stats.sourcesByKind.correction
  const today = stats.channels.reduce((a, c) => a + c.today, 0)
  const week = stats.channels.reduce((a, c) => a + c.week, 0)

  return (
    <>
      <PageHeader
        index="01"
        section="Dashboard"
        title="How the clone is doing"
        description="What it knows, where it’s thin, and what people have been asking it."
        actions={
          <Link href="/studio/playground" className="font-mono text-xs text-forest underline decoration-rule underline-offset-4 hover:decoration-forest">
            Ask it something →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-3 xl:grid-cols-6 [&>*]:bg-white">
        <Figure label="Sources" value={fmtNum(totalSources)} note={`${fmtNum(privateSources)} private · ${fmtNum(totalSources - privateSources)} public`} />
        <Figure label="Asked today" value={fmtNum(today)} note={`${fmtNum(week)} in the last 7 days`} />
        <Link href="/studio/logs?flagged=1" className="block hover:bg-marker/30">
          <Figure label="Flagged" value={fmtNum(stats.flagged)} tone={stats.flagged ? 'coral' : undefined} note={stats.flagged ? 'waiting for a correction →' : 'nothing waiting'} />
        </Link>
        <Figure label="Guarded · 7d" value={fmtNum(stats.guarded.week)} note={`${fmtNum(stats.guarded.total)} all time`} />
        <Figure label="Corrections" value={fmtNum(stats.corrections)} tone={stats.corrections ? 'forest' : undefined} note="answers you fixed" />
        <Link href="/studio/keys" className="block hover:bg-paper">
          <Figure label="MCP keys" value={fmtNum(stats.keys.active)} note={`${fmtNum(stats.keys.revoked)} revoked`} />
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Coverage stats={stats} className="lg:col-span-7 lg:row-span-2" />
        <Usage stats={stats} className="lg:col-span-5" />
        <Corpus stats={stats} className="lg:col-span-5" />
        <Recent stats={stats} className="lg:col-span-7" />
        <Channels stats={stats} className="lg:col-span-5" />
      </div>
    </>
  )
}

function Coverage({ stats, className }: { stats: StudioStats; className?: string }) {
  const topics = stats.coverage.filter((t) => t.origin === 'interview')
  const max = Math.max(1, ...topics.map((t) => t.sources))
  const thin = topics.filter((t) => t.thin)
  const answers = topics.reduce((a, t) => a + t.sources, 0)
  const words = topics.reduce((a, t) => a + t.words, 0)
  return (
    <Panel title="Coverage by interview topic" meta={`${fmtNum(answers)} sources · ${fmtCompact(words)} words`} className={className} bodyClassName="p-0">
      {thin.length ? (
        <p className="border-b border-rule px-4 py-3 text-sm leading-relaxed text-ink">
          <span className="text-muted">Answer more of these: </span>
          {thin.map((t, i) => (
            <span key={t.topic}>
              <Link href={`/studio/knowledge?topic=${encodeURIComponent(t.topic)}`} className="rounded-sm bg-marker px-1 py-px font-medium hover:bg-sun/60">
                {t.label}
              </Link>
              {i < thin.length - 1 ? <span className="text-muted">, </span> : null}
            </span>
          ))}
          <span className="text-muted">.</span>
        </p>
      ) : null}
      <ul className="py-1.5">
        {topics.map((t) => (
          <li key={t.topic}>
            <Link
              href={`/studio/knowledge?topic=${encodeURIComponent(t.topic)}`}
              className={cx(
                'grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-[7px] hover:bg-paper sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_7.5rem]',
                t.thin && 'bg-marker/35 hover:bg-marker/60',
              )}
            >
              <span className="truncate text-[13px] text-ink">
                {t.label}
                {t.thin ? <span className="ml-1.5 hidden font-mono text-[10px] uppercase tracking-wider text-muted sm:inline">thin</span> : null}
              </span>
              <span className="relative h-2 min-w-0 rounded-[3px] bg-ink/[0.05]">
                <span
                  className="absolute inset-y-0 left-0 rounded-[3px] bg-forest"
                  style={{ width: t.sources ? `max(4px, ${(t.sources / max) * 100}%)` : 0 }}
                />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-muted">
                <span className="text-ink">{t.sources}</span>
                <span className="hidden sm:inline"> · {fmtCompact(t.words)}w</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-rule px-4 py-2.5 text-xs text-muted">
        Counts interview answers, notes and corrections. Resume topics come from <code className="font-mono text-ink">content/resume.ts</code> ({fmtNum(stats.sourcesByKind.resume + stats.sourcesByKind.profile)} sources).
      </p>
    </Panel>
  )
}

function Usage({ stats, className }: { stats: StudioStats; className?: string }) {
  const total = stats.usage.reduce((a, d) => a + d.requests, 0)
  const { usedToday, dailyTokens } = stats.budget
  const share = dailyTokens ? usedToday / dailyTokens : 0
  return (
    <Panel title="Usage" meta={`${fmtNum(total)} requests · 14 days`} className={className}>
      <Sparkline days={stats.usage} />
      <div className="mt-4 border-t border-rule pt-3">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Token budget today</Eyebrow>
          <p className="font-mono text-[11px] tabular-nums text-muted">
            <span className="text-ink">{fmtCompact(usedToday)}</span> / {fmtCompact(dailyTokens)} · {(share * 100).toFixed(share < 0.1 ? 2 : 0)}%
          </p>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-ink/[0.06]">
          <div className={cx('h-full rounded-full', share > 0.8 ? 'bg-coral' : 'bg-forest')} style={{ width: `${Math.min(100, share * 100)}%` }} />
        </div>
      </div>
    </Panel>
  )
}

function Corpus({ stats, className }: { stats: StudioStats; className?: string }) {
  const counts: Record<SourceKind, number> = stats.corpus?.sources ?? stats.sourcesByKind
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const c = stats.corpus
  return (
    <Panel title="Knowledge base" meta={c ? `corpus v${c.corpusVersion}` : 'from D1'} className={className}>
      {!c ? (
        <Notice tone="warn" title="Retrieval stats unavailable" className="mb-3">
          <code>{stats.corpusError ?? 'lib/rag did not answer'}</code>. The counts below come straight from D1.
        </Notice>
      ) : null}
      <ul className="space-y-1.5">
        {SOURCE_KINDS.map((kind) => (
          <li key={kind} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-3">
            <Link href={`/studio/knowledge?kind=${kind}`} className="hover:underline">
              <KindMark kind={kind} />
            </Link>
            <span className="h-1.5 rounded-[3px] bg-ink/[0.05]">
              <span className="block h-full rounded-[3px] bg-pine/70" style={{ width: total ? `${(counts[kind] / total) * 100}%` : 0 }} />
            </span>
            <span className="text-right font-mono text-xs tabular-nums text-ink">{fmtNum(counts[kind])}</span>
          </li>
        ))}
      </ul>
      {c ? (
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-rule pt-3">
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Chunks</dt>
            <dd className="mt-0.5 font-mono text-sm tabular-nums">{fmtNum(c.chunks)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Embedded</dt>
            <dd className={cx('mt-0.5 font-mono text-sm tabular-nums', c.embedded < c.chunks && 'text-coral')}>
              {c.chunks ? `${Math.round((c.embedded / c.chunks) * 100)}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Persona</dt>
            <dd className="mt-0.5 font-mono text-sm">
              <Link href="/studio/persona" className="hover:underline">
                {c.persona.updatedAt ? timeAgo(c.persona.updatedAt) : 'not built'}
              </Link>
            </dd>
          </div>
        </dl>
      ) : null}
    </Panel>
  )
}

function Recent({ stats, className }: { stats: StudioStats; className?: string }) {
  return (
    <Panel
      title="Recent questions"
      className={className}
      bodyClassName="p-0"
      actions={
        <Link href="/studio/logs" className="font-mono text-[11px] text-forest hover:underline">
          all →
        </Link>
      }
    >
      {stats.recent.length ? (
        <ol className="divide-y divide-rule">
          {stats.recent.map((r) => (
            <li key={r.id}>
              <Link href={`/studio/logs?open=${encodeURIComponent(r.id)}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 hover:bg-paper sm:grid-cols-[4.5rem_4.5rem_minmax(0,1fr)_auto]">
                <span className="font-mono text-[11px] tabular-nums text-muted">{timeAgo(r.createdAt, stats.generatedAt)}</span>
                <span className="hidden sm:block">
                  <ChannelMark channel={r.channel} />
                </span>
                <span className="truncate text-sm text-ink">{truncate(r.question, 140)}</span>
                <span className="col-start-2 flex gap-1 sm:col-start-auto">
                  {r.guarded ? <Tag tone="coral">guarded</Tag> : null}
                  {r.flagged ? <Tag tone="marker">flagged</Tag> : null}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-muted">No questions yet. They’ll land here as visitors and agents ask.</p>
      )}
    </Panel>
  )
}

function Channels({ stats, className }: { stats: StudioStats; className?: string }) {
  const week = stats.channels.reduce((a, c) => a + c.week, 0)
  return (
    <Panel title="Channels" meta="today · 7 days" className={className}>
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Channel</th>
            <th>Today</th>
            <th>7 days</th>
            <th>Share of 7 days</th>
          </tr>
        </thead>
        <tbody>
          {stats.channels.map((c) => (
            <tr key={c.channel}>
              <td className="py-1.5 pr-3">
                <Link href={`/studio/logs?channel=${c.channel}`} className="hover:underline">
                  <ChannelMark channel={c.channel} />
                </Link>
              </td>
              <td className="w-12 py-1.5 text-right font-mono text-xs tabular-nums text-ink">{fmtNum(c.today)}</td>
              <td className="w-12 py-1.5 text-right font-mono text-xs tabular-nums text-muted">{fmtNum(c.week)}</td>
              <td className="w-[40%] py-1.5 pl-4">
                <span className="block h-1.5 rounded-[3px] bg-ink/[0.05]">
                  <span className="block h-full rounded-[3px] bg-forest" style={{ width: week ? `${(c.week / week) * 100}%` : 0 }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
