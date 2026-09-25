/**
 * Verbatim guard (prompt-extraction defence). Builds word shingles of the protected text in the
 * prompt (private chunks, and the system prompt including the persona) and trips when the answer
 * reproduces a run of `window` consecutive normalised words from it, or emits one of our prompt
 * delimiters. Paraphrase passes; copying doesn't. Pure and synchronous so it can sit inside the
 * streaming loop.
 */

export const DEFAULT_GUARD_WINDOW = 15

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu

/** Our own prompt delimiters never belong in an answer; seeing one means the prompt is being dumped. */
export const PROMPT_MARKERS = /<\s*\/?\s*(?:sources?|persona)\b/i

/**
 * Index up to which `text` can be released while still holding back its last `words` words
 * (citation markers don't count).
 */
export function releasableIndex(text: string, words: number): number {
  const masked = text.replace(/\[\d{1,2}\]/g, (m) => ' '.repeat(m.length))
  const starts = [...masked.matchAll(WORD)].map((m) => m.index ?? 0)
  if (starts.length <= words) return 0
  return starts[starts.length - words]
}

/** Lowercased words with citation markers and apostrophes removed. */
export function normalizeWords(text: string): string[] {
  const clean = text.replace(/\[\d{1,2}\]/g, ' ').toLowerCase().normalize('NFKC')
  return (clean.match(WORD) ?? []).map((w) => w.replace(/['’]/g, ''))
}

export function shingles(words: string[], window: number): Set<string> {
  const out = new Set<string>()
  for (let i = 0; i + window <= words.length; i++) out.add(words.slice(i, i + window).join(' '))
  return out
}

export interface VerbatimGuard {
  /** Feed the next piece of output. Returns true once a protected run has been reproduced. */
  push(text: string): boolean
  /** Flush a trailing partial word. */
  finish(): boolean
  readonly tripped: boolean
}

/**
 * @param protectedTexts private text (and the system prompt) the answer must not reproduce
 * @param opts.allowTexts public text in the same prompt; shingles found there are not protected
 * @param opts.forbidden raw-text pattern that trips immediately (e.g. our prompt delimiters)
 */
export function createVerbatimGuard(
  protectedTexts: string[],
  opts: { window?: number; allowTexts?: string[]; forbidden?: RegExp } = {},
): VerbatimGuard {
  const window = Math.max(4, opts.window ?? DEFAULT_GUARD_WINDOW)
  const protectedSet = new Set<string>()
  for (const t of protectedTexts) for (const s of shingles(normalizeWords(t), window)) protectedSet.add(s)
  if (opts.allowTexts?.length) {
    for (const t of opts.allowTexts) for (const s of shingles(normalizeWords(t), window)) protectedSet.delete(s)
  }
  let recent: string[] = []
  let carry = ''
  let tripped = false
  // Last few raw chars, so a forbidden marker split across deltas is still seen.
  let rawTail = ''

  const take = (words: string[]): boolean => {
    for (const w of words) {
      recent.push(w)
      if (recent.length > window) recent = recent.slice(-window)
      if (recent.length === window && protectedSet.has(recent.join(' '))) {
        tripped = true
        return true
      }
    }
    return false
  }

  return {
    get tripped() {
      return tripped
    },
    push(text: string): boolean {
      if (tripped) return true
      if (opts.forbidden) {
        const window = rawTail + text
        if (opts.forbidden.test(window)) {
          tripped = true
          return true
        }
        rawTail = window.slice(-24)
      }
      if (protectedSet.size === 0) return false
      const combined = carry + text
      // The last word may continue in the next delta; hold it back unless followed by a separator.
      const m = combined.match(/[\p{L}\p{N}'’]+$/u)
      carry = m ? m[0] : ''
      const complete = m ? combined.slice(0, combined.length - m[0].length) : combined
      return take(normalizeWords(complete))
    },
    finish(): boolean {
      if (tripped) return true
      const rest = carry
      carry = ''
      return protectedSet.size > 0 && take(normalizeWords(rest))
    },
  }
}
