'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cx } from '@/app/studio/_components/ui'

const ITEMS = [
  { href: '/studio', label: 'Dashboard', n: '01' },
  { href: '/studio/knowledge', label: 'Knowledge', n: '02' },
  { href: '/studio/logs', label: 'Conversations', n: '03' },
  { href: '/studio/keys', label: 'Keys', n: '04' },
  { href: '/studio/playground', label: 'Playground', n: '05' },
  { href: '/studio/persona', label: 'Persona', n: '06' },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/studio' ? pathname === '/studio' : pathname === href || pathname.startsWith(href + '/')
}

function LogoutButton({ className }: { className: string }) {
  // A plain form: works without JS, and the route answers form posts with a redirect to login.
  return (
    <form method="post" action="/api/auth/logout">
      <button type="submit" className={className}>
        Log out
      </button>
    </form>
  )
}

export function StudioNav() {
  const pathname = usePathname() ?? '/studio'
  return (
    <>
      {/* Phone: compact bar with a scrollable row of sections. */}
      <header className="sticky top-0 z-30 bg-pine text-term-text md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/studio" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-tight text-white">Studio</span>
            <span className="font-mono text-[10.5px] text-term-dim">curlycloud.dev</span>
          </Link>
          <div className="flex items-center gap-1 text-xs">
            <a href="/" target="_blank" rel="noreferrer" className="rounded px-2 py-1.5 text-term-dim hover:text-white">
              Site ↗
            </a>
            <LogoutButton className="rounded px-2 py-1.5 text-term-dim hover:text-white" />
          </div>
        </div>
        <nav aria-label="Studio" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'shrink-0 rounded-md px-2.5 py-1.5 text-[13px]',
                  active ? 'bg-forest text-white shadow-[inset_0_-2px_0_var(--color-sun)]' : 'text-term-text/80 hover:text-white',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Desktop: a quiet pine rail. */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-pine text-term-text md:flex">
        <div className="px-5 pb-7 pt-7">
          <Link href="/studio" className="block">
            <span className="block font-mono text-[10.5px] uppercase tracking-[0.22em] text-term-dim">curlycloud.dev</span>
            <span className="mt-1 block text-[1.35rem] font-semibold leading-none tracking-tight text-white">Studio</span>
          </Link>
          <p className="mt-3 flex items-center gap-1.5 font-mono text-[10.5px] text-term-dim">
            <span aria-hidden className="size-1.5 rounded-full bg-sun" />
            private · owner session
          </p>
        </div>
        <nav aria-label="Studio" className="flex-1 space-y-0.5 px-2.5">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                  active ? 'bg-forest text-white shadow-[inset_2px_0_0_var(--color-sun)]' : 'text-term-text/80 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <span className={cx('font-mono text-[10.5px] tabular-nums', active ? 'text-sun' : 'text-term-dim')}>{item.n}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="space-y-0.5 border-t border-white/10 px-2.5 py-3 text-sm">
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md px-2.5 py-2 text-term-text/80 hover:bg-white/[0.06] hover:text-white">
            Public site <span aria-hidden className="font-mono text-xs">↗</span>
          </a>
          <LogoutButton className="w-full rounded-md px-2.5 py-2 text-left text-term-text/80 hover:bg-white/[0.06] hover:text-white" />
        </div>
      </aside>
    </>
  )
}
