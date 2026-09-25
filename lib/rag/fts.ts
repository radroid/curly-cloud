/**
 * FTS5 MATCH query builder. Visitor text never reaches FTS syntax: we keep only letter/number
 * runs, drop stopwords, quote every token and OR them. Quotes, `*`, `^`, `:`, parentheses,
 * `NEAR`, `AND`/`OR`/`NOT` and column filters can't survive.
 */

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both but by
  can could did do does doing don down during each else few for from further had has have having he her here hers herself
  him himself his how i if in into is it its itself just let me more most my myself near no nor not now of off on once only
  or other ought our ours ourselves out over own please same she should so some such tell than that the their theirs them
  themselves then there these they this those through to too under until up very was we were what when where which while
  who whom why will with would you your yours yourself yourselves s t d ll m re ve y`.split(/\s+/),
)

export const MAX_FTS_TOKENS = 24

/** Lowercased word tokens (letters/numbers only). */
export function queryTokens(text: string): string[] {
  const words = text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    if (w.length < 2 && !/\d/.test(w)) continue
    if (w.length > 40 || STOPWORDS.has(w) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= MAX_FTS_TOKENS) break
  }
  return out
}

/** `"tok1" OR "tok2" …`, or null when nothing searchable remains. */
export function buildFtsQuery(text: string): string | null {
  const tokens = queryTokens(text)
  if (tokens.length === 0) return null
  return tokens.map((t) => `"${t}"`).join(' OR ')
}
