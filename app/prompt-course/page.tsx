import type { Metadata, Viewport } from 'next'
import { Anton } from 'next/font/google'
import Link from 'next/link'
import { PROMPT_COURSE, PROMPT_COURSE_FILE } from '@/content/prompt-course'
import { CopyKey, PromptCopyProvider } from './prompt-copy'
import { PromptWindow } from './prompt-window'

// Same display face as the home page, loaded per page so /terminal and /mac don't fetch it.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'swap' })

const DESCRIPTION =
  'One prompt for Claude Code or Codex. It reads your own prompt history and turns your costliest habits into a private four-week prompting course.'

export const metadata: Metadata = {
  title: 'Learn prompting from your own prompts',
  description: DESCRIPTION,
  alternates: { canonical: '/prompt-course' },
  openGraph: { title: 'Learn prompting from your own prompts', description: DESCRIPTION, url: '/prompt-course', siteName: 'curlycloud.dev', type: 'website' },
}

// The whole page sits on the dark stage (--color-night-deep).
export const viewport: Viewport = { themeColor: '#071d1a', colorScheme: 'dark' }

const SECTIONS = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'how', label: 'How it works' },
]

const STEPS: { name: string; body: React.ReactNode }[] = [
  { name: 'collect', body: 'Your chats, agent transcripts, CLAUDE.md files and skills. Only your words are judged.' },
  {
    name: 'score',
    body: (
      <>
        Ten dimensions from{' '}
        <a href="https://arxiv.org/abs/2406.06608" className="text-term-accent underline underline-offset-[3px]">
          The Prompt Report
        </a>
        , 0–3 each.
      </>
    ),
  },
  { name: 'rank', body: 'Habits ordered by frequency × rework, quoted from your prompts.' },
  { name: 'teach', body: 'A module per habit: before and after, two drills, a rule.' },
]

export default function PromptCoursePage() {
  return (
    <PromptCopyProvider text={PROMPT_COURSE}>
      <div className={`${anton.variable} min-h-dvh bg-night-deep text-term-text`}>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-5 border-b border-white/10 bg-night-deep/70 px-gutter backdrop-blur-[10px]">
          <Link href="/" className="type-display whitespace-nowrap text-[21px]">
            Raj Dholakia
          </Link>
          <nav aria-label="Sections" className="ml-auto hidden gap-1 sm:flex">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex h-11 items-center whitespace-nowrap rounded-md px-2 font-mono text-xs font-medium uppercase tracking-[0.06em] text-term-dim transition-colors hover:text-term-text"
              >
                <span className="mr-1 text-sun">[{i + 1}]</span>
                {s.label}
              </a>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-5xl px-gutter">
          <section className="pb-14 pt-[clamp(56px,11vh,120px)]">
            <h1 className="type-display text-[clamp(44px,7vw,92px)]">
              Learn prompting from <span className="text-term-accent">your own prompts</span>
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg text-term-dim">
              Paste it into Claude Code or Codex. It reads your history and turns your costliest habits into a four-week course.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <CopyKey label="Copy the prompt" />
              <span className="font-mono text-[13px] text-term-dim pointer-coarse:hidden">
                or press <kbd className="rounded border border-white/15 px-1.5 text-term-text">C</kbd> anywhere
              </span>
            </div>
            <p className="mt-7 font-mono text-xs text-term-dim">No setup · read-only · the course stays on your machine</p>
          </section>

          <section id="prompt" aria-label="The prompt" className="scroll-mt-20">
            <PromptWindow text={PROMPT_COURSE} file={PROMPT_COURSE_FILE} />
          </section>

          <section id="how" aria-labelledby="how-title" className="scroll-mt-20 pt-24">
            <h2 id="how-title" className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-term-dim">
              <span className="mr-1.5 text-sun">[2]</span>How it works
            </h2>
            <ol className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.name} className="rounded-xl border border-white/10 bg-night/60 p-5">
                  <p className="font-mono text-sm font-semibold text-term-accent">
                    0{i + 1} {step.name}
                  </p>
                  <p className="mt-2 text-sm text-term-dim">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <footer className="mx-auto mt-24 max-w-5xl px-gutter">
          <p className="border-t border-white/10 py-6 font-mono text-xs text-term-dim">I ran this on about 1,700 of my own prompts.</p>
        </footer>
      </div>
    </PromptCopyProvider>
  )
}
