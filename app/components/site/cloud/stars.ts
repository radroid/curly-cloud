import { RESUME, resumeAnchor, resumeSources } from '@/content/resume'

/** One bright point in the hero cloud: a public source the clone can cite. */
export interface Star {
  anchor: string
  /** The source title without the "Resume · " prefix, e.g. "Eddy Solutions". */
  title: string
  /** The line itself (or the role's blurb), cut to about 110 characters. */
  snippet: string
}

const clip = (t: string): string => (t.length > 110 ? `${t.slice(0, 107).replace(/\s+\S*$/, '')}…` : t)

// The text a reader sees at each anchor: role and community blurbs, and every resume line.
const TEXT = new Map<string, string>()
for (const [kind, blocks] of [
  ['exp', RESUME.experience],
  ['community', RESUME.community],
] as const) {
  for (const r of blocks) {
    if (r.blurb) TEXT.set(resumeAnchor(kind, r.id), r.blurb)
    for (const b of r.bullets) TEXT.set(resumeAnchor(kind, r.id, b.id), b.text)
  }
}
for (const x of RESUME.builds) for (const b of x.bullets) TEXT.set(resumeAnchor('build', x.id, b.id), b.text)

/** Every public source with a place on the page, in knowledge-base order. */
export const STARS: Star[] = resumeSources().flatMap((s) =>
  s.visibility === 'public' && s.anchor
    ? [{ anchor: s.anchor, title: s.title.replace(/^Resume · /, ''), snippet: clip(TEXT.get(s.anchor) ?? s.body.split('\n')[0]) }]
    : [],
)
