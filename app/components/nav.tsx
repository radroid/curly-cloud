'use client'

import Link from 'next/link'
import { TextScramble } from '@/app/components/ui/text-scramble'

const navItems = {
  '/': {
    name: 'home',
  },
  '/history': {
    name: 'history',
  },
  '/blog': {
    name: 'thinking',
  },
}

export function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-3 transition-colors duration-300"
      style={{ backgroundColor: 'rgb(var(--background) / 0.9)', backdropFilter: 'blur(8px)' }}
      id="nav"
    >
      <div className="max-w-7xl mx-auto flex flex-row items-center">
        <div className="flex flex-row items-center space-x-4 sm:space-x-6">
          {Object.entries(navItems).map(([path, { name }]) => {
            return (
              <Link
                key={path}
                href={path}
                className="flex align-middle relative py-1 px-2"
              >
                <TextScramble text={name} textSize="text-sm" />
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
