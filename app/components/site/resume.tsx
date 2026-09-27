'use client'

import { RESUME, resumeAnchor, type ResumeBullet } from '@/content/resume'
import { Emphasized, FILTERS, FILTER_LABELS, questionAbout, RESUME_LINE_COUNT, TAG_COUNTS } from './resume-helpers'
import { useSite } from './site-context'

// ── Building blocks ──────────────────────────────────────────────────────────

export function SectionHeading({ id, index, title, meta }: { id?: string; index: string; title: string; meta?: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-3 border-b border-ink pb-2">
      <span className="font-mono text-xs text-muted">{index}</span>
      <h2 id={id} className="scroll-mt-36 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {meta && <span className="ml-auto font-mono text-xs text-muted">{meta}</span>}
    </div>
  )
}

function Bullet({ anchor, bullet }: { anchor: string; bullet: ResumeBullet }) {
  const { skill, cited, flash, ask } = useSite()
  const nums = cited[anchor]
  const dimmed = skill !== null && !bullet.tags.includes(skill)
  const isFlash = flash === anchor
  return (
    <li
      id={anchor}
      className={[
        'group relative -mx-2 scroll-mt-32 rounded-lg py-1.5 pl-7 pr-2 transition-[background-color,opacity,box-shadow] duration-300',
        dimmed ? 'opacity-30' : '',
        nums ? 'bg-marker/55' : 'hover:bg-white',
        isFlash ? 'bg-marker ring-2 ring-coral' : '',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={`absolute left-3 top-[0.8rem] size-1.5 rounded-[1px] ${nums ? 'bg-coral' : skill && !dimmed ? 'bg-forest' : 'bg-muted/50'}`}
      />
      {nums && (
        <span className="absolute -left-1 top-1.5 -translate-x-full font-mono text-[0.7rem] font-medium text-coral max-sm:hidden" aria-hidden>
          [{nums.join(',')}]
        </span>
      )}
      <span className="leading-relaxed">
        <Emphasized text={bullet.text} />
      </span>
      {nums && <span className="sr-only"> (cited in the latest answer)</span>}{' '}
      <button
        type="button"
        onClick={() => ask(questionAbout(bullet.text))}
        className="inline-flex translate-y-[-1px] items-center gap-1 rounded-md border border-rule bg-white px-1.5 py-0.5 align-middle text-xs font-medium text-forest opacity-0 transition-opacity hover:border-forest focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
      >
        Ask about this
        <span aria-hidden>→</span>
      </button>
    </li>
  )
}

// ── Sections ─────────────────────────────────────────────────────────────────

export function Hero() {
  const { focusAsk } = useSite()
  const current = RESUME.experience.find((r) => r.end === null)
  const linkedin = RESUME.links.find((l) => l.label === 'LinkedIn')
  const github = RESUME.links.find((l) => l.label === 'GitHub')
  return (
    <section aria-labelledby="hero-name" className="pb-10 pt-10 sm:pt-16">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-forest">AI Engineer · {RESUME.location}</p>
      <h1 id="hero-name" className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
        {RESUME.name}
      </h1>
      <p className="mt-5 max-w-[34ch] text-2xl leading-snug tracking-tight text-ink/90 sm:text-[1.9rem]">{RESUME.pitch}</p>
      {current && (
        <p className="mt-6 flex items-start gap-2.5 text-[0.95rem] text-muted">
          <span aria-hidden className="relative mt-[0.45rem] flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-forest opacity-40 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-forest" />
          </span>
          <span>
            Now: <span className="text-ink">{current.role}</span> at <span className="text-ink">{current.company}</span>. {RESUME.headline}
          </span>
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-2.5 print:hidden">
        <button
          type="button"
          onClick={focusAsk}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-[0.95rem] font-medium text-paper transition-colors hover:bg-pine"
        >
          Ask my AI clone
          <kbd className="hidden rounded border border-paper/30 px-1.5 font-mono text-xs text-paper/80 sm:inline">/</kbd>
        </button>
        <a href="#fit" className="inline-flex h-11 items-center rounded-full border border-ink/20 bg-white px-5 text-[0.95rem] font-medium hover:border-ink">
          Check my fit for a role
        </a>
        <a href="#agents" className="inline-flex h-11 items-center rounded-full px-4 text-[0.95rem] font-medium text-forest hover:bg-white">
          Connect your agent →
        </a>
      </div>
      <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        <li>
          <a href={`mailto:${RESUME.email}`} className="hover:text-ink">
            {RESUME.email}
          </a>
        </li>
        {linkedin && (
          <li>
            <a href={linkedin.href} className="hover:text-ink" rel="me noopener" target="_blank">
              LinkedIn
            </a>
          </li>
        )}
        {github && (
          <li>
            <a href={github.href} className="hover:text-ink" rel="me noopener" target="_blank">
              GitHub
            </a>
          </li>
        )}
        <li className="print:hidden">
          <button type="button" onClick={() => window.print()} className="hover:text-ink">
            Save as PDF
          </button>
        </li>
      </ul>
    </section>
  )
}

export function HowToRead() {
  return (
    <aside className="mb-14 flex flex-col gap-4 rounded-2xl border border-rule bg-white p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5 print:hidden">
      <div aria-hidden className="w-full shrink-0 rounded-xl bg-paper p-3 sm:w-60">
        <div className="relative rounded-md bg-marker/70 py-1 pl-5 pr-2 text-[0.72rem] leading-snug">
          <span className="absolute left-2 top-[0.55rem] size-1 rounded-[1px] bg-coral" />
          Built and run the company’s MCP server…
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-muted">
          <span className="rounded bg-coral/10 px-1 font-mono text-coral">1</span>
          “I built it so every tool call…”
        </div>
      </div>
      <p className="text-[0.95rem] leading-relaxed text-muted">
        <span className="font-medium text-ink">This resume is also a knowledge base.</span> All {RESUME_LINE_COUNT} lines below are sources
        my AI clone can cite. Ask it something and the lines it used light up. Hover any line to ask about it.
      </p>
    </aside>
  )
}

export function About() {
  return (
    <section aria-labelledby="about-title" className="mb-16">
      <SectionHeading id="about-title" index="01" title="About" />
      <div id={resumeAnchor('summary')} className="max-w-[62ch] scroll-mt-32 space-y-4 text-[1.05rem] leading-relaxed">
        {RESUME.summary.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </section>
  )
}

function SkillFilter() {
  const { skill, setSkill } = useSite()
  const count = skill ? (TAG_COUNTS[skill] ?? 0) : 0
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-8 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 print:hidden">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-xs font-medium text-muted">
          <span className="sm:hidden">Skill</span>
          <span className="max-sm:hidden">Filter by skill</span>
        </p>
        <div className="-my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none]">
          {FILTERS.flatMap((g) => g.items)
            .filter((i) => TAG_COUNTS[i.id])
            .map((i) => {
              const on = skill === i.id
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSkill(on ? null : i.id)}
                  className={[
                    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                    on ? 'border-forest bg-forest text-paper' : 'border-rule bg-white text-ink hover:border-forest',
                  ].join(' ')}
                >
                  {i.label}
                  <span className={`font-mono tabular-nums ${on ? 'text-paper/70' : 'text-muted'}`}>{TAG_COUNTS[i.id]}</span>
                </button>
              )
            })}
        </div>
      </div>
      {skill && (
        <p className="mt-2 text-xs text-muted" role="status">
          Showing {count} line{count === 1 ? '' : 's'} about <span className="font-medium text-ink">{FILTER_LABELS[skill]}</span>.{' '}
          <button type="button" onClick={() => setSkill(null)} className="font-medium text-forest underline underline-offset-2">
            Clear
          </button>
        </p>
      )}
    </div>
  )
}

export function Work() {
  const { skill } = useSite()
  const years = new Date().getFullYear() - Number(RESUME.experience[RESUME.experience.length - 1].start.slice(0, 4))
  return (
    <div className="mb-16">
      <SkillFilter />
      <section aria-labelledby="experience-title" className="mb-16">
        <SectionHeading id="experience-title" index="02" title="Experience" meta={`${RESUME.experience.length} roles · ${years} years`} />
        <ol>
          {RESUME.experience.map((r, i) => (
            <li
              key={r.id}
              id={resumeAnchor('exp', r.id)}
              className={`grid scroll-mt-32 gap-x-8 gap-y-2 py-7 sm:grid-cols-[8.5rem_minmax(0,1fr)] ${i ? 'border-t border-rule' : 'pt-1'}`}
            >
              <div className={`font-mono text-xs leading-relaxed text-muted transition-opacity ${skill && !r.bullets.some((b) => b.tags.includes(skill)) ? 'opacity-40' : ''}`}>
                <p className="text-ink">{r.period}</p>
                <p>{r.location}</p>
                {r.end === null && <p className="mt-1.5 inline-block rounded-full bg-forest px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-paper">Now</p>}
              </div>
              <div className="min-w-0">
                <h3 className={`text-lg font-semibold leading-snug tracking-tight transition-opacity ${skill && !r.bullets.some((b) => b.tags.includes(skill)) ? 'opacity-40' : ''}`}>{r.role}</h3>
                <p className="text-[0.95rem] text-forest">{r.company}</p>
                {r.blurb && <p className="mt-2 max-w-[62ch] text-[0.95rem] leading-relaxed text-muted">{r.blurb}</p>}
                <ul className="mt-3 space-y-1">
                  {r.bullets.map((b) => (
                    <Bullet key={b.id} anchor={resumeAnchor('exp', r.id, b.id)} bullet={b} />
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="builds-title">
        <SectionHeading id="builds-title" index="03" title="Independent builds" meta="shipped end to end" />
        <div className="space-y-5">
          {RESUME.builds.map((b) => (
            <article key={b.id} id={resumeAnchor('build', b.id)} className="scroll-mt-32 rounded-2xl border border-rule bg-white p-5 sm:p-6">
              <p className="font-mono text-xs text-muted">{b.period}</p>
              <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{b.title}</h3>
              {b.link && (
                <a href={b.link.href} target="_blank" rel="noopener" className="mt-1 inline-block text-sm font-medium text-forest underline underline-offset-2">
                  {b.link.label} ↗
                </a>
              )}
              {b.stack.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Stack">
                  {b.stack.map((s) => (
                    <li key={s} className="rounded-md bg-paper px-2 py-0.5 font-mono text-[0.72rem] text-muted">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              {b.id === 'regdocs' && <EvalTrail />}
              <ul className="mt-4 space-y-1">
                {b.bullets.map((x) => (
                  <Bullet key={x.id} anchor={resumeAnchor('build', b.id, x.id)} bullet={x} />
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="community-title" className="mt-16">
        <SectionHeading id="community-title" index="04" title="Community" meta="Toronto" />
        {RESUME.community.map((c) => (
          <article
            key={c.id}
            id={resumeAnchor('community', c.id)}
            className="scroll-mt-32 overflow-hidden rounded-2xl border border-rule bg-white"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 bg-marker/60 px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono text-xs text-muted">{c.period}</p>
                <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{c.company}</h3>
                <p className="text-[0.95rem] text-forest">{c.role}</p>
              </div>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-9 items-center rounded-full border border-ink/20 bg-white px-4 text-sm font-medium hover:border-ink"
                >
                  {c.url.replace(/^https?:\/\//, '')} ↗
                </a>
              )}
            </div>
            <div className="p-5 sm:p-6">
              {c.blurb && <p className="max-w-[62ch] text-[0.95rem] leading-relaxed text-muted">{c.blurb}</p>}
              <ul className="mt-3 space-y-1">
                {c.bullets.map((b) => (
                  <Bullet key={b.id} anchor={resumeAnchor('community', c.id, b.id)} bullet={b} />
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

/** The regdocs eval story as a tiny chart: the upgrade, then the regression the harness caught. */
function EvalTrail() {
  const points = [
    { label: 'Baseline', value: 95.7 },
    { label: 'Embedding upgrade', value: 96.7 },
    { label: 'Corpus grew', value: 91.3, alert: true },
  ]
  const min = 90
  const max = 98
  const x = (i: number) => 44 + i * 136
  const y = (v: number) => 22 + ((max - v) / (max - min)) * 52
  return (
    <figure className="mt-5 rounded-xl border border-rule bg-paper/60 p-3 sm:p-4">
      <figcaption className="flex items-baseline justify-between text-xs text-muted">
        <span>
          <span className="font-medium text-ink">hit@8</span> across releases
        </span>
        <span className="font-mono">eval-gated</span>
      </figcaption>
      <svg viewBox="0 0 360 100" className="mt-2 h-auto w-full max-w-lg" role="img" aria-label="hit@8 went from 95.7% to 96.7% after the embedding upgrade, then dropped to 91.3% when the corpus grew, which held the release.">
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
          fill="none"
          className="stroke-forest"
          strokeWidth="1.5"
        />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r="3.5" className={p.alert ? 'fill-coral' : 'fill-forest'} />
            <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className={`font-mono text-[11px] ${p.alert ? 'fill-coral' : 'fill-ink'}`}>
              {p.value}%
            </text>
            <text x={x(i)} y="96" textAnchor="middle" className="fill-muted text-[10.5px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-muted">The drop was caught before release, root-caused to boilerplate sections colliding in retrieval, and half-recovered.</p>
    </figure>
  )
}

export function Skills() {
  const { setSkill } = useSite()
  const pick = (id: string) => {
    setSkill(id)
    document.getElementById('experience-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <section aria-labelledby="skills-title" id={resumeAnchor('skills')} className="mb-16 scroll-mt-24">
      <SectionHeading id="skills-title" index="05" title="Skills" />
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {RESUME.skills.map((g) => (
          <div key={g.id}>
            <h3 className="text-sm font-semibold">{g.label}</h3>
            <ul className="mt-2 space-y-1 text-[0.95rem] text-muted">
              {g.items.map((i) => (
                <li key={i.id}>
                  {TAG_COUNTS[i.id] ? (
                    <button type="button" onClick={() => pick(i.id)} className="text-left hover:text-forest hover:underline hover:underline-offset-2">
                      {i.label}
                      <span className="ml-1.5 font-mono text-xs text-muted/80">{TAG_COUNTS[i.id]}</span>
                    </button>
                  ) : (
                    i.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Education() {
  return (
    <section aria-labelledby="education-title" id={resumeAnchor('education')} className="mb-16 scroll-mt-24">
      <SectionHeading id="education-title" index="06" title="Education" />
      <ul className="divide-y divide-rule">
        {RESUME.education.map((e) => (
          <li key={e.id} className="grid gap-x-8 gap-y-0.5 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
            <span className="font-mono text-xs leading-6 text-muted">{e.period}</span>
            <span>
              <span className="font-medium">{e.credential}</span>
              <span className="text-muted"> · {e.school}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
