import type { Metadata, Viewport } from 'next'
import { TerminalTopBar } from './mode-switch'
import { Terminal } from './terminal'
import { ViewportFrame } from './viewport-frame'

export const metadata: Metadata = {
  // Absolute: the root layout's '%s — Raj Dholakia' template would double the name.
  title: { absolute: 'Terminal — Raj Dholakia' },
  description:
    'Browse Raj Dholakia’s AI-engineering résumé from a shell: ls and cat through his work, ask his AI clone a question, and pick up terminal basics along the way.',
  alternates: { canonical: '/terminal' },
}

// Dark form controls and scrollbars; Android Chrome shrinks the layout for the keyboard.
export const viewport: Viewport = { colorScheme: 'dark', interactiveWidget: 'resizes-content' }

export default function TerminalPage() {
  return (
    <ViewportFrame className="flex flex-col overflow-hidden bg-term-bg font-mono text-term-text">
      <TerminalTopBar />
      <noscript>
        <p className="mx-auto w-full max-w-5xl px-4 pt-6 text-sm text-term-dim sm:px-8">
          Terminal mode runs on JavaScript, which is turned off in this browser.{' '}
          <a href="/" className="text-term-accent underline underline-offset-[3px]">
            Read the website instead
          </a>
          .
        </p>
      </noscript>
      <Terminal />
    </ViewportFrame>
  )
}
