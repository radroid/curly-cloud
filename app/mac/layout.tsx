import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Macintosh — curlycloud',
  description: 'The 1984 Macintosh desktop version of curlycloud.dev, with eight working apps.',
}

export default function MacLayout({ children }: { children: React.ReactNode }) {
  return <div className="mac-root">{children}</div>
}
