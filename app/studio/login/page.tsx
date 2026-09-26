import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/app/studio/login/login-form'
import { hasStudioSession } from '@/lib/studio/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sign in' }

/** Only same-app studio paths are allowed as a post-login destination. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith('/studio') && !next.startsWith('//') && !next.startsWith('/studio/login') ? next : '/studio'
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const target = safeNext(next)
  if (await hasStudioSession()) redirect(target)

  return (
    <main className="grid min-h-dvh bg-paper md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="flex flex-col justify-between bg-pine px-6 py-8 text-term-text md:px-12 md:py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-term-dim">curlycloud.dev / studio</p>
        <div className="py-10 md:py-0">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Studio</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-term-dim">
            The back office of Raj’s clone: what it knows, what people asked, and how it should have answered.
          </p>
        </div>
        <ul className="hidden font-mono text-[11px] leading-6 text-term-dim md:block">
          <li>knowledge · conversations · corrections</li>
          <li>keys · playground · persona</li>
        </ul>
      </section>
      <section className="flex items-start justify-center px-6 py-10 md:items-center md:px-12">
        <div className="w-full max-w-sm">
          <LoginForm next={target} />
          <p className="mt-8 border-t border-rule pt-4 text-xs leading-relaxed text-muted">
            Private. Sessions last seven days on this device. Ten attempts an hour.
          </p>
        </div>
      </section>
    </main>
  )
}
