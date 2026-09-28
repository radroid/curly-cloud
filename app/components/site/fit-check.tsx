'use client'

import { useEffect, useRef, useState } from 'react'
import type { CitationSource, FitAssessment, FitDimension } from '@/lib/rag/types'
import { RESUME } from '@/content/resume'
import { topicLabel } from '@/content/topics'
import { useMagnetic } from '@/app/lib/use-magnetic'
import { SectionHeading } from './resume'
import { useSite } from './site-context'

const MAX_JD = 12000

const VERDICT: Record<FitAssessment['overall']['verdict'], { label: string; tone: string }> = {
  strong: { label: 'Strong fit', tone: 'bg-forest text-paper' },
  promising: { label: 'Promising', tone: 'bg-term-accent text-pine' },
  mixed: { label: 'Mixed', tone: 'bg-sun text-ink' },
  weak: { label: 'Weak fit', tone: 'bg-coral-ink text-white' },
}

const STEPS = ['reading the job description', 'pulling evidence from my resume and answers', 'weighing technical fit', 'weighing culture fit', 'writing it up']

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: FitAssessment }
  | { phase: 'error'; message: string }

const input =
  'w-full rounded-[10px] border border-rule bg-white px-3.5 text-base text-ink transition-colors placeholder:text-muted/70 focus:border-forest'

/** C12. The request, validation and flow are the site's fit check as before; this is its presentation. */
export function FitCheck() {
  const [roleTitle, setRoleTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [culture, setCulture] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })
  const resultRef = useRef<HTMLDivElement>(null)
  const magnetic = useMagnetic<HTMLButtonElement>()

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
    <section id="fit" aria-labelledby="fit-title" className="scroll-mt-16 pt-14 sm:pt-24">
      <SectionHeading id="fit-title" index={3} title="Fit" />
      <p className="mb-8 max-w-[54ch] text-[17px] leading-relaxed text-muted">
        Paste a job description. My clone scores the fit against what I’ve actually done, shows the evidence, and says what it can’t tell.
      </p>

      {state.phase !== 'done' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="grid max-w-[760px] gap-3.5"
        >
          <Field label="Role title">
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Senior AI Engineer"
              className={`${input} h-12`}
            />
          </Field>
          <Field label="Job description" hint={jd.length > MAX_JD - 1500 ? `${jd.length.toLocaleString()} / ${MAX_JD.toLocaleString()}` : undefined}>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              maxLength={MAX_JD}
              required
              rows={5}
              placeholder="Paste the full description: responsibilities, requirements, nice-to-haves."
              className={`${input} min-h-[150px] resize-y py-3 leading-relaxed`}
            />
          </Field>
          <details className="disclose group">
            <summary className="inline-flex min-h-11 items-center gap-2.5 text-sm font-medium text-forest">
              <span aria-hidden className="size-2.5 flex-none -rotate-45 border-b-2 border-r-2 border-current opacity-60 transition-transform duration-250 group-open:rotate-45" />
              More fields
              <span className="font-mono text-xs font-normal text-muted">company, culture</span>
            </summary>
            <div className="grid gap-3.5 pb-1 pt-2">
              <Field label="Company" hint="optional">
                <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} placeholder="Acme" className={`${input} h-12`} />
              </Field>
              <Field label="Culture notes" hint="optional">
                <textarea
                  value={culture}
                  onChange={(e) => setCulture(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Remote-first, small team, ship weekly, heavy code review…"
                  className={`${input} min-h-[90px] resize-y py-3`}
                />
              </Field>
            </div>
          </details>
          <div className="pt-1">
            <button
              ref={magnetic}
              type="submit"
              disabled={state.phase === 'loading' || !roleTitle.trim() || jd.trim().length < 40}
              className="inline-flex h-[46px] items-center rounded-full bg-forest px-[22px] text-[15px] font-semibold text-paper transition-[translate,background-color] duration-200 hover:bg-pine disabled:bg-rule disabled:text-muted"
            >
              {state.phase === 'loading' ? 'Checking…' : 'Check my fit'}
            </button>
          </div>
          {state.phase === 'loading' && <FitLog />}
          {state.phase === 'error' && (
            <p role="alert" className="text-sm text-coral-ink">
              {state.message}
            </p>
          )}
        </form>
      ) : (
        <div ref={resultRef} tabIndex={-1} className="max-w-[760px] rounded-[18px] outline-none">
          <FitReport result={state.result} onReset={() => setState({ phase: 'idle' })} />
        </div>
      )}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium">
        {label}
        {hint && <span className="font-mono text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** M18 log ticker while the check runs. The steps advance on a timer, so none is marked as done. */
function FitLog() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 2600)
    return () => clearInterval(t)
  }, [])
  return (
    // Height for every step up front, so the page below doesn't move as lines arrive.
    <div role="log" aria-label="Fit check progress" className="min-h-[calc(5*1.9em)] font-mono text-[13px] leading-[1.9]">
      {STEPS.slice(0, i + 1).map((s, k) => (
        <p key={s} className={k < i ? 'text-muted' : 'text-ink'}>
          <span aria-hidden className="mr-2 text-forest">
            ›
          </span>
          {s}
          {k === i && <span aria-hidden className="ml-1 inline-block h-[1.1em] w-[0.55em] animate-blink bg-forest align-[-0.2em] still:animate-none" />}
        </p>
      ))}
    </div>
  )
}

