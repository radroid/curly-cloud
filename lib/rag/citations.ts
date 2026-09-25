/**
 * Citation validation for streamed answers. Markers must reference a numbered source that was
 * actually provided; out-of-range markers are dropped from the text. Also normalises the
 * variants models like to produce: `[1, 3]`, `[Source 2]`, `[1][2]`.
 */

const MARKER = /(\s?)\[(?:(?:source|src|ref)\s*)?(\d{1,2}(?:\s*[,;]\s*(?:(?:source|src|ref)\s*)?\d{1,2})*)\]/gi
/**
 * Held back until more text arrives: trailing whitespace (a dropped marker may follow it) and a
 * `[` near the end that may still become a marker.
 */
const PARTIAL = /\s*(?:\[[^\]\n]{0,16})?$/

export interface CitationFilter {
  /** Feed raw model text; returns cleaned text that is safe to emit (partial markers held back). */
  push(text: string): string
  /** Release anything still held back at the end of the stream. */
  flush(): string
  /** Valid source numbers in first-use order. */
  cited(): number[]
}

export function createCitationFilter(sourceCount: number): CitationFilter {
  let pending = ''
  const cited: number[] = []

  const clean = (text: string): string =>
    text.replace(MARKER, (_m, space: string, list: string) => {
      const nums = list
        .split(/[,;]/)
        .map((p) => Number(p.replace(/\D/g, '')))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount)
      const unique = [...new Set(nums)]
      if (unique.length === 0) return ''
      for (const n of unique) if (!cited.includes(n)) cited.push(n)
      return space + unique.map((n) => `[${n}]`).join('')
    })

  return {
    push(text: string): string {
      pending += text
      const partial = pending.match(PARTIAL)
      const cut = partial && partial[0] ? partial.index! : pending.length
      const ready = pending.slice(0, cut)
      pending = pending.slice(cut)
      return clean(ready)
    },
    flush(): string {
      const rest = clean(pending)
      pending = ''
      return rest
    },
    cited: () => [...cited],
  }
}

/** Non-streaming form: clean a whole answer. */
export function validateCitations(text: string, sourceCount: number): { text: string; cited: number[] } {
  const f = createCitationFilter(sourceCount)
  const out = f.push(text) + f.flush()
  return { text: out, cited: f.cited() }
}

/** Remove all citation markers (used for assistant turns replayed as history). */
export function stripCitations(text: string): string {
  return text.replace(MARKER, '')
}
