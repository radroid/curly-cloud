'use client'

import { useEffect, useRef, useState } from 'react'
import type { CitationSource, FitAssessment, FitDimension } from '@/lib/rag/types'
import { RESUME } from '@/content/resume'
import { topicLabel } from '@/content/topics'
import { SectionHeading } from './resume'
import { useSite } from './site-context'

const MAX_JD = 12000

const VERDICT: Record<FitAssessment['overall']['verdict'], { label: string; tone: string }> = {
  strong: { label: 'Strong fit', tone: 'bg-forest text-paper' },
  promising: { label: 'Promising', tone: 'bg-term-accent text-pine' },
  mixed: { label: 'Mixed', tone: 'bg-sun text-ink' },
  weak: { label: 'Weak fit', tone: 'bg-coral-ink text-white' },
}

const STEPS = ['Reading the job description…', 'Pulling evidence from my resume and answers…', 'Weighing technical fit…', 'Weighing culture fit…', 'Writing it up…']

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: FitAssessment }
  | { phase: 'error'; message: string }

export function FitCheck() {
  const [roleTitle, setRoleTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [culture, setCulture] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })
  const resultRef = useRef<HTMLDivElement>(null)

  const submit = async () => {
    if (!roleTitle.trim() || jd.trim().length < 40 || state.phase === 'loading') return
    setState({ phase: 'loading' })
    try {
      const res = await fetch('/api/fit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roleTitle: roleTitle.trim(),
          jobDescription: jd.trim(),
          company: company.trim() || null,
          cultureNotes: culture.trim() || null,
          channel: 'web',
        }),
      })
      const data = (await res.json().catch(() => null)) as (FitAssessment & { error?: { code: string; message: string } }) | null
      if (!res.ok || !data || data.error) {
        const code = data?.error?.code
        setState({
          phase: 'error',
          message:
            code === 'rate_limited'
              ? 'You’ve run a few of these today — the limit resets tomorrow. Or email me the role directly.'
              : code === 'budget_exceeded'
                ? 'The clone has used up today’s budget. Try again tomorrow, or email me the role.'
                : (data?.error?.message ?? 'The fit check is unavailable right now. Email me the role and I’ll reply myself.'),
        })
        return
      }
      setState({ phase: 'done', result: data })
    } catch {
      setState({ phase: 'error', message: 'Couldn’t reach the fit check. Email me the role and I’ll reply myself.' })
    }
  }

  useEffect(() => {
    if (state.phase === 'done') resultRef.current?.focus({ preventScroll: false })
  }, [state.phase])

  return (
    <section id="fit" aria-labelledby="fit-title" className="mb-16 scroll-mt-24">
      <SectionHeading id="fit-title" index={3} title="Fit" meta="AI-assessed, cited" />
      <p className="max-w-[62ch] text-[0.95rem] leading-relaxed text-muted">
        Paste a job description. My clone scores technical and culture fit against what I’ve actually done and said, shows the evidence,
        and is upfront about what it doesn’t know.
      </p>

      {state.phase !== 'done' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="mt-6 space-y-4 rounded-2xl border border-rule bg-white p-4 sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role title" required>
              <input
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                maxLength={200}
                required
                placeholder="Senior AI Engineer"
                className="h-10 w-full rounded-lg border border-rule bg-paper/50 px-3 outline-none focus:border-forest"
              />
            </Field>
            <Field label="Company" hint="optional">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={200}
                placeholder="Acme"
                className="h-10 w-full rounded-lg border border-rule bg-paper/50 px-3 outline-none focus:border-forest"
              />
            </Field>
          </div>
          <Field label="Job description" required hint={jd.length > MAX_JD - 1500 ? `${jd.length.toLocaleString()} / ${MAX_JD.toLocaleString()}` : undefined}>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              maxLength={MAX_JD}
              required
              rows={8}
              placeholder="Paste the full description — responsibilities, requirements, nice-to-haves."
              className="w-full resize-y rounded-lg border border-rule bg-paper/50 px-3 py-2 text-[0.95rem] leading-relaxed outline-none focus:border-forest"
            />
          </Field>
          <details className="group">
            <summary className="cursor-pointer select-none text-sm font-medium text-forest">Add notes about your team’s culture</summary>
            <div className="mt-3">
              <Field label="Culture notes" hint="optional">
                <textarea
                  value={culture}
                  onChange={(e) => setCulture(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Remote-first, small team, ship weekly, heavy code review…"
                  className="w-full resize-y rounded-lg border border-rule bg-paper/50 px-3 py-2 text-[0.95rem] outline-none focus:border-forest"
                />
              </Field>
            </div>
          </details>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={state.phase === 'loading' || !roleTitle.trim() || jd.trim().length < 40}
              className="inline-flex h-10 items-center rounded-full bg-forest px-5 text-sm font-medium text-paper hover:bg-pine disabled:bg-rule disabled:text-muted"
            >
              {state.phase === 'loading' ? 'Assessing…' : 'Assess fit'}
            </button>
            {state.phase === 'loading' && <LoadingSteps />}
            {state.phase === 'error' && (
              <p role="alert" className="text-sm text-coral-ink">
                {state.message}
              </p>
            )}
          </div>
        </form>
      ) : (
        <div ref={resultRef} tabIndex={-1} className="mt-6 outline-none">
          <FitReport result={state.result} onReset={() => setState({ phase: 'idle' })} />
        </div>
      )}
    </section>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        <span>
          {label}
          {required && <span className="text-coral-ink"> *</span>}
        </span>
        {hint && <span className="font-mono text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function LoadingSteps() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 2600)
    return () => clearInterval(t)
  }, [])
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status">
      <span aria-hidden className="size-2 animate-pulse rounded-full bg-forest" />
      {STEPS[i]}
    </p>
  )
}