const clampScore = (value: number): number => Math.max(1, Math.min(5, Math.round(value)))

/** A 1–5 score as a bar that fills when the result appears (instant with motion off). */
function Meter({ title, score }: { title: string; score: number }) {
  const v = clampScore(score)
  return (
    <div>
      <p className="flex items-baseline justify-between text-sm font-medium">
        <span>{title}</span>
        <span className="font-mono tabular-nums">
          {v} / 5<span className="sr-only"> for {title.toLowerCase()}</span>
        </span>
      </p>
      <div aria-hidden className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-forest/10">
        <div
          style={{ '--fill': `${v * 20}%` } as React.CSSProperties}
          className="h-full w-(--fill) rounded-full bg-forest transition-[width] duration-1000 ease-[cubic-bezier(0.2,0.7,0.2,1)] starting:w-0"
        />
      </div>
    </div>
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
            className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-2 py-1 text-left text-[12.5px] hover:border-forest pointer-coarse:min-h-11"
          >
            <span className="font-mono text-coral-ink">{s.n}</span>
            {s.title.replace(/^Resume · /, '')}
            <span aria-hidden className="text-forest">
              ↗
            </span>
          </button>
        ) : (
          <span key={s.n} className="inline-flex items-center gap-1.5 rounded-md border border-rule bg-paper px-2 py-1 text-[12.5px]" title={s.title}>
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
    <div className="border-t border-rule pt-5">
      {Number.isFinite(d.score) ? <Meter title={title} score={d.score} /> : <h4 className="text-sm font-medium">{title}</h4>}
      <p className="mt-3 leading-relaxed">{d.summary}</p>
      {d.strengths.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-sm">
          {d.strengths.map((s) => (
            <li key={s} className="flex gap-2">
              <span aria-hidden className="font-mono text-forest">
                +
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {d.gaps.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-sm text-muted">
          {d.gaps.map((s) => (
            <li key={s} className="flex gap-2">
              <span aria-hidden className="font-mono text-coral-ink">
                −
              </span>
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
  const pill = 'inline-flex h-11 items-center rounded-full px-5 text-sm font-medium'
  return (
    <div className="space-y-4">
      <div className="space-y-5 rounded-[18px] border border-rule bg-white p-5 sm:p-6">
        <div>
          <p className="font-mono text-xs text-muted">
            fit check · {r.roleTitle}
            {r.company ? ` · ${r.company}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className={`type-display rounded-lg px-3 pb-1.5 pt-2 text-[clamp(34px,6cqi,52px)] ${verdict.tone}`}>{verdict.label}</span>
            {Number.isFinite(r.overall.score) && (
              <span className="font-mono text-sm tabular-nums text-muted">{clampScore(r.overall.score)} / 5 overall</span>
            )}
          </div>
          <p className="mt-4 text-[1.05rem] leading-relaxed">{r.overall.summary}</p>
        </div>
        <Dimension title="Technical fit" d={r.technical} sources={r.sources} />
        <Dimension title="Culture fit" d={r.culture} sources={r.sources} />
      </div>
      {(r.unknowns.length > 0 || r.questionsForRaj.length > 0) && (
        <div className="grid gap-4 @xl:grid-cols-2">
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
        <a href={`mailto:${RESUME.email}?subject=${subject}`} className={`${pill} bg-forest text-paper hover:bg-pine`}>
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
          className={`${pill} border border-rule bg-white hover:border-ink`}
        >
          {copied ? 'Copied' : 'Copy as Markdown'}
        </button>
        <button type="button" onClick={onReset} className="inline-flex min-h-11 items-center text-sm font-medium text-muted underline underline-offset-2 hover:text-ink">
          Check another role
        </button>
      </div>
      <p className="text-xs text-muted">AI-generated from my resume and my own interview answers. It can be wrong — I’m happy to talk it through.</p>
    </div>
  )
}
