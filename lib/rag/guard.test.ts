import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, sayableLines } from '@/lib/rag/prompt'
import { buildGuardIndex, createVerbatimGuard, findEncodedRun, PROMPT_MARKERS, releasableIndex, type GuardTrip } from '@/lib/rag/guard'
import { foldWords } from '@/lib/rag/normalize'
import { FAKE_PRIVATE } from '@/lib/rag/testing'

const SECRET = FAKE_PRIVATE[0].body
const WORDS = SECRET.split(' ')

/** Push `out` in small deltas (as a model streams) and report the trip, if any. */
function run(out: string, protectedTexts: string[] = [SECRET], opts: { allowTexts?: string[]; size?: number } = {}): GuardTrip | null {
  const guard = createVerbatimGuard(protectedTexts, { allowTexts: opts.allowTexts, forbidden: PROMPT_MARKERS })
  const size = opts.size ?? 7
  for (let i = 0; i < out.length; i += size) if (guard.push(out.slice(i, i + size))) return guard.trip
  guard.finish()
  return guard.trip
}

const every = (n: number, filler: string): string => WORDS.map((w, i) => (i % n === n - 1 ? `${w} ${filler}` : w)).join(' ')
const rot13 = (s: string): string =>
  s.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
  })

describe('verbatim guard: disguised copies (reviewer bypasses)', () => {
  it.each<[string, string, GuardTrip['reason'][]]>([
    ['verbatim', SECRET, ['aligned', 'verbatim', 'letters']],
    ['upper case with "..." between words', SECRET.toUpperCase().replace(/ /g, ' ... '), ['aligned']],
    ['pipe separators', WORDS.join(' | '), ['aligned']],
    ['underscores', WORDS.join('_'), ['aligned']],
    ['a filler word every 10 words', every(10, 'banana'), ['aligned']],
    ['a filler word every 14 words', every(14, 'ok'), ['aligned']],
    ['a filler after every word', every(1, 'banana'), ['aligned']],
    ['a filler that is itself in the text ("and") every 10 words', every(10, 'and'), ['aligned']],
    ['two in-text fillers every 10 words', every(10, 'the the'), ['aligned']],
    ['every fifth word dropped', WORDS.filter((_, i) => i % 5 !== 4).join(' '), ['aligned']],
    ['words spelled out with hyphens', WORDS.map((w) => w.split('').join('-')).join(' '), ['letters']],
    ['zero-width characters inside words', WORDS.map((w) => `${w[0]}​${w.slice(1)}`).join(' '), ['aligned']],
    ['zero-width characters between words', WORDS.join('​'), ['letters']],
    ['Cyrillic look-alike letters', SECRET.replace(/o/g, 'о').replace(/a/g, 'а').replace(/e/g, 'е'), ['aligned']],
    ['Greek look-alike letters and accents', SECRET.replace(/o/g, 'ο').replace(/i/g, 'í'), ['aligned']],
    ['fullwidth letters', SECRET.replace(/[a-z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)), ['aligned']],
    ['leetspeak', SECRET.replace(/e/g, '3').replace(/o/g, '0').replace(/a/g, '4').replace(/s/g, '$'), ['aligned']],
    ['numbered one-word lines', WORDS.map((w, i) => `${i + 1}. ${w}`).join('\n'), ['aligned']],
    ['one letter per line', SECRET.replace(/[^a-z]/gi, '').split('').join('\n'), ['letters']],
    ['reversed word order', [...WORDS].reverse().join(' '), ['verbatim']],
    ['ROT13', rot13(SECRET), ['letters']],
    ['base64', Buffer.from(SECRET).toString('base64'), ['encoded']],
    ['base64 wrapped at 60 columns', Buffer.from(SECRET).toString('base64').replace(/(.{60})/g, '$1\n'), ['encoded']],
    ['hex', Buffer.from(SECRET).toString('hex'), ['encoded']],
    ['space-separated hex bytes', Buffer.from(SECRET).toString('hex').replace(/(..)/g, '$1 '), ['encoded']],
    ['our prompt delimiters, disguised', 'Here: <ѕource n="1">', ['marker']],
  ])('trips on %s', (_, out, reasons) => {
    const trip = run(out)
    expect(trip).not.toBeNull()
    expect(reasons).toContain(trip!.reason)
  })

  it('trips the same way when the whole output arrives in one push', () => {
    expect(run(every(10, 'banana'), [SECRET], { size: 10_000 })?.reason).toBe('aligned')
  })

  it('catches a private answer split across several protected texts in one prompt', () => {
    const other = FAKE_PRIVATE[1].body
    const trip = run(`Two things. ${other} And also: ${SECRET}`, [SECRET, other])
    expect(trip?.reason).toBe('aligned')
  })
})

