'use client'

import Link from 'next/link'
import { RESUME, resumeAnchor } from '@/content/resume'
import { SectionHeading } from './resume'
import { useSite } from './site-context'

const PIPELINE: { step: string; title: string; body: string }[] = [
  {
    step: 'Know',
    title: 'Two kinds of knowledge',
    body: 'Public: every line of this resume. Private: my own answers to interview questions about principles, decisions and stories, written offline in a HyperCard-style stack. Those answers stay on the server.',
  },
  {
    step: 'Find',
    title: 'Hybrid retrieval',
    body: 'SQLite FTS5 (BM25) and bge-m3 embeddings search in parallel, fused with Reciprocal Rank Fusion, then reranked.',
  },
  {
    step: 'Answer',
    title: 'First person, numbered sources',
    body: 'The model answers as me, only from the numbered sources, and says so when they don’t cover a question. Retrieved text is treated as data, never as instructions.',
  },
  {
    step: 'Guard',
    title: 'Checked while it streams',
    body: 'Citations are validated on the server. A streaming guard cuts the answer if it starts reproducing my private notes word for word. Rate limits and a daily token budget cap the cost.',
  },
  {
    step: 'Measure',
    title: 'Evals before changes ship',
    body: 'A golden set scores retrieval (hit@k, MRR) and answers, plus refusal and prompt-injection probes.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mb-16 scroll-mt-24">
      <SectionHeading id="how-title" title="How the clone answers" />
      <ol className="grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-2 xl:grid-cols-3">
        {PIPELINE.map((p, i) => (
          <li key={p.step} className="bg-white p-4 sm:p-5">
            <p className="font-mono text-xs text-forest">
              {String(i + 1).padStart(2, '0')} · {p.step}
            </p>
            <h3 className="mt-1.5 font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
        <li className="flex flex-col justify-between gap-4 bg-pine p-4 text-term-text sm:p-5">
          <p className="text-sm leading-relaxed">
            Prefer a shell? The same knowledge is in terminal mode, which also teaches the basics of how a shell works.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/terminal" className="rounded-full bg-term-accent px-3 py-1 font-medium text-pine hover:bg-term-text">
              Open the terminal
            </Link>
            <Link href="/mac" className="rounded-full border border-term-dim/50 px-3 py-1 font-chicago hover:border-term-text">
              Mac ’84
            </Link>
          </div>
        </li>
      </ol>
    </section>
  )
}

export function Contact() {
  const { focusAsk } = useSite()
  return (
    <section id="contact" aria-labelledby="contact-title" className="mb-10 scroll-mt-24">
      <SectionHeading id="contact-title" title="Say hello" />
      <div id={resumeAnchor('contact')} className="scroll-mt-24 rounded-2xl bg-forest p-6 text-paper sm:p-8">
        <p className="max-w-[30ch] text-2xl font-semibold leading-snug tracking-tight">The clone is good. The real one is better at follow-ups.</p>
        <a href={`mailto:${RESUME.email}`} className="mt-5 inline-block break-all font-mono text-lg underline decoration-paper/40 underline-offset-4 hover:decoration-paper">
          {RESUME.email}
        </a>
        <p className="mt-1 text-sm text-paper/70">{RESUME.location}</p>
        <div className="mt-6 flex flex-wrap gap-2 text-sm print:hidden">
          {RESUME.links
            .filter((l) => !l.href.includes('curlycloud.dev'))
            .map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="me noopener" className="rounded-full border border-paper/30 px-3 py-1 hover:border-paper">
                {l.label}
              </a>
            ))}
          <button type="button" onClick={focusAsk} className="rounded-full bg-paper px-3 py-1 font-medium text-forest hover:bg-white">
            Ask the clone first
          </button>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-rule py-8 text-sm text-muted">
      <div id="privacy" className="max-w-[62ch] scroll-mt-24 space-y-2">
        <p className="font-medium text-ink">About the clone and your privacy</p>
        <p>
          “Ask Raj” is an AI that answers from my resume and my own written answers. It can be wrong, and it’s no substitute for talking to me.
          Questions and answers are logged so I can correct it. Logs keep a hashed visitor id that changes daily — never your IP address — and
          email addresses or phone numbers in questions are redacted.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        <span>© {new Date().getFullYear()} {RESUME.name}</span>
        <Link href="/terminal" className="hover:text-ink">
          Terminal
        </Link>
        <Link href="/mac" className="font-chicago hover:text-ink">
          Mac ’84
        </Link>
        <a href="/llms.txt" className="hover:text-ink">
          llms.txt
        </a>
        <a href="#agents" className="hover:text-ink">
          MCP
        </a>
      </div>
    </footer>
  )
}
