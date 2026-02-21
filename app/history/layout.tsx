import { Sora } from 'next/font/google'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <div className={sora.variable}>{children}</div>
}
