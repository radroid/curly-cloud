import Image from 'next/image'
import Link from 'next/link'
import { ModeSwitch } from '@/app/components/site/top-bar'

/**
 * Terminal mode's top bar. Same layout as the website's TopBar so the Website | Terminal switch
 * stays in one place when you flip between modes.
 */
export function TerminalTopBar() {
  return (
    <header className="shrink-0 border-b border-white/10 bg-pine font-sans text-term-text">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image src="/raj-avatar.webp" alt="" width={28} height={28} className="size-7 rounded-full" priority />
          <span className="truncate font-semibold tracking-tight">Raj Dholakia</span>
          <span className="hidden font-mono text-xs text-term-dim sm:inline">AI Engineer</span>
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-4">
          <Link
            href="/mac"
            title="The 1984 Macintosh version of this site"
            className="hidden font-chicago text-sm text-term-dim transition-colors hover:text-term-text md:inline"
          >
            Mac ’84
          </Link>
          <ModeSwitch active="terminal" tone="dark" />
        </div>
      </div>
    </header>
  )
}