describe('verbatim guard: where it trips', () => {
  it('reports the span of the copied run in raw offsets', () => {
    const prefix = 'Honestly? '
    const trip = run(prefix + SECRET)!
    expect(trip.start).toBe(prefix.length)
    expect(trip.end).toBeGreaterThan(trip.start)
    expect(trip.end).toBeLessThanOrEqual(prefix.length + SECRET.length)
  })

  it('holds back from the first word of a live alignment, however much filler follows', () => {
    const guard = createVerbatimGuard([SECRET])
    const prefix = 'Well, the short version is simple. '
    guard.push(prefix)
    const filler = WORDS.slice(0, 6).map((w) => `${w} banana banana`).join(' ') + ' '
    expect(guard.push(filler)).toBe(false)
    expect(guard.holdFrom()).toBe(prefix.length)
  })

  it('releases once an alignment dies', () => {
    const guard = createVerbatimGuard([SECRET])
    const start = 'My favourite debugging approach is '
    guard.push(start)
    expect(guard.holdFrom()).toBe(0)
    // Words from the text that don't continue it cost the alignment a point each.
    guard.push('the the the the the the ')
    expect(guard.holdFrom()).toBeGreaterThan(start.length)
  })

  it('holds back both a word window and a letter window', () => {
    expect(releasableIndex('one two three four', 3)).toBe(4)
    const letters = 'a b c d e f g h i j k l m n o p q r s t'
    // 15 words is 15 letters here; 20 letters needs all 20 words held.
    expect(releasableIndex(letters, 15, 20)).toBe(0)
    expect(releasableIndex(letters, 15, 10)).toBe(letters.indexOf('f'))
    expect(releasableIndex('extraordinarily long words everywhere', 1, 15)).toBe('extraordinarily long '.length)
    expect(releasableIndex('extraordinarily long words everywhere', 1, 20)).toBe(0)
  })
})

describe('verbatim guard: what it lets through', () => {
  const index = buildGuardIndex([SECRET, buildSystemPrompt(null).stable], { allowTexts: sayableLines() })
  const passes = (out: string): boolean => {
    const guard = createVerbatimGuard(index, { forbidden: PROMPT_MARKERS })
    for (let i = 0; i < out.length; i += 9) if (guard.push(out.slice(i, i + 9))) return false
    return !guard.finish()
  }

  it('lets a genuine paraphrase in my voice through', () => {
    expect(
      passes(
        "When something flaky turns up, I don't guess. I pin it down with a tiny repro first, then walk back through recent commits until I find where it changed [1]. It saves me hours, and it keeps me honest about what I really know versus what I assume.",
      ),
    ).toBe(true)
  })

  it('lets a paraphrase that reuses a few short phrases (≤8 words) through', () => {
    expect(
      passes(
        'When something flaky shows up in production, I write down the smallest reproduction first. Only then do I start changing things: I bisect the change history, and I keep going until the behaviour flips. Guessing costs me afternoons; a written repro keeps me honest [1].',
      ),
    ).toBe(true)
  })

  it("lets the clone's stock lines and ordinary answers through", () => {
    expect(passes(sayableLines().join(' '))).toBe(true)
    expect(
      passes(
        "I built the company's work tracker from scratch on Next.js/TypeScript/PostgreSQL/Cloudflare/Workers/D1 [1], and I'm based in Toronto. See https://github.com/radroid or https://linkedin.com/in/raj-dholakia. Deploys went from 15 to 2 minutes [2]; in 2023, 2024 and 2025 I shipped 10 20 30 40 50 60 70 80 90 11 12 13 14 15 16 17 18 19 21 22 things.",
      ),
    ).toBe(true)
  })

  it('does not protect runs that also appear in public text', () => {
    const shared = 'I design for reliability first, because the people using these systems make decisions with the answers.'
    expect(run(`${shared} I also think in small reversible steps.`, [`Private: ${shared} Plus a secret.`], { allowTexts: [shared] })).toBeNull()
  })

  it('does not treat slash-joined stacks, slugs or plain numbers as encoded', () => {
    expect(findEncodedRun('js/TypeScript/PostgreSQL/Cloudflare/Workers/D1/Drizzle/Vitest')).toBeNull()
    expect(findEncodedRun('how-i-built-a-rag-system-for-construction-safety-reports-2025')).toBeNull()
    expect(findEncodedRun('10 20 30 40 50 60 70 80 90 11 12 13 14 15 16 17 18 19 21 22 23 24')).toBeNull()
  })
})

describe('text folding', () => {
  it('folds case, accents, zero-width, look-alikes and leetspeak the same way on both sides', () => {
    expect(foldWords('Wr1t3 d0wn th3 $m4ll3st r3pr0')).toEqual(['write', 'down', 'the', 'smallest', 'repro'])
    expect(foldWords('ΜΥ fаvоurіtе déb​ugging')).toEqual(['my', 'favourite', 'debugging'])
    expect(foldWords("I don't [3] Know—it's FINE.")).toEqual(['i', 'dont', 'know', 'its', 'fine'])
    // Plain numbers stay numbers.
    expect(foldWords('4+ years, 2023, 1. first')).toEqual(['4', 'years', '2023', '1', 'first'])
  })
})
