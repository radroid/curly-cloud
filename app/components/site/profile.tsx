'use client'

import { RESUME, resumeAnchor } from '@/content/resume'

// C4 Profile. P4 replaces this with the path, quotes and summary disclosure (REDESIGN-PLAN.md §2).

export function Profile() {
  return (
    <section aria-label="Profile" className="pt-14 sm:pt-24">
      <div id={resumeAnchor('summary')} className="max-w-[62ch] scroll-mt-32 space-y-4 rounded-md text-[1.05rem] leading-relaxed">
        {RESUME.summary.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </section>
  )
}
