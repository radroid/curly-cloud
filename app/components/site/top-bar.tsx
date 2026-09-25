import Image from 'next/image'
import Link from 'next/link'

type Mode = 'website' | 'terminal'
type Tone = 'light' | 'dark'

/** Website | Terminal switch. Shared by the resume site and terminal mode. */
export function ModeSwitch({ active, tone = 'light' }: { active: Mode; tone?: Tone }) {
  const dark = tone === 'dark'
  const item = (mode: Mode, href: string, label: React.ReactNode) => {
    const on = mode === active
    return (
      <Link
        href={href}
        aria-current={on ? 'page' : undefined}
        className={[
          'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
          on
            ? dark
              ? 'bg-term-accent text-pine'
              : 'bg-ink text-paper'
            : dark
              ? 'text-term-dim hover:text-term-text'
              : 'text-muted hover:text-ink',
        ].join(' ')}
      >
        {label}
      </Link>
    )
  }
  return (
    <nav
      aria-label="View mode"
      className={[
        'inline-flex items-center rounded-full border p-0.5',
        dark ? 'border-term-dim/40 bg-pine' : 'border-rule bg-white',
      ].join(' ')}
    >
      {item('website', '/', 'Website')}
      {item(
        'terminal',
        '/terminal',
        <>
          <span aria-hidden className="font-mono text-xs">
            &gt;_
          </span>
          Terminal
        </>,
      )}
    </nav>
  )
}

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur print:hidden">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image src="/raj-avatar.webp" alt="" width={28} height={28} className="size-7 rounded-full" priority />
          <span className="truncate font-semibold tracking-tight">Raj Dholakia</span>
          <span className="hidden font-mono text-xs text-muted sm:inline">AI Engineer</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-4">
          <Link href="#agents" className="hidden text-sm text-muted hover:text-ink md:inline">
            For agents
          </Link>
          <Link href="/mac" className="hidden font-chicago text-sm text-muted hover:text-ink md:inline" title="The 1984 Macintosh version of this site">
            Mac ’84
          </Link>
          <ModeSwitch active="website" />
        </div>
      </div>
    </header>
  )
}
