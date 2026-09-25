import Link from 'next/link'

const SEGMENT = 'flex h-9 items-center rounded-md px-2.5 text-[13px] transition-colors sm:px-3.5 sm:text-sm'

/**
 * Top bar for terminal mode: Raj's name, a Website | Terminal switch, and the 1984 Mac.
 * Self-contained (no props) so a shared site bar can replace it later.
 */
export function ModeSwitch() {
  return (
    <header className="shrink-0 border-b border-white/10 bg-pine font-sans text-term-text">
      <nav
        aria-label="Site"
        className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-8"
      >
        <Link href="/" className="min-w-0 truncate rounded-sm py-2 text-[15px] font-medium tracking-[-0.01em] sm:justify-self-start">
          Raj Dholakia
        </Link>

        <div className="flex shrink-0 rounded-lg bg-black/25 p-1 ring-1 ring-white/10 ring-inset">
          <Link href="/" className={`${SEGMENT} text-term-dim hover:text-term-text`}>
            Website
          </Link>
          <Link href="/terminal" aria-current="page" className={`${SEGMENT} bg-forest text-term-text ring-1 ring-white/10 ring-inset`}>
            Terminal
          </Link>
        </div>

        <Link
          href="/mac"
          title="The 1984 Macintosh version of this site"
          className="shrink-0 rounded-sm py-2 font-chicago text-[13px] text-term-dim transition-colors hover:text-term-text sm:justify-self-end"
        >
          Mac ’84
        </Link>
      </nav>
    </header>
  )
}