function Score({ value, label }: { value: number; label: string }) {
  const v = Math.max(1, Math.min(5, Math.round(value)))
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${label}: ${v} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`h-2 w-5 rounded-sm ${n <= v ? 'bg-forest' : 'bg-rule'}`} />
      ))}
      <span className="ml-1.5 font-mono text-xs text-muted">{v}/5</span>
    </span>
  )
}

function Evidence({ nums, sources }: { nums: number[]; sources: CitationSource[] }) {
  const { focusAnchor } = useSite()
  const items = nums.map((n) => sources.find((s) => s.n === n)).filter((s): s is CitationSource => !!s)
  if (!items.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.map((s) =>
        s.visibility === 'public' && s.anchor ? (
          <button
            key={s.n}
            type="button"
            onClick={() => focusAnchor(s.anchor ?? '')}
            className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper/60 px-2 py-1 text-xs hover:border-forest"
          >
            <span className="font-mono text-coral-ink">{s.n}</span>
            {s.title.replace(/^Resume · /, '')}
            <span aria-hidden className="text-forest">↗</span>
          </button>
        ) : (
          <span key={s.n} className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper/60 px-2 py-1 text-xs" title={s.title}>
            <span className="font-mono text-coral-ink">{s.n}</span>
            In my own words · {topicLabel(s.topic)}
          </span>
        ),
      )}
    </div>
  )
}

function Dimension({ title, d, sources }: { title: string; d: FitDimension; sources: CitationSource[] }) {
  return (
    <div className="rounded-xl border border-rule bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{title}</h4>
        <Score value={d.score} label={title} />
      </div>
      <p className="mt-2 text-[0.95rem] leading-relaxed">{d.summary}</p>
      {d.strengths.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {d.strengths.map((s) => (
            <li key={s} className="flex gap-2">
              <span aria-hidden className="text-forest">+</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {d.gaps.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {d.gaps.map((s) => (
            <li key={s} className="flex gap-2">
              <span aria-hidden className="text-coral-ink">−</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      <Evidence nums={d.evidence} sources={sources} />
    </div>
  )
}

function toMarkdown(r: FitAssessment): string {
  const dim = (name: string, d: FitDimension) =>
    [`## ${name}: ${d.score}/5`, d.summary, ...d.strengths.map((s) => `+ ${s}`), ...d.gaps.map((s) => `- ${s}`)].join('\n')
  return [
    `# ${RESUME.name} — fit for ${r.roleTitle}${r.company ? ` at ${r.company}` : ''}`,
    `**${VERDICT[r.overall.verdict].label} (${r.overall.score}/5).** ${r.overall.summary}`,
    dim('Technical', r.technical),
    dim('Culture', r.culture),
    r.unknowns.length ? `## Worth asking directly\n${r.unknowns.map((u) => `- ${u}`).join('\n')}` : '',
    r.questionsForRaj.length ? `## Raj would ask\n${r.questionsForRaj.map((u) => `- ${u}`).join('\n')}` : '',
    `_AI-generated by Raj’s clone at curlycloud.dev. Confirm with Raj: ${RESUME.email}_`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function FitReport({ result: r, onReset }: { result: FitAssessment; onReset: () => void }) {
  const [copied, setCopied] = useState(false)
  const verdict = VERDICT[r.overall.verdict] ?? VERDICT.mixed
  const subject = encodeURIComponent(`${r.roleTitle}${r.company ? ` at ${r.company}` : ''}`)
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink bg-white p-5 sm:p-6">
        <p className="font-mono text-xs text-muted">
          {r.roleTitle}
          {r.company ? ` · ${r.company}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${verdict.tone}`}>{verdict.label}</span>
          <Score value={r.overall.score} label="Overall" />
        </div>
        <p className="mt-3 text-[1.05rem] leading-relaxed">{r.overall.summary}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Dimension title="Technical fit" d={r.technical} sources={r.sources} />
        <Dimension title="Culture fit" d={r.culture} sources={r.sources} />
      </div>
      {(r.unknowns.length > 0 || r.questionsForRaj.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {r.unknowns.length > 0 && (
            <div className="rounded-xl border border-dashed border-rule p-4 text-sm">
              <h4 className="font-semibold">No evidence either way</h4>
              <p className="mt-1 text-xs text-muted">The clone won’t guess — worth asking me directly.</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {r.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          {r.questionsForRaj.length > 0 && (
            <div className="rounded-xl border border-dashed border-rule p-4 text-sm">
              <h4 className="font-semibold">What I’d want to know</h4>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {r.questionsForRaj.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <a
          href={`mailto:${RESUME.email}?subject=${subject}`}
          className="inline-flex h-10 items-center rounded-full bg-forest px-5 text-sm font-medium text-paper hover:bg-pine"
        >
          Email me about this role
        </a>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(toMarkdown(r)).then(() => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            })
          }}
          className="inline-flex h-10 items-center rounded-full border border-rule bg-white px-4 text-sm font-medium hover:border-ink"
        >
          {copied ? 'Copied' : 'Copy as Markdown'}
        </button>
        <button type="button" onClick={onReset} className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink">
          Check another role
        </button>
      </div>
      <p className="text-xs text-muted">AI-generated from my resume and my own interview answers. It can be wrong — I’m happy to talk it through.</p>
    </div>
  )
}
